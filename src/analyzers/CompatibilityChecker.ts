/**
 * CompatibilityChecker
 * 
 * 平台相容性檢查模組
 * 提供平台相容性掃描、Shader 相容性檢查、記憶體預算驗證與 Scalability 設定驗證
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import type {
  TargetPlatform,
  CompatibilityIssue,
  CompatibilityReport,
  ShaderCompatibility,
  MemoryBudgetAnalysis,
  ScalabilityReport,
  Severity,
} from '../types/analysis.js';

// ─── MCP 回傳資料介面 ───

interface ProjectSettings {
  shaderModel?: string;
  featureLevel?: string;
  naniteEnabled?: boolean;
  lumenEnabled?: boolean;
  rayTracingEnabled?: boolean;
  virtualTextureEnabled?: boolean;
  hardwareRayTracingEnabled?: boolean;
  [key: string]: unknown;
}

interface MemoryStats {
  totalMemoryMB?: number;
  textureMemoryMB?: number;
  meshMemoryMB?: number;
  audioMemoryMB?: number;
  scriptMemoryMB?: number;
  [key: string]: unknown;
}

interface ScalabilitySettings {
  qualityLevels?: string[];
  currentLevel?: string;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ShaderInfo {
  shaders?: Array<{
    name?: string;
    model?: string;
    featureLevel?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ─── 平台規格定義 ───

interface PlatformSpec {
  name: string;
  maxShaderModel: string;
  featureLevel: string;
  memoryBudgetMB: number;
  supportsNanite: boolean;
  supportsLumen: boolean;
  supportsRayTracing: boolean;
  supportsVirtualTexture: boolean;
}

const PLATFORM_SPECS: Record<TargetPlatform, PlatformSpec> = {
  Windows: {
    name: 'Windows',
    maxShaderModel: 'SM6',
    featureLevel: 'SM5',
    memoryBudgetMB: 16384,
    supportsNanite: true,
    supportsLumen: true,
    supportsRayTracing: true,
    supportsVirtualTexture: true,
  },
  Mac: {
    name: 'Mac',
    maxShaderModel: 'SM5',
    featureLevel: 'SM5',
    memoryBudgetMB: 8192,
    supportsNanite: false,
    supportsLumen: true,
    supportsRayTracing: false,
    supportsVirtualTexture: true,
  },
  Linux: {
    name: 'Linux',
    maxShaderModel: 'SM6',
    featureLevel: 'SM5',
    memoryBudgetMB: 16384,
    supportsNanite: true,
    supportsLumen: true,
    supportsRayTracing: true,
    supportsVirtualTexture: true,
  },
  iOS: {
    name: 'iOS',
    maxShaderModel: 'ES3_1',
    featureLevel: 'ES3_1',
    memoryBudgetMB: 2048,
    supportsNanite: false,
    supportsLumen: false,
    supportsRayTracing: false,
    supportsVirtualTexture: false,
  },
  Android: {
    name: 'Android',
    maxShaderModel: 'ES3_1',
    featureLevel: 'ES3_1',
    memoryBudgetMB: 3072,
    supportsNanite: false,
    supportsLumen: false,
    supportsRayTracing: false,
    supportsVirtualTexture: false,
  },
  PS5: {
    name: 'PS5',
    maxShaderModel: 'SM6',
    featureLevel: 'SM5',
    memoryBudgetMB: 12288,
    supportsNanite: true,
    supportsLumen: true,
    supportsRayTracing: true,
    supportsVirtualTexture: true,
  },
  XboxSeriesX: {
    name: 'Xbox Series X',
    maxShaderModel: 'SM6',
    featureLevel: 'SM5',
    memoryBudgetMB: 12288,
    supportsNanite: true,
    supportsLumen: true,
    supportsRayTracing: true,
    supportsVirtualTexture: true,
  },
  Switch: {
    name: 'Nintendo Switch',
    maxShaderModel: 'ES3_1',
    featureLevel: 'ES3_1',
    memoryBudgetMB: 3072,
    supportsNanite: false,
    supportsLumen: false,
    supportsRayTracing: false,
    supportsVirtualTexture: false,
  },
};

/**
 * Shader Model 等級排序（低到高）
 */
const SHADER_MODEL_ORDER: string[] = ['ES2', 'ES3_1', 'SM4', 'SM5', 'SM6'];

// ─── 快取鍵 ───

const CACHE_KEYS = {
  platformPrefix: '__compat_platform_',
  shaderPrefix: '__compat_shader_',
  memoryPrefix: '__compat_memory_',
  scalability: '__compat_scalability__',
};

/**
 * 建立 CompatibilityIssue
 */
function createIssue(
  id: string,
  severity: Severity,
  platform: TargetPlatform,
  category: CompatibilityIssue['category'],
  description: string,
  affectedAssets: string[],
  fix: string
): CompatibilityIssue {
  return { id, severity, platform, category, description, affectedAssets, fix };
}

/**
 * CompatibilityChecker 類別
 * 
 * 提供平台相容性檢查功能，包含 Shader 相容性、記憶體預算驗證與 Scalability 設定驗證
 */
export class CompatibilityChecker {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'CompatibilityChecker' });
  }

  /**
   * 檢查目標平台相容性
   * 
   * 掃描專案並產出完整的 CompatibilityReport
   * Critical 問題時 canBuild 為 false
   * 
   * @param platform - 目標平台
   * @returns 相容性報告
   */
  async checkPlatform(platform: TargetPlatform): Promise<CompatibilityReport> {
    this.logger.info(`Starting compatibility check for platform: ${platform}`);

    const cacheKey = `${CACHE_KEYS.platformPrefix}${platform}`;
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug(`Using cached compatibility report for: ${platform}`);
      return cached.result as CompatibilityReport;
    }

    // 並行執行各項檢查
    const [shaderCompatibility, memoryBudget, featureIssues] = await Promise.all([
      this.checkShaderCompatibility(platform),
      this.checkMemoryBudget(platform),
      this.checkFeatureCompatibility(platform),
    ]);

    // 收集所有問題
    const issues: CompatibilityIssue[] = [];

    // 加入 Shader 相容性問題
    if (!shaderCompatibility.compatible) {
      issues.push(
        createIssue(
          'shader-incompatible',
          'critical',
          platform,
          'shader',
          `Shader Model 不相容：專案使用的 Shader 需要 ${shaderCompatibility.shaderModel}，但 ${platform} 最高支援 ${PLATFORM_SPECS[platform].maxShaderModel}`,
          shaderCompatibility.incompatibleShaders,
          `降低 Shader Model 需求或為 ${platform} 提供替代 Shader`
        )
      );
    }

    // 加入不相容 Shader 的個別問題
    for (const shader of shaderCompatibility.incompatibleShaders) {
      issues.push(
        createIssue(
          `shader-incompatible-${shader.replace(/[^a-zA-Z0-9]/g, '_')}`,
          'warning',
          platform,
          'shader',
          `Shader "${shader}" 不相容於 ${platform}`,
          [shader],
          `為 ${platform} 提供替代 Shader 或降低 Feature Level 需求`
        )
      );
    }

    // 加入記憶體預算問題
    if (memoryBudget.overBudget) {
      issues.push(
        createIssue(
          'memory-over-budget',
          'critical',
          platform,
          'memory',
          `記憶體使用 (${memoryBudget.usedMB}MB) 超過 ${platform} 預算 (${memoryBudget.budgetMB}MB)`,
          [],
          `減少資產大小或啟用串流載入，需要釋放至少 ${Math.abs(memoryBudget.remainingMB)}MB`
        )
      );
    }

    // 加入功能相容性問題
    issues.push(...featureIssues);

    // 判斷 canBuild：有任何 Critical 問題時為 false
    const blockingIssues = issues.filter((i) => i.severity === 'critical');
    const canBuild = blockingIssues.length === 0;

    const report: CompatibilityReport = {
      targetPlatform: platform,
      issues,
      shaderCompatibility,
      memoryBudget,
      canBuild,
      blockingIssues,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(report));
    this.cacheManager.set(cacheKey, hash, report);

    this.logger.info(`Compatibility check completed for ${platform}`, {
      issueCount: issues.length,
      canBuild,
      criticalCount: blockingIssues.length,
    });

    return report;
  }

  /**
   * 檢查 Shader 相容性
   * 
   * 檢查 Shader Feature Level / Shader Model 是否與目標平台相容
   * 
   * @param platform - 目標平台
   * @returns Shader 相容性結果
   */
  async checkShaderCompatibility(platform: TargetPlatform): Promise<ShaderCompatibility> {
    this.logger.debug(`Checking shader compatibility for: ${platform}`);

    const cacheKey = `${CACHE_KEYS.shaderPrefix}${platform}`;
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      return cached.result as ShaderCompatibility;
    }

    const spec = PLATFORM_SPECS[platform];

    // 取得專案 Shader 設定
    const settingsResult = await this.mcpClient.inspect<ProjectSettings>(
      'get_project_settings',
      {}
    );
    const settings = settingsResult.data;
    const projectShaderModel = settings?.shaderModel ?? 'SM5';
    const projectFeatureLevel = settings?.featureLevel ?? 'SM5';

    // 取得專案中使用的 Shader 列表
    const shaderResult = await this.mcpClient.manageAsset<ShaderInfo>(
      'search_assets',
      { classNames: ['MaterialFunction', 'Material'] }
    );
    const shaderData = shaderResult.data;
    const shaders = shaderData?.shaders ?? [];

    const incompatibleShaders: string[] = [];
    const recommendations: string[] = [];

    // 檢查專案 Shader Model 是否超過平台支援
    const projectSmIndex = SHADER_MODEL_ORDER.indexOf(projectShaderModel);
    const platformSmIndex = SHADER_MODEL_ORDER.indexOf(spec.maxShaderModel);

    const compatible = projectSmIndex <= platformSmIndex || projectSmIndex === -1;

    if (!compatible) {
      recommendations.push(
        `專案 Shader Model (${projectShaderModel}) 超過 ${platform} 支援的最高等級 (${spec.maxShaderModel})，需要降低 Shader Model 或提供 Fallback`
      );
    }

    // 檢查個別 Shader 的相容性
    for (const shader of shaders) {
      const shaderSm = shader.model ?? shader.featureLevel ?? projectShaderModel;
      const shaderSmIndex = SHADER_MODEL_ORDER.indexOf(shaderSm);
      if (shaderSmIndex > platformSmIndex && shaderSmIndex !== -1) {
        incompatibleShaders.push(shader.name ?? 'unknown');
      }
    }

    if (incompatibleShaders.length > 0) {
      recommendations.push(
        `${incompatibleShaders.length} 個 Shader 不相容於 ${platform}，需要提供替代版本`
      );
    }

    // 平台特定建議
    if (spec.featureLevel === 'ES3_1') {
      recommendations.push(
        `${platform} 使用 ES3.1 Feature Level，確保所有材質在 Mobile Preview 模式下正常顯示`
      );
    }

    const result: ShaderCompatibility = {
      featureLevel: spec.featureLevel,
      shaderModel: projectShaderModel,
      compatible: compatible && incompatibleShaders.length === 0,
      incompatibleShaders,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(result));
    this.cacheManager.set(cacheKey, hash, result);

    this.logger.debug(`Shader compatibility check completed for ${platform}`, {
      compatible: result.compatible,
      incompatibleCount: incompatibleShaders.length,
    });

    return result;
  }

  /**
   * 檢查記憶體預算
   * 
   * 驗證記憶體使用是否符合目標平台的預算限制
   * 
   * @param platform - 目標平台
   * @returns 記憶體預算分析結果
   */
  async checkMemoryBudget(platform: TargetPlatform): Promise<MemoryBudgetAnalysis> {
    this.logger.debug(`Checking memory budget for: ${platform}`);

    const cacheKey = `${CACHE_KEYS.memoryPrefix}${platform}`;
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      return cached.result as MemoryBudgetAnalysis;
    }

    const spec = PLATFORM_SPECS[platform];

    // 取得記憶體使用統計
    const memResult = await this.mcpClient.managePerformance<MemoryStats>(
      'show_stats',
      { category: 'memory' }
    );
    const stats = memResult.data;
    const usedMB = stats?.totalMemoryMB ?? 0;

    const budgetMB = spec.memoryBudgetMB;
    const remainingMB = budgetMB - usedMB;
    const overBudget = usedMB > budgetMB;

    const recommendations: string[] = [];

    if (overBudget) {
      recommendations.push(
        `記憶體使用 (${usedMB}MB) 超過 ${platform} 預算 (${budgetMB}MB)，需要減少 ${Math.abs(remainingMB)}MB`
      );

      // 根據記憶體分佈提供具體建議
      const textureMemMB = stats?.textureMemoryMB ?? 0;
      const meshMemMB = stats?.meshMemoryMB ?? 0;
      const audioMemMB = stats?.audioMemoryMB ?? 0;

      if (textureMemMB > budgetMB * 0.4) {
        recommendations.push(
          `貼圖記憶體 (${textureMemMB}MB) 佔比過高，建議降低貼圖解析度或啟用 Texture Streaming`
        );
      }
      if (meshMemMB > budgetMB * 0.3) {
        recommendations.push(
          `網格記憶體 (${meshMemMB}MB) 佔比過高，建議使用 LOD 或 Nanite 減少記憶體使用`
        );
      }
      if (audioMemMB > budgetMB * 0.1) {
        recommendations.push(
          `音訊記憶體 (${audioMemMB}MB) 偏高，建議使用串流載入或壓縮音訊格式`
        );
      }
    } else if (remainingMB < budgetMB * 0.2) {
      recommendations.push(
        `記憶體使用接近 ${platform} 預算上限，剩餘 ${remainingMB}MB (${Math.round((remainingMB / budgetMB) * 100)}%)，建議預留更多空間`
      );
    }

    const result: MemoryBudgetAnalysis = {
      budgetMB,
      usedMB,
      remainingMB,
      overBudget,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(result));
    this.cacheManager.set(cacheKey, hash, result);

    this.logger.debug(`Memory budget check completed for ${platform}`, {
      budgetMB,
      usedMB,
      overBudget,
    });

    return result;
  }

  /**
   * 驗證 Scalability Settings
   * 
   * 驗證 Scalability Settings 在不同品質等級下的相容性
   * 
   * @returns Scalability 報告
   */
  async validateScalabilitySettings(): Promise<ScalabilityReport> {
    this.logger.info('Validating scalability settings');

    const cached = this.cacheManager.get(CACHE_KEYS.scalability);
    if (cached) {
      this.logger.debug('Using cached scalability report');
      return cached.result as ScalabilityReport;
    }

    // 取得 Scalability 設定
    const scalabilityResult = await this.mcpClient.systemControl<ScalabilitySettings>(
      'get_project_settings',
      { section: 'scalability' }
    );
    const scalabilityData = scalabilityResult.data;

    const qualityLevels = scalabilityData?.qualityLevels ?? ['Low', 'Medium', 'High', 'Epic', 'Cinematic'];
    const issues: CompatibilityIssue[] = [];
    const recommendations: string[] = [];

    // 取得專案設定以檢查功能相容性
    const settingsResult = await this.mcpClient.inspect<ProjectSettings>(
      'get_project_settings',
      {}
    );
    const settings = settingsResult.data;

    // 檢查 Nanite 在低品質等級的設定
    if (settings?.naniteEnabled) {
      issues.push(
        createIssue(
          'scalability-nanite-low',
          'info',
          'Windows',
          'rendering',
          'Nanite 在低品質等級可能需要 Fallback Mesh 設定，確保所有 Nanite 網格都有適當的 Fallback',
          [],
          '為所有 Nanite 網格設定 Fallback Mesh，並在低品質等級測試視覺效果'
        )
      );
    }

    // 檢查 Lumen 在低品質等級的設定
    if (settings?.lumenEnabled) {
      issues.push(
        createIssue(
          'scalability-lumen-low',
          'warning',
          'Windows',
          'rendering',
          'Lumen 在低品質等級可能需要替代的光照方案，確保有 Fallback 光照設定',
          [],
          '為低品質等級設定替代的全域光照方案（如 Screen Space GI 或烘焙光照）'
        )
      );
    }

    // 檢查 Ray Tracing 在不同品質等級的設定
    if (settings?.rayTracingEnabled) {
      issues.push(
        createIssue(
          'scalability-raytracing',
          'warning',
          'Windows',
          'rendering',
          'Ray Tracing 在低品質等級應被停用，確保 Scalability 設定正確處理 Ray Tracing 的開關',
          [],
          '在 Scalability 設定中，Low 與 Medium 品質等級應停用 Ray Tracing'
        )
      );
    }

    // 檢查品質等級數量
    if (qualityLevels.length < 3) {
      recommendations.push(
        '品質等級數量不足，建議至少提供 Low、Medium、High 三個等級以覆蓋不同硬體配置'
      );
    }

    // 通用建議
    recommendations.push(
      '確保每個品質等級都經過效能測試，特別是 Low 等級在目標最低硬體上的表現'
    );

    const report: ScalabilityReport = {
      qualityLevels,
      issues,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(report));
    this.cacheManager.set(CACHE_KEYS.scalability, hash, report);

    this.logger.info('Scalability validation completed', {
      qualityLevels: qualityLevels.length,
      issueCount: issues.length,
    });

    return report;
  }

  // ─── 私有輔助方法 ───

  /**
   * 檢查功能相容性
   * 
   * 檢查專案使用的功能是否與目標平台相容
   */
  private async checkFeatureCompatibility(platform: TargetPlatform): Promise<CompatibilityIssue[]> {
    const spec = PLATFORM_SPECS[platform];
    const issues: CompatibilityIssue[] = [];

    // 取得專案設定
    const settingsResult = await this.mcpClient.inspect<ProjectSettings>(
      'get_project_settings',
      {}
    );
    const settings = settingsResult.data;

    // 檢查 Nanite 相容性
    if (settings?.naniteEnabled && !spec.supportsNanite) {
      issues.push(
        createIssue(
          'feature-nanite-unsupported',
          'critical',
          platform,
          'feature',
          `${platform} 不支援 Nanite，但專案已啟用 Nanite`,
          [],
          `為 ${platform} 停用 Nanite 並確保所有網格都有傳統 LOD 設定`
        )
      );
    }

    // 檢查 Lumen 相容性
    if (settings?.lumenEnabled && !spec.supportsLumen) {
      issues.push(
        createIssue(
          'feature-lumen-unsupported',
          'critical',
          platform,
          'rendering',
          `${platform} 不支援 Lumen，但專案已啟用 Lumen GI/反射`,
          [],
          `為 ${platform} 提供替代的光照方案（如烘焙光照或 Screen Space GI）`
        )
      );
    }

    // 檢查 Ray Tracing 相容性
    if (settings?.rayTracingEnabled && !spec.supportsRayTracing) {
      issues.push(
        createIssue(
          'feature-raytracing-unsupported',
          'warning',
          platform,
          'rendering',
          `${platform} 不支援硬體 Ray Tracing，但專案已啟用`,
          [],
          `為 ${platform} 停用 Ray Tracing 並使用軟體替代方案`
        )
      );
    }

    // 檢查 Virtual Texture 相容性
    if (settings?.virtualTextureEnabled && !spec.supportsVirtualTexture) {
      issues.push(
        createIssue(
          'feature-vt-unsupported',
          'warning',
          platform,
          'feature',
          `${platform} 不支援 Virtual Texture，但專案已啟用`,
          [],
          `為 ${platform} 停用 Virtual Texture 並使用傳統貼圖串流`
        )
      );
    }

    return issues;
  }
}
