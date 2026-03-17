/**
 * DependencyAnalyzer
 * 
 * 依賴分析模組
 * 提供依賴樹建立、孤立資產偵測、Chunk 重複分析、刪除影響分析與 World Partition 依賴分析
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import type { AssetType } from '../types/asset.js';
import type {
  DependencyTree,
  DependencyNode,
  OrphanedAsset,
  ChunkDuplicationReport,
  ImpactAnalysis,
  WorldPartitionDependencyReport,
} from '../types/analysis.js';

// ─── MCP 回傳資料介面 ───

interface AssetDependencyInfo {
  assetPath?: string;
  className?: string;
  dependencies?: string[];
  referencedBy?: string[];
  memorySize?: number;
  chunkId?: number;
  [key: string]: unknown;
}

interface DataLayerInfo {
  name?: string;
  assets?: string[];
  [key: string]: unknown;
}

// ─── 快取鍵 ───

const CACHE_KEYS = {
  DEPENDENCY_TREE: '__dep_tree__',
  ORPHANED_ASSETS: '__dep_orphaned__',
  CHUNK_DUPLICATION: '__dep_chunk_dup__',
  IMPACT_ANALYSIS: '__dep_impact__',
  WORLD_PARTITION: '__dep_world_partition__',
};


/**
 * 類別名稱到資產類型的映射
 */
const CLASS_TO_ASSET_TYPE: Record<string, AssetType> = {
  'Texture2D': 'Texture2D',
  'StaticMesh': 'StaticMesh',
  'SkeletalMesh': 'SkeletalMesh',
  'Material': 'Material',
  'MaterialInstance': 'MaterialInstance',
  'MaterialInstanceConstant': 'MaterialInstance',
  'MaterialInstanceDynamic': 'MaterialInstance',
  'SoundWave': 'SoundWave',
  'SoundCue': 'SoundCue',
  'Blueprint': 'Blueprint',
  'BlueprintGeneratedClass': 'Blueprint',
  'AnimSequence': 'AnimSequence',
  'AnimMontage': 'AnimMontage',
  'ParticleSystem': 'ParticleSystem',
  'NiagaraSystem': 'NiagaraSystem',
};

/**
 * 根資產路徑模式（這些資產不應被視為孤立）
 */
const ROOT_ASSET_PATTERNS = [
  /^\/Game\/Maps\//i,
  /^\/Game\/Levels\//i,
  /GameMode/i,
  /GameState/i,
  /PlayerController/i,
  /DefaultPawn/i,
  /HUD/i,
  /^\/Engine\//i,
];

/**
 * 估算資產大小的預設值（MB）
 */
const DEFAULT_ASSET_SIZES: Record<AssetType, number> = {
  'Texture2D': 4,
  'StaticMesh': 2,
  'SkeletalMesh': 8,
  'Material': 0.1,
  'MaterialInstance': 0.05,
  'SoundWave': 5,
  'SoundCue': 0.01,
  'Blueprint': 0.5,
  'AnimSequence': 1,
  'AnimMontage': 0.2,
  'ParticleSystem': 0.5,
  'NiagaraSystem': 1,
};

/**
 * DependencyAnalyzer 類別
 * 
 * 提供依賴分析功能，包含依賴樹建立、孤立資產偵測、
 * Chunk 重複分析、刪除影響分析與 World Partition 依賴分析
 */
export class DependencyAnalyzer {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'DependencyAnalyzer' });
  }

  /**
   * 建立依賴樹
   * 
   * 從指定資產路徑建立完整的依賴樹，包含所有直接與間接依賴
   * 
   * @param assetPath - 根資產路徑
   * @returns 依賴樹
   */
  async buildDependencyTree(assetPath: string): Promise<DependencyTree> {
    this.logger.info(`Building dependency tree for: ${assetPath}`);

    // 檢查快取
    const cacheKey = `${CACHE_KEYS.DEPENDENCY_TREE}_${assetPath}`;
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug('Using cached dependency tree');
      return cached.result as DependencyTree;
    }

    // 追蹤已訪問的節點以避免循環
    const visited = new Set<string>();
    let maxDepth = 0;

    // 遞迴建立依賴節點
    const buildNode = async (path: string, depth: number): Promise<DependencyNode> => {
      maxDepth = Math.max(maxDepth, depth);
      visited.add(path);

      // 取得資產依賴資訊
      const depInfo = await this.getAssetDependencyInfo(path);
      const assetType = this.detectAssetType(depInfo.className);

      const node: DependencyNode = {
        assetPath: path,
        assetType,
        dependencies: [],
        referencedBy: depInfo.referencedBy ?? [],
        chunkId: depInfo.chunkId,
      };

      // 遞迴處理依賴
      const deps = depInfo.dependencies ?? [];
      for (const depPath of deps) {
        if (!visited.has(depPath)) {
          const childNode = await buildNode(depPath, depth + 1);
          node.dependencies.push(childNode);
        }
      }

      return node;
    };

    // 建立根節點
    const rootNode = await buildNode(assetPath, 0);

    const tree: DependencyTree = {
      root: assetPath,
      directDependencies: rootNode.dependencies,
      totalDependencyCount: visited.size - 1, // 排除根節點
      maxDepth,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(tree));
    this.cacheManager.set(cacheKey, hash, tree);

    this.logger.info('Dependency tree built', {
      root: assetPath,
      totalDependencies: tree.totalDependencyCount,
      maxDepth: tree.maxDepth,
    });

    return tree;
  }


  /**
   * 偵測孤立資產
   * 
   * 掃描專案找出沒有任何入邊參照的非根資產
   * 
   * @returns 孤立資產列表
   */
  async findOrphanedAssets(): Promise<OrphanedAsset[]> {
    this.logger.info('Finding orphaned assets');

    // 檢查快取
    const cached = this.cacheManager.get(CACHE_KEYS.ORPHANED_ASSETS);
    if (cached) {
      this.logger.debug('Using cached orphaned assets');
      return cached.result as OrphanedAsset[];
    }

    // 取得所有資產列表
    const assetsResult = await this.mcpClient.manageAsset<AssetDependencyInfo[]>(
      'list',
      { path: '/Game' }
    );

    const assets = Array.isArray(assetsResult.data) ? assetsResult.data : [];
    const orphanedAssets: OrphanedAsset[] = [];

    // 建立參照計數映射
    const referenceCount = new Map<string, number>();
    const assetInfoMap = new Map<string, AssetDependencyInfo>();

    // 初始化所有資產的參照計數為 0
    for (const asset of assets) {
      const path = asset.assetPath ?? '';
      if (path) {
        referenceCount.set(path, 0);
        assetInfoMap.set(path, asset);
      }
    }

    // 計算每個資產的入邊參照數
    for (const asset of assets) {
      const deps = asset.dependencies ?? [];
      for (const depPath of deps) {
        const currentCount = referenceCount.get(depPath) ?? 0;
        referenceCount.set(depPath, currentCount + 1);
      }
    }

    // 找出沒有入邊參照的非根資產
    for (const [assetPath, count] of referenceCount.entries()) {
      if (count === 0 && !this.isRootAsset(assetPath)) {
        const assetInfo = assetInfoMap.get(assetPath);
        const assetType = this.detectAssetType(assetInfo?.className);
        const estimatedSize = assetInfo?.memorySize ?? this.estimateAssetSize(assetType);

        orphanedAssets.push({
          assetPath,
          assetType,
          estimatedSize,
          suggestion: this.suggestOrphanAction(assetPath, assetType),
        });
      }
    }

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(orphanedAssets));
    this.cacheManager.set(CACHE_KEYS.ORPHANED_ASSETS, hash, orphanedAssets);

    this.logger.info('Orphaned assets found', { count: orphanedAssets.length });

    return orphanedAssets;
  }

  /**
   * 分析 Chunk 重複
   * 
   * 檢查是否有資產被分配到多個 Chunk，造成包體膨脹
   * 
   * @returns Chunk 重複報告
   */
  async analyzeChunkDuplication(): Promise<ChunkDuplicationReport> {
    this.logger.info('Analyzing chunk duplication');

    // 檢查快取
    const cached = this.cacheManager.get(CACHE_KEYS.CHUNK_DUPLICATION);
    if (cached) {
      this.logger.debug('Using cached chunk duplication report');
      return cached.result as ChunkDuplicationReport;
    }

    // 取得所有資產及其 Chunk 分配
    const assetsResult = await this.mcpClient.manageAsset<AssetDependencyInfo[]>(
      'list',
      { path: '/Game' }
    );

    const assets = Array.isArray(assetsResult.data) ? assetsResult.data : [];

    // 建立資產到 Chunk 的映射
    const assetChunks = new Map<string, Set<number>>();
    const assetSizes = new Map<string, number>();

    for (const asset of assets) {
      const path = asset.assetPath ?? '';
      const chunkId = asset.chunkId;

      if (path && chunkId !== undefined) {
        if (!assetChunks.has(path)) {
          assetChunks.set(path, new Set());
        }
        assetChunks.get(path)!.add(chunkId);

        // 記錄資產大小
        if (!assetSizes.has(path)) {
          const assetType = this.detectAssetType(asset.className);
          assetSizes.set(path, asset.memorySize ?? this.estimateAssetSize(assetType));
        }
      }
    }

    // 找出重複的資產
    const duplicatedAssets: ChunkDuplicationReport['duplicatedAssets'] = [];
    let totalWastedSizeMB = 0;

    for (const [assetPath, chunks] of assetChunks.entries()) {
      if (chunks.size > 1) {
        const chunkArray = Array.from(chunks);
        const assetSize = assetSizes.get(assetPath) ?? 0;
        // 浪費的大小 = 資產大小 × (重複次數 - 1)
        const wastedSize = assetSize * (chunks.size - 1);
        const wastedSizeMB = wastedSize / (1024 * 1024);

        duplicatedAssets.push({
          assetPath,
          chunks: chunkArray,
          estimatedWastedSizeMB: Math.round(wastedSizeMB * 100) / 100,
        });

        totalWastedSizeMB += wastedSizeMB;
      }
    }

    // 產生建議
    const recommendations: string[] = [];

    if (duplicatedAssets.length > 0) {
      recommendations.push(
        `發現 ${duplicatedAssets.length} 個資產被分配到多個 Chunk，造成約 ${totalWastedSizeMB.toFixed(2)}MB 的包體膨脹`
      );
      recommendations.push(
        '考慮將共用資產移至獨立的共用 Chunk，或調整 Chunk 分配策略'
      );

      if (duplicatedAssets.length > 10) {
        recommendations.push(
          '重複資產數量較多，建議檢視 Primary Asset Rules 設定'
        );
      }
    }

    const report: ChunkDuplicationReport = {
      duplicatedAssets,
      totalWastedSizeMB: Math.round(totalWastedSizeMB * 100) / 100,
      recommendations,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(report));
    this.cacheManager.set(CACHE_KEYS.CHUNK_DUPLICATION, hash, report);

    this.logger.info('Chunk duplication analysis completed', {
      duplicatedCount: duplicatedAssets.length,
      wastedSizeMB: totalWastedSizeMB.toFixed(2),
    });

    return report;
  }


  /**
   * 取得刪除影響分析
   * 
   * 分析刪除指定資產會影響哪些其他資產
   * 
   * @param assetPath - 計畫刪除的資產路徑
   * @returns 影響分析結果
   */
  async getImpactAnalysis(assetPath: string): Promise<ImpactAnalysis> {
    this.logger.info(`Analyzing impact of deleting: ${assetPath}`);

    // 檢查快取
    const cacheKey = `${CACHE_KEYS.IMPACT_ANALYSIS}_${assetPath}`;
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug('Using cached impact analysis');
      return cached.result as ImpactAnalysis;
    }

    // 取得資產的直接參照
    const depInfo = await this.getAssetDependencyInfo(assetPath);
    const directReferences = depInfo.referencedBy ?? [];

    // 遞迴找出所有間接參照
    const indirectReferences: string[] = [];
    const visited = new Set<string>([assetPath, ...directReferences]);

    const findIndirectRefs = async (refs: string[]): Promise<void> => {
      for (const refPath of refs) {
        const refInfo = await this.getAssetDependencyInfo(refPath);
        const parentRefs = refInfo.referencedBy ?? [];

        for (const parentRef of parentRefs) {
          if (!visited.has(parentRef)) {
            visited.add(parentRef);
            indirectReferences.push(parentRef);
          }
        }

        // 遞迴處理新發現的參照
        const newRefs = parentRefs.filter((r) => !visited.has(r));
        if (newRefs.length > 0) {
          await findIndirectRefs(newRefs);
        }
      }
    };

    await findIndirectRefs(directReferences);

    // 判斷是否安全刪除
    const totalAffectedAssets = directReferences.length + indirectReferences.length;
    const safeToDelete = totalAffectedAssets === 0;

    // 產生警告
    const warnings: string[] = [];

    if (directReferences.length > 0) {
      warnings.push(
        `此資產被 ${directReferences.length} 個資產直接參照，刪除後這些資產將出現參照錯誤`
      );
    }

    if (indirectReferences.length > 0) {
      warnings.push(
        `此資產被 ${indirectReferences.length} 個資產間接參照，刪除可能造成連鎖影響`
      );
    }

    if (this.isRootAsset(assetPath)) {
      warnings.push('此資產可能是根資產（如關卡、GameMode），刪除需特別謹慎');
    }

    // 檢查是否有重要資產被影響
    const criticalRefs = [...directReferences, ...indirectReferences].filter(
      (ref) => this.isRootAsset(ref)
    );
    if (criticalRefs.length > 0) {
      warnings.push(
        `刪除此資產將影響 ${criticalRefs.length} 個重要資產（如關卡、GameMode）`
      );
    }

    const analysis: ImpactAnalysis = {
      targetAsset: assetPath,
      directReferences,
      indirectReferences,
      totalAffectedAssets,
      safeToDelete,
      warnings,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(analysis));
    this.cacheManager.set(cacheKey, hash, analysis);

    this.logger.info('Impact analysis completed', {
      targetAsset: assetPath,
      directRefs: directReferences.length,
      indirectRefs: indirectReferences.length,
      safeToDelete,
    });

    return analysis;
  }

  /**
   * 分析 World Partition 依賴
   * 
   * 分析 World Partition Data Layer 之間的依賴關係
   * 
   * @returns World Partition 依賴報告
   */
  async analyzeWorldPartitionDependencies(): Promise<WorldPartitionDependencyReport> {
    this.logger.info('Analyzing World Partition dependencies');

    // 檢查快取
    const cached = this.cacheManager.get(CACHE_KEYS.WORLD_PARTITION);
    if (cached) {
      this.logger.debug('Using cached World Partition analysis');
      return cached.result as WorldPartitionDependencyReport;
    }

    // 取得 Data Layer 列表
    const layersResult = await this.mcpClient.manageLevelStructure<DataLayerInfo[]>(
      'get_level_structure_info',
      { includeDataLayers: true }
    );

    const layers = Array.isArray(layersResult.data) ? layersResult.data : [];

    // 建立 Data Layer 資訊
    const dataLayers: WorldPartitionDependencyReport['dataLayers'] = [];
    const layerAssets = new Map<string, Set<string>>();
    const assetToLayer = new Map<string, string>();

    // 收集每個 Layer 的資產
    for (const layer of layers) {
      const layerName = layer.name ?? 'Unknown';
      const assets = layer.assets ?? [];

      layerAssets.set(layerName, new Set(assets));

      for (const asset of assets) {
        assetToLayer.set(asset, layerName);
      }
    }

    // 分析每個 Layer 的依賴
    const crossLayerDependencies: WorldPartitionDependencyReport['crossLayerDependencies'] = [];

    for (const layer of layers) {
      const layerName = layer.name ?? 'Unknown';
      const assets = layer.assets ?? [];

      const dependencies = new Set<string>();
      const dependents = new Set<string>();

      // 分析此 Layer 中每個資產的依賴
      for (const assetPath of assets) {
        const depInfo = await this.getAssetDependencyInfo(assetPath);

        // 找出依賴的其他 Layer
        for (const dep of depInfo.dependencies ?? []) {
          const depLayer = assetToLayer.get(dep);
          if (depLayer && depLayer !== layerName) {
            dependencies.add(depLayer);

            // 記錄跨 Layer 依賴
            const existingCross = crossLayerDependencies.find(
              (c) => c.from === layerName && c.to === depLayer
            );
            if (existingCross) {
              existingCross.assets.push(assetPath);
            } else {
              crossLayerDependencies.push({
                from: layerName,
                to: depLayer,
                assets: [assetPath],
              });
            }
          }
        }

        // 找出被其他 Layer 依賴
        for (const ref of depInfo.referencedBy ?? []) {
          const refLayer = assetToLayer.get(ref);
          if (refLayer && refLayer !== layerName) {
            dependents.add(refLayer);
          }
        }
      }

      dataLayers.push({
        name: layerName,
        dependencies: Array.from(dependencies),
        dependents: Array.from(dependents),
      });
    }

    // 產生建議
    const recommendations: string[] = [];

    // 檢查循環依賴
    const circularDeps = this.findCircularLayerDependencies(dataLayers);
    if (circularDeps.length > 0) {
      recommendations.push(
        `發現 Data Layer 循環依賴：${circularDeps.join(' → ')}，建議重新規劃 Layer 結構`
      );
    }

    // 檢查過多跨 Layer 依賴
    if (crossLayerDependencies.length > 10) {
      recommendations.push(
        `跨 Layer 依賴數量較多 (${crossLayerDependencies.length})，可能影響串流效能，建議檢視資產分配`
      );
    }

    // 檢查單向依賴
    for (const layer of dataLayers) {
      if (layer.dependencies.length > 3) {
        recommendations.push(
          `Layer "${layer.name}" 依賴 ${layer.dependencies.length} 個其他 Layer，考慮將共用資產移至獨立 Layer`
        );
      }
    }

    const report: WorldPartitionDependencyReport = {
      dataLayers,
      crossLayerDependencies,
      recommendations,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(report));
    this.cacheManager.set(CACHE_KEYS.WORLD_PARTITION, hash, report);

    this.logger.info('World Partition analysis completed', {
      layerCount: dataLayers.length,
      crossLayerDeps: crossLayerDependencies.length,
    });

    return report;
  }


  // ─── 私有輔助方法 ───

  /**
   * 取得資產依賴資訊
   */
  private async getAssetDependencyInfo(assetPath: string): Promise<AssetDependencyInfo> {
    const result = await this.mcpClient.manageAsset<AssetDependencyInfo>(
      'get_dependencies',
      { assetPath }
    );

    if (result.success && result.data) {
      return result.data;
    }

    return { assetPath, dependencies: [], referencedBy: [] };
  }

  /**
   * 從類別名稱偵測資產類型
   */
  private detectAssetType(className?: string): AssetType {
    if (!className) return 'Blueprint';
    return CLASS_TO_ASSET_TYPE[className] ?? 'Blueprint';
  }

  /**
   * 判斷是否為根資產
   */
  private isRootAsset(assetPath: string): boolean {
    return ROOT_ASSET_PATTERNS.some((pattern) => pattern.test(assetPath));
  }

  /**
   * 估算資產大小（bytes）
   */
  private estimateAssetSize(assetType: AssetType): number {
    const sizeMB = DEFAULT_ASSET_SIZES[assetType] ?? 0.5;
    return sizeMB * 1024 * 1024;
  }

  /**
   * 建議孤立資產的處理方式
   */
  private suggestOrphanAction(assetPath: string, assetType: AssetType): 'delete' | 'reconnect' {
    // 重要資產類型建議重新連結
    if (['Blueprint', 'Material', 'AnimSequence', 'AnimMontage'].includes(assetType)) {
      return 'reconnect';
    }

    // 測試或暫存資產建議刪除
    if (/test|temp|tmp|backup|old|deprecated/i.test(assetPath)) {
      return 'delete';
    }

    // 預設建議刪除
    return 'delete';
  }

  /**
   * 偵測 Data Layer 循環依賴
   */
  private findCircularLayerDependencies(
    layers: WorldPartitionDependencyReport['dataLayers']
  ): string[] {
    const layerMap = new Map<string, string[]>();
    for (const layer of layers) {
      layerMap.set(layer.name, layer.dependencies);
    }

    // DFS 偵測循環
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycle: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      inStack.add(node);

      const deps = layerMap.get(node) ?? [];
      for (const dep of deps) {
        if (inStack.has(dep)) {
          // 找到循環
          cycle.push(dep);
          cycle.push(node);
          return true;
        }
        if (!visited.has(dep)) {
          if (dfs(dep)) {
            return true;
          }
        }
      }

      inStack.delete(node);
      return false;
    };

    for (const layer of layers) {
      if (!visited.has(layer.name)) {
        if (dfs(layer.name)) {
          break;
        }
      }
    }

    return cycle;
  }
}
