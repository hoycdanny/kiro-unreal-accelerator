/**
 * CodeQualityAnalyzer
 * 
 * 程式碼品質分析模組
 * 提供命名規範檢查、循環依賴偵測、Blueprint/C++ 平衡分析與重構建議
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import type {
  CodeQualityReport,
  QualitySummary,
  NamingViolation,
  CircularDependency,
  BalanceAnalysis,
  ArchitectureIssue,
  Recommendation,
  Severity,
} from '../types/analysis.js';
import type { RefactoringSuggestion } from '../types/analysis.js';

// ─── MCP 回傳資料介面 ───

interface AssetListItem {
  assetPath?: string;
  name?: string;
  className?: string;
  [key: string]: unknown;
}

interface DependencyInfo {
  assetPath?: string;
  dependencies?: string[];
  referencedBy?: string[];
  [key: string]: unknown;
}

interface BlueprintInfo {
  blueprintPath?: string;
  name?: string;
  parentClass?: string;
  nodeCount?: number;
  functionCount?: number;
  variableCount?: number;
  hasNativizedCode?: boolean;
  complexity?: number;
  [key: string]: unknown;
}

// ─── UE 命名規範 ───

/**
 * Unreal Engine 資產命名規範
 * 格式: [Prefix]_[Name]
 */
const NAMING_CONVENTIONS: Array<{
  className: string;
  prefix: string;
  label: string;
}> = [
  { className: 'Texture2D', prefix: 'T_', label: 'Texture' },
  { className: 'StaticMesh', prefix: 'SM_', label: 'Static Mesh' },
  { className: 'SkeletalMesh', prefix: 'SK_', label: 'Skeletal Mesh' },
  { className: 'Material', prefix: 'M_', label: 'Material' },
  { className: 'MaterialInstanceConstant', prefix: 'MI_', label: 'Material Instance' },
  { className: 'MaterialInstance', prefix: 'MI_', label: 'Material Instance' },
  { className: 'Blueprint', prefix: 'BP_', label: 'Blueprint' },
  { className: 'BlueprintGeneratedClass', prefix: 'BP_', label: 'Blueprint' },
  { className: 'SoundWave', prefix: 'SW_', label: 'Sound Wave' },
  { className: 'SoundCue', prefix: 'SC_', label: 'Sound Cue' },
  { className: 'AnimSequence', prefix: 'AS_', label: 'Anim Sequence' },
  { className: 'AnimMontage', prefix: 'AM_', label: 'Anim Montage' },
  { className: 'ParticleSystem', prefix: 'PS_', label: 'Particle System' },
  { className: 'NiagaraSystem', prefix: 'NS_', label: 'Niagara System' },
  { className: 'WidgetBlueprint', prefix: 'WBP_', label: 'Widget Blueprint' },
  { className: 'AnimBlueprint', prefix: 'ABP_', label: 'Anim Blueprint' },
];

// ─── 門檻設定 ───

const THRESHOLDS = {
  /** Blueprint 節點數量上限（超過建議移至 C++） */
  MAX_BLUEPRINT_NODES: 200,
  /** Blueprint 佔比上限（建議 C++ 處理核心邏輯） */
  MAX_BLUEPRINT_PERCENTAGE: 80,
  /** Blueprint 佔比下限（建議 Blueprint 處理遊戲邏輯） */
  MIN_BLUEPRINT_PERCENTAGE: 20,
  /** 高複雜度 Blueprint 門檻 */
  HIGH_COMPLEXITY_THRESHOLD: 50,
};

// ─── 快取鍵 ───

const CACHE_KEYS = {
  PROJECT_ANALYSIS: '__cq_project_analysis__',
  NAMING_VIOLATIONS: '__cq_naming_violations__',
  CIRCULAR_DEPS: '__cq_circular_deps__',
  BALANCE: '__cq_balance__',
};


/**
 * CodeQualityAnalyzer 類別
 * 
 * 提供程式碼品質分析功能，包含命名規範檢查、循環依賴偵測、
 * Blueprint/C++ 平衡分析與重構建議
 */
export class CodeQualityAnalyzer {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'CodeQualityAnalyzer' });
  }

  /**
   * 分析專案程式碼品質
   * 
   * 掃描專案並產出完整的 CodeQualityReport
   * 
   * @returns 程式碼品質報告
   */
  async analyzeProject(): Promise<CodeQualityReport> {
    this.logger.info('Starting project code quality analysis');

    // 檢查快取
    const cached = this.cacheManager.get(CACHE_KEYS.PROJECT_ANALYSIS);
    if (cached) {
      this.logger.debug('Using cached project analysis');
      return cached.result as CodeQualityReport;
    }

    // 並行執行各項分析
    const [namingViolations, circularDependencies, blueprintCppBalance] =
      await Promise.all([
        this.checkNamingConventions(),
        this.detectCircularDependencies(),
        this.analyzeBlueprintCppBalance(),
      ]);

    // 收集架構問題
    const architectureIssues = this.collectArchitectureIssues(
      namingViolations,
      circularDependencies,
      blueprintCppBalance
    );

    // 產生建議
    const recommendations = this.generateRecommendations(
      namingViolations,
      circularDependencies,
      blueprintCppBalance,
      architectureIssues
    );

    // 計算摘要
    const summary = this.computeSummary(
      namingViolations,
      circularDependencies,
      architectureIssues
    );

    const report: CodeQualityReport = {
      timestamp: new Date().toISOString(),
      summary,
      namingViolations,
      circularDependencies,
      blueprintCppBalance,
      architectureIssues,
      recommendations,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(report));
    this.cacheManager.set(CACHE_KEYS.PROJECT_ANALYSIS, hash, report);

    this.logger.info('Project code quality analysis completed', {
      overallScore: summary.overallScore,
      totalIssues: summary.totalIssues,
    });

    return report;
  }

  /**
   * 檢查命名規範
   * 
   * 根據 Unreal Engine 命名規範檢查資產名稱
   * - T_ for textures
   * - SM_ for static meshes
   * - SK_ for skeletal meshes
   * - M_ for materials
   * - BP_ for blueprints
   * 等等
   * 
   * @param paths - 可選的資產路徑列表，若未提供則掃描整個專案
   * @returns 命名違規列表
   */
  async checkNamingConventions(paths?: string[]): Promise<NamingViolation[]> {
    this.logger.debug('Checking naming conventions');

    // 如果沒有指定路徑，檢查快取
    if (!paths) {
      const cached = this.cacheManager.get(CACHE_KEYS.NAMING_VIOLATIONS);
      if (cached) {
        return cached.result as NamingViolation[];
      }
    }

    const violations: NamingViolation[] = [];

    // 取得資產列表
    let assets: AssetListItem[] = [];
    if (paths && paths.length > 0) {
      // 逐一取得指定路徑的資產資訊
      for (const assetPath of paths) {
        const result = await this.mcpClient.inspect<AssetListItem>(
          'get_metadata',
          { assetPath }
        );
        if (result.success && result.data) {
          assets.push({ ...result.data, assetPath });
        }
      }
    } else {
      // 掃描整個專案
      const listResult = await this.mcpClient.manageAsset<AssetListItem[]>(
        'list',
        { path: '/Game' }
      );
      assets = Array.isArray(listResult.data) ? listResult.data : [];
    }

    // 檢查每個資產的命名
    for (const asset of assets) {
      const assetPath = asset.assetPath ?? '';
      const assetName = this.extractAssetName(assetPath);
      const className = asset.className ?? '';

      const convention = NAMING_CONVENTIONS.find((c) => c.className === className);
      if (!convention) continue;

      if (!assetName.startsWith(convention.prefix)) {
        const suggestedName = this.suggestCorrectName(assetName, convention.prefix);
        violations.push({
          assetPath,
          currentName: assetName,
          expectedPattern: `${convention.prefix}[Name] (${convention.label})`,
          suggestedName,
        });
      }
    }

    // 儲存到快取（僅全專案掃描時）
    if (!paths) {
      const hash = this.cacheManager.computeHash(JSON.stringify(violations));
      this.cacheManager.set(CACHE_KEYS.NAMING_VIOLATIONS, hash, violations);
    }

    this.logger.debug('Naming convention check completed', {
      violationCount: violations.length,
    });

    return violations;
  }

  /**
   * 偵測循環依賴
   * 
   * 掃描資產依賴圖並偵測所有循環依賴，對每個環路提供解耦建議
   * 
   * @returns 循環依賴列表
   */
  async detectCircularDependencies(): Promise<CircularDependency[]> {
    this.logger.debug('Detecting circular dependencies');

    const cached = this.cacheManager.get(CACHE_KEYS.CIRCULAR_DEPS);
    if (cached) {
      return cached.result as CircularDependency[];
    }

    // 取得所有資產列表
    const listResult = await this.mcpClient.manageAsset<AssetListItem[]>(
      'list',
      { path: '/Game' }
    );
    const assets = Array.isArray(listResult.data) ? listResult.data : [];

    // 建立依賴圖
    const graph = new Map<string, string[]>();
    for (const asset of assets) {
      const assetPath = asset.assetPath ?? asset.name ?? '';
      if (!assetPath) continue;

      const depResult = await this.mcpClient.manageAsset<DependencyInfo>(
        'get_dependencies',
        { assetPath }
      );

      if (depResult.success && depResult.data?.dependencies) {
        graph.set(assetPath, depResult.data.dependencies);
      } else {
        graph.set(assetPath, []);
      }
    }

    // 使用 DFS 偵測環路
    const cycles = this.findCycles(graph);

    // 轉換為 CircularDependency 格式
    const circularDependencies: CircularDependency[] = cycles.map((cycle) => ({
      chain: cycle,
      severity: this.assessCycleSeverity(cycle) as Severity,
      suggestedFix: this.suggestCycleFix(cycle),
    }));

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(circularDependencies));
    this.cacheManager.set(CACHE_KEYS.CIRCULAR_DEPS, hash, circularDependencies);

    this.logger.debug('Circular dependency detection completed', {
      cycleCount: circularDependencies.length,
    });

    return circularDependencies;
  }

  /**
   * 分析 Blueprint/C++ 職責分配
   * 
   * 檢查專案中 Blueprint 與 C++ 的比例是否合理
   * 
   * @returns 平衡分析結果
   */
  async analyzeBlueprintCppBalance(): Promise<BalanceAnalysis> {
    this.logger.debug('Analyzing Blueprint/C++ balance');

    const cached = this.cacheManager.get(CACHE_KEYS.BALANCE);
    if (cached) {
      return cached.result as BalanceAnalysis;
    }

    // 取得 Blueprint 列表
    const bpResult = await this.mcpClient.manageAsset<AssetListItem[]>(
      'search_assets',
      { classNames: ['Blueprint', 'BlueprintGeneratedClass'] }
    );
    const blueprints = Array.isArray(bpResult.data) ? bpResult.data : [];

    // 取得 C++ 類別列表（透過 inspect 取得原生類別）
    const cppResult = await this.mcpClient.inspect<AssetListItem[]>(
      'find_by_class',
      { className: 'Class', filter: 'native' }
    );
    const cppClasses = Array.isArray(cppResult.data) ? cppResult.data : [];

    const totalCount = blueprints.length + cppClasses.length;
    const blueprintPercentage = totalCount > 0
      ? Math.round((blueprints.length / totalCount) * 100)
      : 50;
    const cppPercentage = 100 - blueprintPercentage;

    const recommendations: string[] = [];
    const issues: ArchitectureIssue[] = [];

    if (blueprintPercentage > THRESHOLDS.MAX_BLUEPRINT_PERCENTAGE) {
      recommendations.push(
        `Blueprint 佔比 (${blueprintPercentage}%) 過高，建議將核心邏輯、效能敏感程式碼移至 C++`
      );
      recommendations.push(
        '使用 C++ 基礎類別搭配 Blueprint 子類別的混合架構'
      );
    }

    if (blueprintPercentage < THRESHOLDS.MIN_BLUEPRINT_PERCENTAGE && totalCount > 0) {
      recommendations.push(
        `Blueprint 佔比 (${blueprintPercentage}%) 過低，建議使用 Blueprint 處理遊戲邏輯與設計師可調參數`
      );
    }

    // 檢查過於複雜的 Blueprint
    for (const bp of blueprints) {
      const bpPath = bp.assetPath ?? bp.name ?? '';
      if (!bpPath) continue;

      const detailResult = await this.mcpClient.manageBlueprint<BlueprintInfo>(
        'get_blueprint',
        { blueprintPath: bpPath }
      );

      if (detailResult.success && detailResult.data) {
        const nodeCount = detailResult.data.nodeCount ?? 0;
        const complexity = detailResult.data.complexity ?? 0;

        if (nodeCount > THRESHOLDS.MAX_BLUEPRINT_NODES) {
          issues.push({
            id: `bp-too-complex-${issues.length}`,
            severity: nodeCount > THRESHOLDS.MAX_BLUEPRINT_NODES * 2 ? 'critical' : 'warning',
            category: 'blueprint-complexity',
            description: `Blueprint "${bpPath}" 有 ${nodeCount} 個節點，超過建議上限 (${THRESHOLDS.MAX_BLUEPRINT_NODES})`,
            affectedFiles: [bpPath],
            suggestedRefactoring: '將複雜邏輯移至 C++ 函數，Blueprint 僅負責呼叫與參數設定',
          });
        }

        if (complexity > THRESHOLDS.HIGH_COMPLEXITY_THRESHOLD) {
          issues.push({
            id: `bp-high-complexity-${issues.length}`,
            severity: 'warning',
            category: 'blueprint-complexity',
            description: `Blueprint "${bpPath}" 複雜度 (${complexity}) 過高`,
            affectedFiles: [bpPath],
            suggestedRefactoring: '拆分為多個子 Blueprint 或使用 Blueprint Function Library',
          });
        }
      }
    }

    const analysis: BalanceAnalysis = {
      blueprintPercentage,
      cppPercentage,
      recommendations,
      issues,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(analysis));
    this.cacheManager.set(CACHE_KEYS.BALANCE, hash, analysis);

    this.logger.debug('Blueprint/C++ balance analysis completed', {
      blueprintPercentage,
      cppPercentage,
    });

    return analysis;
  }

  /**
   * 提供重構建議
   * 
   * 針對指定資產提供重構建議
   * 
   * @param assetPath - 資產路徑
   * @returns 重構建議列表
   */
  async suggestRefactoring(assetPath: string): Promise<RefactoringSuggestion[]> {
    this.logger.debug(`Suggesting refactoring for: ${assetPath}`);

    const suggestions: RefactoringSuggestion[] = [];

    // 取得資產資訊
    const assetResult = await this.mcpClient.inspect<AssetListItem>(
      'get_metadata',
      { assetPath }
    );

    if (!assetResult.success || !assetResult.data) {
      return suggestions;
    }

    const className = assetResult.data.className ?? '';
    const assetName = this.extractAssetName(assetPath);

    // 檢查命名是否需要重構
    const convention = NAMING_CONVENTIONS.find((c) => c.className === className);
    if (convention && !assetName.startsWith(convention.prefix)) {
      suggestions.push({
        id: `rename-${suggestions.length}`,
        type: 'rename',
        description: `資產名稱不符合 ${convention.label} 命名規範`,
        targetAssets: [assetPath],
        steps: [
          `將 "${assetName}" 重新命名為 "${this.suggestCorrectName(assetName, convention.prefix)}"`,
          '更新所有參照此資產的 Blueprint 與程式碼',
        ],
        estimatedEffort: 'low',
      });
    }

    // 如果是 Blueprint，檢查是否需要拆分或移至 C++
    if (className === 'Blueprint' || className === 'BlueprintGeneratedClass') {
      const bpResult = await this.mcpClient.manageBlueprint<BlueprintInfo>(
        'get_blueprint',
        { blueprintPath: assetPath }
      );

      if (bpResult.success && bpResult.data) {
        const nodeCount = bpResult.data.nodeCount ?? 0;
        const functionCount = bpResult.data.functionCount ?? 0;

        if (nodeCount > THRESHOLDS.MAX_BLUEPRINT_NODES) {
          suggestions.push({
            id: `extract-to-cpp-${suggestions.length}`,
            type: 'extract',
            description: `Blueprint 節點數 (${nodeCount}) 過多，建議將核心邏輯提取至 C++`,
            targetAssets: [assetPath],
            steps: [
              '識別效能敏感與複雜的邏輯區塊',
              '建立對應的 C++ 基礎類別',
              '將邏輯移至 C++ 並暴露為 BlueprintCallable 函數',
              '將 Blueprint 改為繼承 C++ 基礎類別',
            ],
            estimatedEffort: 'high',
          });
        }

        if (functionCount > 10) {
          suggestions.push({
            id: `split-functions-${suggestions.length}`,
            type: 'split',
            description: `Blueprint 函數數量 (${functionCount}) 過多，建議拆分`,
            targetAssets: [assetPath],
            steps: [
              '將相關函數分組',
              '建立 Blueprint Function Library 存放共用函數',
              '將特定功能的函數移至獨立的 Component Blueprint',
            ],
            estimatedEffort: 'medium',
          });
        }
      }
    }

    // 檢查依賴是否需要重構
    const depResult = await this.mcpClient.manageAsset<DependencyInfo>(
      'get_dependencies',
      { assetPath }
    );

    if (depResult.success && depResult.data?.dependencies) {
      const deps = depResult.data.dependencies;
      if (deps.length > 20) {
        suggestions.push({
          id: `reduce-dependencies-${suggestions.length}`,
          type: 'extract',
          description: `資產依賴數量 (${deps.length}) 過多，建議解耦`,
          targetAssets: [assetPath],
          steps: [
            '識別可以抽象為介面的依賴',
            '使用 Soft Reference 替代 Hard Reference',
            '考慮使用 Data Asset 或 Data Table 解耦資料依賴',
          ],
          estimatedEffort: 'medium',
        });
      }
    }

    this.logger.debug('Refactoring suggestions generated', {
      assetPath,
      suggestionCount: suggestions.length,
    });

    return suggestions;
  }

  // ─── 私有輔助方法 ───

  /**
   * 從資產路徑提取資產名稱
   */
  private extractAssetName(assetPath: string): string {
    const parts = assetPath.split('/');
    return parts[parts.length - 1] || assetPath;
  }

  /**
   * 建議正確的資產名稱
   */
  private suggestCorrectName(currentName: string, prefix: string): string {
    // 移除已有的錯誤前綴
    for (const conv of NAMING_CONVENTIONS) {
      if (currentName.startsWith(conv.prefix) && conv.prefix !== prefix) {
        currentName = currentName.substring(conv.prefix.length);
        break;
      }
    }
    // 如果名稱已經有正確前綴，直接回傳
    if (currentName.startsWith(prefix)) {
      return currentName;
    }
    return `${prefix}${currentName}`;
  }

  /**
   * 使用 DFS 偵測有向圖中的環路
   */
  private findCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!graph.has(neighbor)) continue;

        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // 找到環路：從 neighbor 在 path 中的位置到當前位置
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = [...path.slice(cycleStart), neighbor];
            cycles.push(cycle);
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * 評估循環依賴的嚴重度
   */
  private assessCycleSeverity(cycle: string[]): string {
    // 環路長度越長，嚴重度越高
    if (cycle.length > 5) return 'critical';
    if (cycle.length > 3) return 'warning';
    return 'warning';
  }

  /**
   * 建議循環依賴的修復方式
   */
  private suggestCycleFix(cycle: string[]): string {
    if (cycle.length === 2) {
      return `考慮將 "${cycle[0]}" 與 "${cycle[1]}" 之間的共用邏輯提取至獨立模組`;
    }
    if (cycle.length <= 4) {
      return `引入介面或抽象類別打破 ${cycle.join(' → ')} 的循環依賴`;
    }
    return `重構依賴鏈 ${cycle.join(' → ')}，考慮使用事件系統或依賴注入解耦`;
  }

  /**
   * 收集架構問題
   */
  private collectArchitectureIssues(
    namingViolations: NamingViolation[],
    circularDependencies: CircularDependency[],
    balanceAnalysis: BalanceAnalysis
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    // 命名違規轉為架構問題
    if (namingViolations.length > 10) {
      issues.push({
        id: 'naming-violations-excessive',
        severity: 'warning',
        category: 'naming',
        description: `專案有 ${namingViolations.length} 個命名違規，影響程式碼可讀性與維護性`,
        affectedFiles: namingViolations.slice(0, 10).map((v) => v.assetPath),
        suggestedRefactoring: '批次重新命名資產以符合 Unreal Engine 命名規範',
      });
    }

    // 循環依賴轉為架構問題
    for (const dep of circularDependencies) {
      issues.push({
        id: `circular-dep-${issues.length}`,
        severity: dep.severity,
        category: 'dependency',
        description: `偵測到循環依賴：${dep.chain.join(' → ')}`,
        affectedFiles: dep.chain.filter((_, i) => i < dep.chain.length - 1),
        suggestedRefactoring: dep.suggestedFix,
      });
    }

    // Blueprint/C++ 平衡問題
    for (const issue of balanceAnalysis.issues) {
      issues.push(issue);
    }

    return issues;
  }

  /**
   * 產生建議
   */
  private generateRecommendations(
    namingViolations: NamingViolation[],
    circularDependencies: CircularDependency[],
    balanceAnalysis: BalanceAnalysis,
    architectureIssues: ArchitectureIssue[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let recId = 0;

    // 命名規範建議
    if (namingViolations.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: namingViolations.length > 20 ? 'high' : 'medium',
        category: 'naming',
        title: '修正資產命名規範',
        description: `發現 ${namingViolations.length} 個命名違規`,
        steps: [
          '使用 Unreal Editor 的批次重新命名功能',
          '遵循 [Type]_[Name] 命名規範（如 T_ 貼圖、SM_ 靜態網格）',
          '更新所有參照以避免斷裂的引用',
        ],
        estimatedImpact: '提升程式碼可讀性與團隊協作效率',
        relatedIssues: architectureIssues
          .filter((i) => i.category === 'naming')
          .map((i) => i.id),
      });
    }

    // 循環依賴建議
    if (circularDependencies.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: circularDependencies.some((d) => d.severity === 'critical') ? 'high' : 'medium',
        category: 'dependency',
        title: '解決循環依賴',
        description: `偵測到 ${circularDependencies.length} 個循環依賴`,
        steps: [
          '識別循環依賴中的核心模組',
          '引入介面或抽象類別打破依賴環路',
          '使用事件系統或委派替代直接引用',
          '考慮使用 Soft Reference 延遲載入',
        ],
        estimatedImpact: '降低模組耦合度，提升編譯速度與可維護性',
        relatedIssues: architectureIssues
          .filter((i) => i.category === 'dependency')
          .map((i) => i.id),
      });
    }

    // Blueprint/C++ 平衡建議
    if (balanceAnalysis.recommendations.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'medium',
        category: 'architecture',
        title: '調整 Blueprint/C++ 職責分配',
        description: `Blueprint 佔比 ${balanceAnalysis.blueprintPercentage}%，C++ 佔比 ${balanceAnalysis.cppPercentage}%`,
        steps: balanceAnalysis.recommendations,
        estimatedImpact: '提升效能與程式碼可維護性',
        relatedIssues: balanceAnalysis.issues.map((i) => i.id),
      });
    }

    // 針對嚴重架構問題產生建議
    const criticalIssues = architectureIssues.filter((i) => i.severity === 'critical');
    for (const issue of criticalIssues) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'high',
        category: issue.category,
        title: `修復嚴重架構問題：${issue.description.substring(0, 50)}`,
        description: issue.description,
        steps: [issue.suggestedRefactoring],
        estimatedImpact: '消除嚴重架構風險',
        relatedIssues: [issue.id],
      });
    }

    return recommendations;
  }

  /**
   * 計算品質摘要
   */
  private computeSummary(
    namingViolations: NamingViolation[],
    circularDependencies: CircularDependency[],
    architectureIssues: ArchitectureIssue[]
  ): QualitySummary {
    const criticalIssues = architectureIssues.filter((i) => i.severity === 'critical').length +
      circularDependencies.filter((d) => d.severity === 'critical').length;
    const warnings = architectureIssues.filter((i) => i.severity === 'warning').length +
      circularDependencies.filter((d) => d.severity === 'warning').length;
    const suggestions = namingViolations.length;

    const totalIssues = criticalIssues + warnings + suggestions;

    // 計算分數 (0-100)
    const namingPenalty = Math.min(20, namingViolations.length * 0.5);
    const cyclePenalty = circularDependencies.length * 5;
    const criticalPenalty = criticalIssues * 15;
    const warningPenalty = warnings * 5;

    const overallScore = Math.max(0, Math.min(100, Math.round(
      100 - namingPenalty - cyclePenalty - criticalPenalty - warningPenalty
    )));

    return {
      overallScore,
      totalIssues,
      criticalIssues,
      warnings,
      suggestions,
    };
  }
}
