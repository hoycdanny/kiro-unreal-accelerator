/**
 * AssetAnalyzer
 * 
 * 資產分析模組
 * 提供資產類型偵測、Nanite 相容性驗證、資產分析與批次預設套用功能
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import type {
  AssetType,
  AssetPreset,
  AssetAnalysisResult,
  NaniteValidation,
  ApplyResult,
} from '../types/asset.js';
import type { Issue, Severity } from '../types/analysis.js';

/**
 * MCP inspect 回傳的資產詳細資訊
 */
interface AssetDetails {
  assetPath?: string;
  className?: string;
  triangleCount?: number;
  hasSkinning?: boolean;
  hasDeformation?: boolean;
  memorySize?: number;
  textureSize?: number;
  compressionSettings?: string;
  naniteEnabled?: boolean;
  [key: string]: unknown;
}

/**
 * Nanite 相容性門檻
 */
const NANITE_MIN_TRIANGLE_COUNT = 10000;

/**
 * 資產類型偵測模式
 */
const ASSET_TYPE_PATTERNS: Array<{ pattern: RegExp; type: AssetType }> = [
  { pattern: /^T_|_T$|Texture|\.png$|\.jpg$|\.tga$/i, type: 'Texture2D' },
  { pattern: /^SM_|StaticMesh|_SM$/i, type: 'StaticMesh' },
  { pattern: /^SK_|SkeletalMesh|_SK$/i, type: 'SkeletalMesh' },
  { pattern: /^MI_|MaterialInstance|_MI$/i, type: 'MaterialInstance' },
  { pattern: /^M_|Material|_M$/i, type: 'Material' },
  { pattern: /^SW_|SoundWave|\.wav$|\.ogg$/i, type: 'SoundWave' },
  { pattern: /^SC_|SoundCue|_SC$/i, type: 'SoundCue' },
  { pattern: /^BP_|Blueprint|_BP$/i, type: 'Blueprint' },
  { pattern: /^AS_|AnimSequence|_AS$/i, type: 'AnimSequence' },
  { pattern: /^AM_|AnimMontage|_AM$/i, type: 'AnimMontage' },
  { pattern: /^PS_|ParticleSystem|_PS$/i, type: 'ParticleSystem' },
  { pattern: /^NS_|NiagaraSystem|_NS$/i, type: 'NiagaraSystem' },
];

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
 * 資產類型對應的建議預設
 */
const SUGGESTED_PRESETS: Record<AssetType, string> = {
  'Texture2D': 'texture-2d-diffuse',
  'StaticMesh': 'static-mesh-standard',
  'SkeletalMesh': 'skeletal-mesh-character',
  'Material': 'material-pbr',
  'MaterialInstance': 'material-pbr',
  'SoundWave': 'sound-sfx',
  'SoundCue': 'sound-sfx',
  'Blueprint': 'blueprint-base',
  'AnimSequence': 'anim-sequence',
  'AnimMontage': 'anim-montage',
  'ParticleSystem': 'particle-system',
  'NiagaraSystem': 'niagara-system',
};

/**
 * 建立 Issue 物件
 */
function createIssue(
  id: string,
  severity: Severity,
  category: string,
  title: string,
  description: string,
  affectedAssets: string[]
): Issue {
  return { id, severity, category, title, description, affectedAssets };
}

/**
 * AssetAnalyzer 類別
 * 
 * 提供資產分析功能，包含類型偵測、Nanite 驗證、分析與批次套用預設
 */
export class AssetAnalyzer {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'AssetAnalyzer' });
  }

  /**
   * 偵測資產類型
   * 
   * 根據資產路徑與元資料偵測 AssetType
   * 
   * @param assetPath - 資產路徑
   * @returns 偵測到的資產類型
   */
  async detectAssetType(assetPath: string): Promise<AssetType> {
    this.logger.debug(`Detecting asset type for: ${assetPath}`);

    // 嘗試從 MCP 取得資產詳細資訊
    const inspectResult = await this.mcpClient.inspect<AssetDetails>(
      'get_metadata',
      { assetPath }
    );

    if (inspectResult.success && inspectResult.data?.className) {
      const className = inspectResult.data.className;
      const mappedType = CLASS_TO_ASSET_TYPE[className];
      if (mappedType) {
        this.logger.debug(`Detected type from class name: ${mappedType}`);
        return mappedType;
      }
    }

    // 從路徑模式偵測
    const assetName = assetPath.split('/').pop() || assetPath;
    for (const { pattern, type } of ASSET_TYPE_PATTERNS) {
      if (pattern.test(assetName) || pattern.test(assetPath)) {
        this.logger.debug(`Detected type from pattern: ${type}`);
        return type;
      }
    }

    // 預設為 Blueprint
    this.logger.warn(`Could not detect asset type, defaulting to Blueprint: ${assetPath}`);
    return 'Blueprint';
  }

  /**
   * 驗證 Nanite 相容性
   * 
   * 檢查網格是否符合 Nanite 需求：高面數、無骨骼綁定、無變形
   * 
   * @param meshPath - 網格資產路徑
   * @returns Nanite 驗證結果
   */
  async validateNaniteCompatibility(meshPath: string): Promise<NaniteValidation> {
    this.logger.debug(`Validating Nanite compatibility for: ${meshPath}`);

    const validation: NaniteValidation = {
      compatible: false,
      triangleCount: 0,
      hasSkinning: false,
      hasDeformation: false,
      reasons: [],
      suggestions: [],
    };

    // 取得網格詳細資訊
    const meshResult = await this.mcpClient.inspect<AssetDetails>(
      'get_mesh_details',
      { assetPath: meshPath }
    );

    if (!meshResult.success || !meshResult.data) {
      validation.reasons.push('無法取得網格資訊');
      validation.suggestions.push('請確認資產路徑正確且為有效的網格資產');
      return validation;
    }

    const meshData = meshResult.data;
    validation.triangleCount = meshData.triangleCount ?? 0;
    validation.hasSkinning = meshData.hasSkinning ?? false;
    validation.hasDeformation = meshData.hasDeformation ?? false;

    // 檢查骨骼綁定
    if (validation.hasSkinning) {
      validation.reasons.push('網格具有骨骼綁定，Nanite 不支援骨骼網格');
      validation.suggestions.push('考慮使用傳統 LOD 系統或將動態部分分離');
    }

    // 檢查變形
    if (validation.hasDeformation) {
      validation.reasons.push('網格具有變形目標，Nanite 不支援變形');
      validation.suggestions.push('移除變形目標或使用傳統網格');
    }

    // 檢查面數
    if (validation.triangleCount < NANITE_MIN_TRIANGLE_COUNT) {
      validation.reasons.push(
        `面數過低 (${validation.triangleCount})，Nanite 適用於高面數網格 (>${NANITE_MIN_TRIANGLE_COUNT})`
      );
      validation.suggestions.push('對於低面數網格，使用傳統 LOD 系統更有效率');
    }

    // 判斷相容性
    validation.compatible =
      !validation.hasSkinning &&
      !validation.hasDeformation &&
      validation.triangleCount >= NANITE_MIN_TRIANGLE_COUNT;

    if (validation.compatible) {
      this.logger.info(`Mesh is Nanite compatible: ${meshPath}`);
    } else {
      this.logger.info(`Mesh is not Nanite compatible: ${meshPath}`, {
        reasons: validation.reasons,
      });
    }

    return validation;
  }

  /**
   * 分析單一資產
   * 
   * 分析資產並回傳完整的分析結果
   * 
   * @param assetPath - 資產路徑
   * @returns 資產分析結果
   */
  async analyzeAsset(assetPath: string): Promise<AssetAnalysisResult> {
    this.logger.debug(`Analyzing asset: ${assetPath}`);

    // 檢查快取
    const cached = this.cacheManager.get(assetPath);
    if (cached) {
      this.logger.debug(`Using cached analysis for: ${assetPath}`);
      return cached.result as AssetAnalysisResult;
    }

    // 偵測資產類型
    const assetType = await this.detectAssetType(assetPath);

    // 初始化結果
    const result: AssetAnalysisResult = {
      assetPath,
      assetType,
      detectedIssues: [],
      suggestedPreset: SUGGESTED_PRESETS[assetType] || null,
      naniteCompatible: false,
      estimatedMemory: 0,
    };

    // 取得資產詳細資訊
    const assetDetails = await this.mcpClient.inspect<AssetDetails>(
      'get_metadata',
      { assetPath }
    );

    if (assetDetails.success && assetDetails.data) {
      result.estimatedMemory = assetDetails.data.memorySize ?? 0;
    }

    // 針對 StaticMesh 進行 Nanite 驗證
    if (assetType === 'StaticMesh') {
      const naniteValidation = await this.validateNaniteCompatibility(assetPath);
      result.naniteCompatible = naniteValidation.compatible;

      // 如果符合 Nanite 條件，建議使用 Nanite 預設
      if (naniteValidation.compatible) {
        result.suggestedPreset = 'static-mesh-nanite';
      }

      // 加入 Nanite 相關問題
      if (!naniteValidation.compatible && naniteValidation.triangleCount >= NANITE_MIN_TRIANGLE_COUNT) {
        for (const reason of naniteValidation.reasons) {
          result.detectedIssues.push(
            createIssue(
              `nanite-incompatible-${result.detectedIssues.length}`,
              'warning',
              'nanite',
              'Nanite 不相容',
              reason,
              [assetPath]
            )
          );
        }
      }
    }

    // 針對 Texture2D 進行檢查
    if (assetType === 'Texture2D' && assetDetails.success && assetDetails.data) {
      const textureSize = assetDetails.data.textureSize ?? 0;
      
      // 檢查貼圖尺寸是否為 2 的冪次
      if (textureSize > 0 && !this.isPowerOfTwo(textureSize)) {
        result.detectedIssues.push(
          createIssue(
            'texture-non-power-of-two',
            'warning',
            'texture',
            '貼圖尺寸非 2 的冪次',
            `貼圖尺寸 ${textureSize} 不是 2 的冪次，可能影響效能`,
            [assetPath]
          )
        );
      }

      // 檢查貼圖是否過大
      if (textureSize > 4096) {
        result.detectedIssues.push(
          createIssue(
            'texture-too-large',
            'warning',
            'texture',
            '貼圖尺寸過大',
            `貼圖尺寸 ${textureSize} 超過 4096，可能影響記憶體使用`,
            [assetPath]
          )
        );
      }
    }

    // 儲存到快取
    const hash = this.cacheManager.computeHash(assetPath + JSON.stringify(result));
    this.cacheManager.set(assetPath, hash, result);

    this.logger.info(`Asset analysis completed: ${assetPath}`, {
      assetType,
      issueCount: result.detectedIssues.length,
    });

    return result;
  }

  /**
   * 批次套用預設設定
   * 
   * 對多個資產套用預設設定，驗證不通過時回傳不相容原因與替代建議
   * 
   * @param assetPaths - 資產路徑列表
   * @param preset - 要套用的預設設定
   * @returns 套用結果列表
   */
  async batchApplyPreset(
    assetPaths: string[],
    preset: AssetPreset
  ): Promise<ApplyResult[]> {
    this.logger.info(`Batch applying preset "${preset.name}" to ${assetPaths.length} assets`);

    const results: ApplyResult[] = [];

    for (const assetPath of assetPaths) {
      const result = await this.applyPresetToAsset(assetPath, preset);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.info(`Batch apply completed: ${successCount}/${assetPaths.length} successful`);

    return results;
  }

  /**
   * 對單一資產套用預設設定
   */
  private async applyPresetToAsset(
    assetPath: string,
    preset: AssetPreset
  ): Promise<ApplyResult> {
    this.logger.debug(`Applying preset "${preset.name}" to: ${assetPath}`);

    // 偵測資產類型
    const assetType = await this.detectAssetType(assetPath);

    // 檢查資產類型是否與預設相容
    if (assetType !== preset.assetType) {
      return {
        assetPath,
        success: false,
        failureReason: `資產類型不匹配：預期 ${preset.assetType}，實際為 ${assetType}`,
        alternativeSuggestions: [
          `使用適合 ${assetType} 的預設設定`,
          SUGGESTED_PRESETS[assetType] || '請選擇其他預設',
        ],
      };
    }

    // 執行需求檢查
    if (preset.requirements) {
      const requirementResult = await this.checkRequirements(assetPath, preset.requirements);
      if (!requirementResult.passed) {
        return {
          assetPath,
          success: false,
          failureReason: requirementResult.failureReason,
          alternativeSuggestions: requirementResult.suggestions,
        };
      }
    }

    // 執行驗證規則
    if (preset.validations) {
      const validationResult = await this.runValidations(assetPath, preset.validations);
      if (!validationResult.passed) {
        return {
          assetPath,
          success: false,
          failureReason: validationResult.failureReason,
          alternativeSuggestions: validationResult.suggestions,
        };
      }
    }

    // 套用設定
    const applyResult = await this.mcpClient.manageAsset('set_metadata', {
      assetPath,
      metadata: preset.settings,
    });

    if (!applyResult.success) {
      return {
        assetPath,
        success: false,
        failureReason: applyResult.error?.message || '套用設定失敗',
        alternativeSuggestions: ['請檢查資產是否可編輯', '確認 Unreal Editor 已開啟'],
      };
    }

    return {
      assetPath,
      success: true,
      appliedSettings: preset.settings,
    };
  }

  /**
   * 檢查需求
   */
  private async checkRequirements(
    assetPath: string,
    requirements: AssetPreset['requirements']
  ): Promise<{ passed: boolean; failureReason?: string; suggestions?: string[] }> {
    if (!requirements || requirements.length === 0) {
      return { passed: true };
    }

    // 取得資產詳細資訊
    const assetDetails = await this.mcpClient.inspect<AssetDetails>(
      'get_mesh_details',
      { assetPath }
    );

    for (const req of requirements) {
      switch (req.check) {
        case 'minTriangleCount': {
          const triangleCount = assetDetails.data?.triangleCount ?? 0;
          const minCount = typeof req.value === 'number' ? req.value : 0;
          if (triangleCount < minCount) {
            return {
              passed: false,
              failureReason: `${req.message}（當前面數：${triangleCount}，需求：>=${minCount}）`,
              suggestions: [
                '使用傳統 LOD 系統',
                '選擇適合低面數網格的預設',
              ],
            };
          }
          break;
        }
        case 'noSkinning': {
          if (assetDetails.data?.hasSkinning) {
            return {
              passed: false,
              failureReason: req.message,
              suggestions: [
                '使用骨骼網格專用預設',
                '將靜態部分分離為獨立網格',
              ],
            };
          }
          break;
        }
        case 'noDeformation': {
          if (assetDetails.data?.hasDeformation) {
            return {
              passed: false,
              failureReason: req.message,
              suggestions: [
                '移除變形目標',
                '使用支援變形的預設',
              ],
            };
          }
          break;
        }
        default:
          this.logger.warn(`Unknown requirement check: ${req.check}`);
      }
    }

    return { passed: true };
  }

  /**
   * 執行驗證規則
   */
  private async runValidations(
    assetPath: string,
    validations: AssetPreset['validations']
  ): Promise<{ passed: boolean; failureReason?: string; suggestions?: string[] }> {
    if (!validations || validations.length === 0) {
      return { passed: true };
    }

    // 取得資產詳細資訊
    const assetDetails = await this.mcpClient.inspect<AssetDetails>(
      'get_metadata',
      { assetPath }
    );

    for (const validation of validations) {
      switch (validation.check) {
        case 'powerOfTwo': {
          const textureSize = assetDetails.data?.textureSize ?? 0;
          if (textureSize > 0 && !this.isPowerOfTwo(textureSize)) {
            return {
              passed: false,
              failureReason: validation.message,
              suggestions: [
                '調整貼圖尺寸為 2 的冪次（如 512、1024、2048）',
                '使用支援非 2 冪次貼圖的預設',
              ],
            };
          }
          break;
        }
        case 'maxSize': {
          const size = assetDetails.data?.textureSize ?? 0;
          const maxSize = typeof validation.value === 'number' ? validation.value : 4096;
          if (size > maxSize) {
            return {
              passed: false,
              failureReason: `${validation.message}（當前尺寸：${size}，最大：${maxSize}）`,
              suggestions: [
                `縮小貼圖尺寸至 ${maxSize} 以下`,
                '使用 Virtual Texture 處理大型貼圖',
              ],
            };
          }
          break;
        }
        default:
          this.logger.warn(`Unknown validation check: ${validation.check}`);
      }
    }

    return { passed: true };
  }

  /**
   * 檢查數字是否為 2 的冪次
   */
  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }
}
