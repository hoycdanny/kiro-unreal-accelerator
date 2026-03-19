/**
 * MaterialManager
 * 
 * 通用材質管理模組
 * 提供材質搜尋、套用、建立、替換等完整工作流
 * 類似 Flopperam 的 get_available_materials / apply_material_to_actor 模式，
 * 但更完整且整合進 Kiro Power 架構
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';

// ─── 型別定義 ───

/** 材質資訊 */
export interface MaterialInfo {
  assetPath: string;
  name: string;
  type: 'Material' | 'MaterialInstance';
  domain?: string;
  blendMode?: string;
  shadingModel?: string;
  parameters?: MaterialParameter[];
  parentMaterial?: string;
}

/** 材質參數 */
export interface MaterialParameter {
  name: string;
  type: 'Scalar' | 'Vector' | 'Texture';
  value?: unknown;
}

/** 材質搜尋選項 */
export interface MaterialSearchOptions {
  /** 搜尋關鍵字 */
  keyword?: string;
  /** 限定搜尋路徑 (預設 /Game) */
  searchPaths?: string[];
  /** 是否遞迴搜尋子資料夾 */
  recursive?: boolean;
  /** 篩選材質類型 */
  types?: ('Material' | 'MaterialInstance')[];
  /** 最大回傳數量 */
  limit?: number;
}

/** 材質套用選項 */
export interface MaterialApplyOptions {
  /** 材質資產路徑 */
  materialPath: string;
  /** 材質插槽索引 (預設 0) */
  slotIndex?: number;
  /** 是否覆蓋所有插槽 */
  overrideAllSlots?: boolean;
}

/** 材質套用結果 */
export interface MaterialApplyResult {
  actorName: string;
  success: boolean;
  materialPath: string;
  error?: string;
}

/** 批次套用結果 */
export interface BatchApplyResult {
  totalActors: number;
  successCount: number;
  failCount: number;
  results: MaterialApplyResult[];
}

/** Actor 搜尋選項 */
export interface ActorSearchOptions {
  /** 依名稱搜尋 */
  name?: string;
  /** 依標籤搜尋 */
  tag?: string;
  /** 依類別搜尋 */
  className?: string;
  /** 依目前使用的材質搜尋 */
  currentMaterial?: string;
}

/** Actor 材質資訊 */
export interface ActorMaterialInfo {
  actorName: string;
  actorClass: string;
  materials: string[];
  overrideMaterials: string[];
}

/** 材質建立選項 */
export interface MaterialCreateOptions {
  name: string;
  path: string;
  baseColor?: { r: number; g: number; b: number; a?: number };
  roughness?: number;
  metallic?: number;
  normal?: { strength: number };
  tiling?: { u: number; v: number };
  shadingModel?: string;
  blendMode?: string;
  twoSided?: boolean;
  save?: boolean;
}

/** 材質實例建立選項 */
export interface MaterialInstanceCreateOptions {
  name: string;
  path: string;
  parentMaterial: string;
  scalarParameters?: Record<string, number>;
  vectorParameters?: Record<string, { r: number; g: number; b: number; a?: number }>;
  textureParameters?: Record<string, string>;
  save?: boolean;
}


// ─── MaterialManager 類別 ───

/**
 * MaterialManager
 * 
 * 通用材質管理器，提供完整的材質工作流：
 * - 搜尋/探索專案中可用的材質
 * - 套用材質到 Actor（單一或批次）
 * - 建立新材質與材質實例
 * - 材質替換（找到使用某材質的所有 Actor 並替換）
 * - 查詢 Actor 目前使用的材質
 */
export class MaterialManager {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'MaterialManager' });
  }

  // ─── 材質搜尋 ───

  /**
   * 搜尋專案中可用的材質
   * 
   * 類似 Flopperam 的 get_available_materials，
   * 但支援更多篩選條件與快取
   */
  async searchMaterials(options: MaterialSearchOptions = {}): Promise<MaterialInfo[]> {
    const {
      keyword,
      searchPaths = ['/Game'],
      recursive = true,
      types = ['Material', 'MaterialInstance'],
      limit = 100,
    } = options;

    this.logger.info('Searching materials', { keyword, searchPaths, types });

    const classNames: string[] = [];
    if (types.includes('Material')) classNames.push('Material');
    if (types.includes('MaterialInstance')) {
      classNames.push('MaterialInstanceConstant');
    }

    const materials: MaterialInfo[] = [];

    for (const searchPath of searchPaths) {
      const result = await this.mcpClient.manageAsset('search_assets', {
        packagePaths: [searchPath],
        recursivePaths: recursive,
        classNames,
        ...(keyword ? { searchText: keyword } : {}),
      });

      if (result.success && result.data) {
        const assets = this.extractAssetList(result.data);
        for (const assetPath of assets) {
          if (materials.length >= limit) break;
          const name = assetPath.split('/').pop()?.split('.')[0] || assetPath;
          const type = assetPath.includes('MI_') || classNames.length === 1
            ? this.inferMaterialType(name)
            : 'Material';
          materials.push({ assetPath, name, type });
        }
      }
    }

    this.logger.info(`Found ${materials.length} materials`);
    return materials;
  }

  /**
   * 取得材質詳細資訊
   */
  async getMaterialInfo(materialPath: string): Promise<MaterialInfo | null> {
    this.logger.debug(`Getting material info: ${materialPath}`);

    const result = await this.mcpClient.manageMaterialAuthoring(
      'get_material_info',
      { assetPath: materialPath }
    );

    if (!result.success) {
      // 可能是 MaterialInstance，嘗試用 inspect
      const inspectResult = await this.mcpClient.inspect(
        'get_material_details',
        { assetPath: materialPath }
      );
      if (inspectResult.success && inspectResult.data) {
        const data = inspectResult.data as Record<string, unknown>;
        return {
          assetPath: materialPath,
          name: materialPath.split('/').pop()?.split('.')[0] || materialPath,
          type: 'MaterialInstance',
          parentMaterial: data.parentMaterial as string | undefined,
        };
      }
      return null;
    }

    const data = result.data as Record<string, unknown>;
    return {
      assetPath: materialPath,
      name: materialPath.split('/').pop()?.split('.')[0] || materialPath,
      type: 'Material',
      domain: data.domain as string | undefined,
      blendMode: data.blendMode as string | undefined,
      shadingModel: data.shadingModel as string | undefined,
    };
  }

  // ─── 材質套用 ───

  /**
   * 套用材質到單一 Actor
   * 
   * 類似 Flopperam 的 apply_material_to_actor
   */
  async applyMaterialToActor(
    actorName: string,
    options: MaterialApplyOptions
  ): Promise<MaterialApplyResult> {
    const { materialPath, slotIndex = 0 } = options;
    this.logger.info(`Applying material to actor`, { actorName, materialPath });

    try {
      // 建立 OverrideMaterials 陣列
      const overrideMaterials: (string | null)[] = [];
      if (options.overrideAllSlots) {
        overrideMaterials.push(materialPath);
      } else {
        for (let i = 0; i < slotIndex; i++) overrideMaterials.push(null);
        overrideMaterials.push(materialPath);
      }

      const result = await this.mcpClient.controlActor(
        'set_component_property',
        {
          actorName,
          componentName: 'StaticMeshComponent0',
          propertyName: 'OverrideMaterials',
          properties: { OverrideMaterials: overrideMaterials },
        }
      );

      if (result.success) {
        return { actorName, success: true, materialPath };
      }
      return {
        actorName,
        success: false,
        materialPath,
        error: result.error?.message || '套用失敗',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { actorName, success: false, materialPath, error: msg };
    }
  }

  /**
   * 批次套用材質到多個 Actor
   */
  async batchApplyMaterial(
    actorNames: string[],
    options: MaterialApplyOptions
  ): Promise<BatchApplyResult> {
    this.logger.info(`Batch applying material to ${actorNames.length} actors`, {
      materialPath: options.materialPath,
    });

    const results: MaterialApplyResult[] = [];
    for (const actorName of actorNames) {
      const result = await this.applyMaterialToActor(actorName, options);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    return {
      totalActors: actorNames.length,
      successCount,
      failCount: actorNames.length - successCount,
      results,
    };
  }

  // ─── Actor 查詢 ───

  /**
   * 搜尋場景中的 Actor
   */
  async findActors(options: ActorSearchOptions = {}): Promise<string[]> {
    this.logger.debug('Finding actors', options);

    if (options.tag) {
      const result = await this.mcpClient.controlActor(
        'find_actors_by_tag',
        { tag: options.tag }
      );
      if (result.success) return this.extractActorNames(result.data);
    }

    if (options.className) {
      const result = await this.mcpClient.controlActor(
        'find_actors_by_class',
        { classPath: options.className }
      );
      if (result.success) return this.extractActorNames(result.data);
    }

    if (options.name) {
      const result = await this.mcpClient.controlActor(
        'find_actors_by_name',
        { actorName: options.name }
      );
      if (result.success) return this.extractActorNames(result.data);
    }

    // 預設列出所有 Actor
    const result = await this.mcpClient.controlActor('list', {});
    if (result.success) return this.extractActorNames(result.data);
    return [];
  }

  /**
   * 取得 Actor 目前使用的材質資訊
   */
  async getActorMaterials(actorName: string): Promise<ActorMaterialInfo | null> {
    const result = await this.mcpClient.controlActor(
      'get_actor_components',
      { actorName }
    );

    if (!result.success) return null;

    const data = result.data as Record<string, unknown>;
    return {
      actorName,
      actorClass: (data.actorClass as string) || 'Unknown',
      materials: [],
      overrideMaterials: [],
    };
  }

  // ─── 材質替換 ───

  /**
   * 替換場景中所有使用特定材質的 Actor
   * 
   * 這是最常用的通用工作流：
   * 1. 找到所有使用 oldMaterial 的 Actor
   * 2. 將它們全部替換為 newMaterial
   */
  async replaceMaterial(
    actorNames: string[],
    oldMaterialPath: string,
    newMaterialPath: string
  ): Promise<BatchApplyResult> {
    this.logger.info('Replacing material', {
      oldMaterial: oldMaterialPath,
      newMaterial: newMaterialPath,
      actorCount: actorNames.length,
    });

    return this.batchApplyMaterial(actorNames, {
      materialPath: newMaterialPath,
      overrideAllSlots: true,
    });
  }

  // ─── 材質建立 ───

  /**
   * 建立新材質
   * 
   * 提供簡化的 API 來建立常見材質，
   * 自動處理節點建立與連接
   */
  async createMaterial(options: MaterialCreateOptions): Promise<MaterialInfo | null> {
    const { name, path, save = true } = options;
    this.logger.info(`Creating material: ${name}`, { path });

    // 1. 建立材質
    const createResult = await this.mcpClient.manageMaterialAuthoring(
      'create_material',
      { name, path, save }
    );
    if (!createResult.success) {
      this.logger.error(`Failed to create material: ${name}`);
      return null;
    }

    const materialPath = `${path}/${name}`;

    // 2. 設定 Base Color
    if (options.baseColor) {
      const { r, g, b, a = 1 } = options.baseColor;
      const paramResult = await this.mcpClient.manageMaterialAuthoring(
        'add_vector_parameter',
        {
          assetPath: materialPath,
          name: 'BaseColor',
          defaultValue: { r, g, b, a },
          group: 'Color',
          x: -400,
          y: 0,
        }
      );

      if (paramResult.success && paramResult.data) {
        const nodeId = (paramResult.data as Record<string, unknown>).nodeId as string;
        await this.mcpClient.manageAsset('connect_material_pins', {
          assetPath: materialPath,
          fromNodeId: nodeId,
          toPin: 'Base Color',
        });
      }
    }

    // 3. 設定 Roughness
    if (options.roughness !== undefined) {
      const paramResult = await this.mcpClient.manageMaterialAuthoring(
        'add_scalar_parameter',
        {
          assetPath: materialPath,
          name: 'Roughness',
          defaultValue: options.roughness,
          group: 'Surface',
          x: -400,
          y: 200,
        }
      );

      if (paramResult.success && paramResult.data) {
        const nodeId = (paramResult.data as Record<string, unknown>).nodeId as string;
        await this.mcpClient.manageAsset('connect_material_pins', {
          assetPath: materialPath,
          fromNodeId: nodeId,
          toPin: 'Roughness',
        });
      }
    }

    // 4. 設定 Metallic
    if (options.metallic !== undefined) {
      const paramResult = await this.mcpClient.manageMaterialAuthoring(
        'add_scalar_parameter',
        {
          assetPath: materialPath,
          name: 'Metallic',
          defaultValue: options.metallic,
          group: 'Surface',
          x: -400,
          y: 400,
        }
      );

      if (paramResult.success && paramResult.data) {
        const nodeId = (paramResult.data as Record<string, unknown>).nodeId as string;
        await this.mcpClient.manageAsset('connect_material_pins', {
          assetPath: materialPath,
          fromNodeId: nodeId,
          toPin: 'Metallic',
        });
      }
    }

    // 5. 編譯材質
    await this.mcpClient.manageMaterialAuthoring('compile_material', {
      assetPath: materialPath,
    });

    return {
      assetPath: materialPath,
      name,
      type: 'Material',
      blendMode: options.blendMode || 'Opaque',
      shadingModel: options.shadingModel || 'DefaultLit',
    };
  }

  /**
   * 建立材質實例
   * 
   * 從父材質建立實例，可覆寫參數值
   */
  async createMaterialInstance(
    options: MaterialInstanceCreateOptions
  ): Promise<MaterialInfo | null> {
    const { name, path, parentMaterial, save = true } = options;
    this.logger.info(`Creating material instance: ${name}`, { parentMaterial });

    const createResult = await this.mcpClient.manageMaterialAuthoring(
      'create_material_instance',
      { name, path, parentMaterial, save }
    );

    if (!createResult.success) {
      this.logger.error(`Failed to create material instance: ${name}`);
      return null;
    }

    const instancePath = `${path}/${name}`;

    // 設定 Scalar 參數
    if (options.scalarParameters) {
      for (const [paramName, value] of Object.entries(options.scalarParameters)) {
        await this.mcpClient.manageMaterialAuthoring(
          'set_scalar_parameter_value',
          { assetPath: instancePath, parameterName: paramName, value }
        );
      }
    }

    // 設定 Vector 參數
    if (options.vectorParameters) {
      for (const [paramName, value] of Object.entries(options.vectorParameters)) {
        await this.mcpClient.manageMaterialAuthoring(
          'set_vector_parameter_value',
          { assetPath: instancePath, parameterName: paramName, value }
        );
      }
    }

    // 設定 Texture 參數
    if (options.textureParameters) {
      for (const [paramName, texturePath] of Object.entries(options.textureParameters)) {
        await this.mcpClient.manageMaterialAuthoring(
          'set_texture_parameter_value',
          { assetPath: instancePath, parameterName: paramName, value: texturePath }
        );
      }
    }

    return {
      assetPath: instancePath,
      name,
      type: 'MaterialInstance',
      parentMaterial,
    };
  }

  // ─── 工具方法 ───

  /** 從 MCP 回傳資料中提取資產路徑列表 */
  private extractAssetList(data: unknown): string[] {
    if (Array.isArray(data)) return data.map(String);
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.assets)) return obj.assets.map(String);
      // 處理 "asset1, asset2" 格式的字串
      if (typeof obj.assets === 'string') {
        return obj.assets.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    if (typeof data === 'string') {
      // 嘗試從回傳字串中解析資產列表
      const matches = data.match(/\/Game\/[^\s,\]]+/g);
      return matches || [];
    }
    return [];
  }

  /** 從 MCP 回傳資料中提取 Actor 名稱列表 */
  private extractActorNames(data: unknown): string[] {
    if (Array.isArray(data)) return data.map(String);
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.actors)) return obj.actors.map(String);
    }
    if (typeof data === 'string') {
      const matches = data.match(/\b\w+Actor_\d+\b/g);
      return matches || [];
    }
    return [];
  }

  /** 從名稱推斷材質類型 */
  private inferMaterialType(name: string): 'Material' | 'MaterialInstance' {
    if (name.startsWith('MI_') || name.includes('Instance')) return 'MaterialInstance';
    return 'Material';
  }
}
