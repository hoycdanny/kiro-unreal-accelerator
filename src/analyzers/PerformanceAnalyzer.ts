/**
 * PerformanceAnalyzer
 * 
 * 效能分析模組
 * 提供場景效能分析、Draw Call 分析、記憶體分析、Nanite/Lumen 分析與反模式偵測
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import type {
  PerformanceReport,
  PerformanceSummary,
  DrawCallAnalysis,
  MemoryAnalysis,
  GpuAnalysis,
  NaniteAnalysis,
  LumenAnalysis,
  AntiPattern,
  Recommendation,
} from '../types/analysis.js';

// ─── MCP 回傳資料介面 ───

interface SceneStats {
  actorCount?: number;
  staticMeshCount?: number;
  skeletalMeshCount?: number;
  lightCount?: number;
  dynamicLightCount?: number;
  particleSystemCount?: number;
  widgetCount?: number;
  [key: string]: unknown;
}

interface PerformanceStats {
  drawCalls?: number;
  staticMeshDrawCalls?: number;
  skeletalMeshDrawCalls?: number;
  particleDrawCalls?: number;
  uiDrawCalls?: number;
  gpuTimeMs?: number;
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

interface ActorInfo {
  name?: string;
  className?: string;
  path?: string;
  triangleCount?: number;
  textureSize?: number;
  materialInstructionCount?: number;
  hasTick?: boolean;
  tickInterval?: number;
  naniteEnabled?: boolean;
  [key: string]: unknown;
}

interface ProjectSettings {
  naniteEnabled?: boolean;
  lumenGIEnabled?: boolean;
  lumenReflectionsEnabled?: boolean;
  rayTracingEnabled?: boolean;
  lumenQuality?: string;
  naniteStreamingPoolSizeMB?: number;
  [key: string]: unknown;
}

// ─── 反模式偵測門檻 ───

const THRESHOLDS = {
  /** 動態光源數量上限 */
  MAX_DYNAMIC_LIGHTS: 8,
  /** 未合併網格的 Draw Call 上限 */
  MAX_DRAW_CALLS: 5000,
  /** 貼圖尺寸上限 (像素) */
  MAX_TEXTURE_SIZE: 4096,
  /** 材質指令數上限 */
  MAX_MATERIAL_INSTRUCTIONS: 200,
  /** 過多 Tick 更新的 Actor 數量上限 */
  MAX_TICK_ACTORS: 50,
  /** 記憶體警告門檻 (MB) */
  MEMORY_WARNING_MB: 4096,
  /** 記憶體嚴重門檻 (MB) */
  MEMORY_CRITICAL_MB: 8192,
  /** GPU 時間警告門檻 (ms) - 目標 60fps = 16.67ms */
  GPU_TIME_WARNING_MS: 16.67,
  /** GPU 時間嚴重門檻 (ms) - 目標 30fps = 33.33ms */
  GPU_TIME_CRITICAL_MS: 33.33,
  /** Nanite 三角形數量建議啟用門檻 */
  NANITE_RECOMMENDED_TRIANGLES: 100000,
};

// ─── 快取鍵 ───

const CACHE_KEYS = {
  SCENE_ANALYSIS: '__perf_scene_analysis__',
  DRAW_CALLS: '__perf_draw_calls__',
  MEMORY: '__perf_memory__',
  NANITE: '__perf_nanite__',
  LUMEN: '__perf_lumen__',
  ANTI_PATTERNS: '__perf_anti_patterns__',
};

/**
 * PerformanceAnalyzer 類別
 * 
 * 提供效能分析功能，包含場景分析、Draw Call 分析、記憶體分析、
 * Nanite/Lumen 分析與反模式偵測
 */
export class PerformanceAnalyzer {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'PerformanceAnalyzer' });
  }

  /**
   * 分析場景效能
   * 
   * 掃描當前場景並產出完整的 PerformanceReport
   * 
   * @returns 效能報告
   */
  async analyzeScene(): Promise<PerformanceReport> {
    this.logger.info('Starting scene performance analysis');

    // 檢查快取
    const cached = this.cacheManager.get(CACHE_KEYS.SCENE_ANALYSIS);
    if (cached) {
      this.logger.debug('Using cached scene analysis');
      return cached.result as PerformanceReport;
    }

    // 並行執行各項分析
    const [drawCallAnalysis, memoryAnalysis, gpuAnalysis, naniteAnalysis, lumenAnalysis, antiPatterns] =
      await Promise.all([
        this.profileDrawCalls(),
        this.profileMemory(),
        this.profileGpu(),
        this.analyzeNaniteUsage(),
        this.analyzeLumenSettings(),
        this.detectAntiPatterns(),
      ]);

    // 產生建議
    const recommendations = this.generateRecommendations(
      drawCallAnalysis,
      memoryAnalysis,
      gpuAnalysis,
      naniteAnalysis,
      lumenAnalysis,
      antiPatterns
    );

    // 計算摘要
    const summary = this.computeSummary(
      drawCallAnalysis,
      memoryAnalysis,
      gpuAnalysis,
      antiPatterns
    );

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      summary,
      drawCallAnalysis,
      memoryAnalysis,
      gpuAnalysis,
      naniteAnalysis,
      lumenAnalysis,
      antiPatterns,
      recommendations,
    };

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(report));
    this.cacheManager.set(CACHE_KEYS.SCENE_ANALYSIS, hash, report);

    this.logger.info('Scene performance analysis completed', {
      overallScore: summary.overallScore,
      criticalIssues: summary.criticalIssues,
      warnings: summary.warnings,
    });

    return report;
  }

  /**
   * 分析 Draw Call
   * 
   * 取得場景的 Draw Call 統計資訊
   * 
   * @returns Draw Call 分析結果
   */
  async profileDrawCalls(): Promise<DrawCallAnalysis> {
    this.logger.debug('Profiling draw calls');

    const cached = this.cacheManager.get(CACHE_KEYS.DRAW_CALLS);
    if (cached) {
      return cached.result as DrawCallAnalysis;
    }

    const perfResult = await this.mcpClient.managePerformance<PerformanceStats>(
      'show_stats',
      { category: 'rendering' }
    );

    const stats = perfResult.data;
    const totalDrawCalls = stats?.drawCalls ?? 0;
    const staticMeshDrawCalls = stats?.staticMeshDrawCalls ?? 0;
    const skeletalMeshDrawCalls = stats?.skeletalMeshDrawCalls ?? 0;
    const particleDrawCalls = stats?.particleDrawCalls ?? 0;
    const uiDrawCalls = stats?.uiDrawCalls ?? 0;

    const recommendations: string[] = [];

    if (totalDrawCalls > THRESHOLDS.MAX_DRAW_CALLS) {
      recommendations.push(
        `Draw Call 數量 (${totalDrawCalls}) 超過建議上限 (${THRESHOLDS.MAX_DRAW_CALLS})，考慮使用 Instanced Static Mesh 或合併網格`
      );
    }

    if (staticMeshDrawCalls > totalDrawCalls * 0.7 && staticMeshDrawCalls > 1000) {
      recommendations.push(
        '靜態網格佔 Draw Call 比例過高，建議啟用 Nanite 或使用 HISM (Hierarchical Instanced Static Mesh)'
      );
    }

    if (particleDrawCalls > 500) {
      recommendations.push(
        `粒子系統 Draw Call (${particleDrawCalls}) 過多，考慮使用 GPU 粒子或減少粒子發射器數量`
      );
    }

    if (uiDrawCalls > 200) {
      recommendations.push(
        `UI Draw Call (${uiDrawCalls}) 過多，考慮合併 Widget、使用 Retainer Box 或減少 UI 更新頻率`
      );
    }

    const analysis: DrawCallAnalysis = {
      totalDrawCalls,
      staticMeshDrawCalls,
      skeletalMeshDrawCalls,
      particleDrawCalls,
      uiDrawCalls,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(analysis));
    this.cacheManager.set(CACHE_KEYS.DRAW_CALLS, hash, analysis);

    this.logger.debug('Draw call profiling completed', { totalDrawCalls });
    return analysis;
  }

  /**
   * 分析記憶體使用
   * 
   * 取得場景的記憶體使用統計
   * 
   * @returns 記憶體分析結果
   */
  async profileMemory(): Promise<MemoryAnalysis> {
    this.logger.debug('Profiling memory usage');

    const cached = this.cacheManager.get(CACHE_KEYS.MEMORY);
    if (cached) {
      return cached.result as MemoryAnalysis;
    }

    const memResult = await this.mcpClient.managePerformance<MemoryStats>(
      'show_stats',
      { category: 'memory' }
    );

    const stats = memResult.data;
    const totalMemoryMB = stats?.totalMemoryMB ?? 0;
    const textureMemoryMB = stats?.textureMemoryMB ?? 0;
    const meshMemoryMB = stats?.meshMemoryMB ?? 0;
    const audioMemoryMB = stats?.audioMemoryMB ?? 0;
    const scriptMemoryMB = stats?.scriptMemoryMB ?? 0;

    const recommendations: string[] = [];

    if (totalMemoryMB > THRESHOLDS.MEMORY_CRITICAL_MB) {
      recommendations.push(
        `總記憶體使用 (${totalMemoryMB}MB) 超過嚴重門檻 (${THRESHOLDS.MEMORY_CRITICAL_MB}MB)，需要立即最佳化`
      );
    } else if (totalMemoryMB > THRESHOLDS.MEMORY_WARNING_MB) {
      recommendations.push(
        `總記憶體使用 (${totalMemoryMB}MB) 超過警告門檻 (${THRESHOLDS.MEMORY_WARNING_MB}MB)，建議檢查資產大小`
      );
    }

    if (textureMemoryMB > totalMemoryMB * 0.6 && textureMemoryMB > 1024) {
      recommendations.push(
        `貼圖記憶體 (${textureMemoryMB}MB) 佔比過高，建議啟用 Texture Streaming 或降低貼圖解析度`
      );
    }

    if (meshMemoryMB > 1024) {
      recommendations.push(
        `網格記憶體 (${meshMemoryMB}MB) 過高，建議使用 Nanite 或設定 LOD 以減少記憶體使用`
      );
    }

    if (audioMemoryMB > 512) {
      recommendations.push(
        `音訊記憶體 (${audioMemoryMB}MB) 過高，建議使用串流載入或壓縮音訊格式`
      );
    }

    const analysis: MemoryAnalysis = {
      totalMemoryMB,
      textureMemoryMB,
      meshMemoryMB,
      audioMemoryMB,
      scriptMemoryMB,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(analysis));
    this.cacheManager.set(CACHE_KEYS.MEMORY, hash, analysis);

    this.logger.debug('Memory profiling completed', { totalMemoryMB });
    return analysis;
  }

  /**
   * 分析 Nanite 使用狀況
   * 
   * 檢查 Nanite 設定與使用效率
   * 
   * @returns Nanite 分析結果
   */
  async analyzeNaniteUsage(): Promise<NaniteAnalysis> {
    this.logger.debug('Analyzing Nanite usage');

    const cached = this.cacheManager.get(CACHE_KEYS.NANITE);
    if (cached) {
      return cached.result as NaniteAnalysis;
    }

    // 取得專案設定
    const settingsResult = await this.mcpClient.inspect<ProjectSettings>(
      'get_project_settings',
      {}
    );

    const settings = settingsResult.data;
    const enabled = settings?.naniteEnabled ?? false;
    const streamingPoolSizeMB = settings?.naniteStreamingPoolSizeMB ?? 0;

    // 取得 Actor 列表以分析 Nanite 使用
    const actorsResult = await this.mcpClient.controlActor<ActorInfo[]>(
      'find_by_class',
      { classPath: 'StaticMeshActor' }
    );

    let naniteTriangles = 0;
    let fallbackTriangles = 0;
    const actors = Array.isArray(actorsResult.data) ? actorsResult.data : [];

    for (const actor of actors) {
      const triCount = actor.triangleCount ?? 0;
      if (actor.naniteEnabled) {
        naniteTriangles += triCount;
      } else {
        fallbackTriangles += triCount;
      }
    }

    const recommendations: string[] = [];

    if (!enabled) {
      recommendations.push(
        'Nanite 未啟用，對於高面數靜態網格場景建議啟用 Nanite 以提升效能'
      );
    }

    if (enabled && fallbackTriangles > naniteTriangles && fallbackTriangles > THRESHOLDS.NANITE_RECOMMENDED_TRIANGLES) {
      recommendations.push(
        `大量三角形 (${fallbackTriangles}) 未使用 Nanite，建議對高面數靜態網格啟用 Nanite`
      );
    }

    if (enabled && streamingPoolSizeMB > 0 && streamingPoolSizeMB < 512) {
      recommendations.push(
        `Nanite Streaming Pool (${streamingPoolSizeMB}MB) 偏小，大型場景建議設定為 512MB 以上`
      );
    }

    if (enabled && naniteTriangles > 0 && streamingPoolSizeMB === 0) {
      recommendations.push(
        '使用 Nanite 但未設定 Streaming Pool 大小，建議設定適當的 Pool 大小以避免記憶體問題'
      );
    }

    const analysis: NaniteAnalysis = {
      enabled,
      naniteTriangles,
      fallbackTriangles,
      streamingPoolSizeMB,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(analysis));
    this.cacheManager.set(CACHE_KEYS.NANITE, hash, analysis);

    this.logger.debug('Nanite analysis completed', { enabled, naniteTriangles });
    return analysis;
  }

  /**
   * 分析 Lumen 設定
   * 
   * 檢查 Lumen GI 與反射設定
   * 
   * @returns Lumen 分析結果
   */
  async analyzeLumenSettings(): Promise<LumenAnalysis> {
    this.logger.debug('Analyzing Lumen settings');

    const cached = this.cacheManager.get(CACHE_KEYS.LUMEN);
    if (cached) {
      return cached.result as LumenAnalysis;
    }

    const settingsResult = await this.mcpClient.inspect<ProjectSettings>(
      'get_project_settings',
      {}
    );

    const settings = settingsResult.data;
    const globalIlluminationEnabled = settings?.lumenGIEnabled ?? false;
    const reflectionsEnabled = settings?.lumenReflectionsEnabled ?? false;
    const rayTracingEnabled = settings?.rayTracingEnabled ?? false;
    const qualityLevel = settings?.lumenQuality ?? 'unknown';

    const recommendations: string[] = [];

    if (globalIlluminationEnabled && reflectionsEnabled && rayTracingEnabled) {
      recommendations.push(
        'Lumen GI、反射與光線追蹤同時啟用，GPU 負載較高。若效能不足，考慮關閉硬體光線追蹤改用軟體光線追蹤'
      );
    }

    if (globalIlluminationEnabled && !reflectionsEnabled) {
      recommendations.push(
        'Lumen GI 已啟用但反射未啟用，建議同時啟用 Lumen 反射以獲得一致的光照效果'
      );
    }

    if (!globalIlluminationEnabled && reflectionsEnabled) {
      recommendations.push(
        'Lumen 反射已啟用但 GI 未啟用，建議同時啟用 Lumen GI 以獲得完整的全域光照效果'
      );
    }

    if (qualityLevel === 'Epic' || qualityLevel === 'Cinematic') {
      recommendations.push(
        `Lumen 品質設定為 ${qualityLevel}，適合最終品質但可能影響開發時的效能。開發階段建議使用 Medium 或 High`
      );
    }

    if (!globalIlluminationEnabled && !reflectionsEnabled) {
      recommendations.push(
        'Lumen 未啟用，若需要動態全域光照與反射，建議啟用 Lumen 以獲得更好的視覺品質'
      );
    }

    const analysis: LumenAnalysis = {
      globalIlluminationEnabled,
      reflectionsEnabled,
      rayTracingEnabled,
      qualityLevel,
      recommendations,
    };

    const hash = this.cacheManager.computeHash(JSON.stringify(analysis));
    this.cacheManager.set(CACHE_KEYS.LUMEN, hash, analysis);

    this.logger.debug('Lumen analysis completed', { globalIlluminationEnabled, reflectionsEnabled });
    return analysis;
  }

  /**
   * 偵測效能反模式
   * 
   * 掃描場景偵測常見的效能反模式：
   * - 過多動態光源
   * - 未合併網格（高 Draw Call）
   * - 過大貼圖
   * - 過高材質指令數
   * - 過多 Tick 更新
   * 
   * @returns 偵測到的反模式列表
   */
  async detectAntiPatterns(): Promise<AntiPattern[]> {
    this.logger.info('Detecting performance anti-patterns');

    const cached = this.cacheManager.get(CACHE_KEYS.ANTI_PATTERNS);
    if (cached) {
      return cached.result as AntiPattern[];
    }

    const antiPatterns: AntiPattern[] = [];

    // 取得場景統計
    const sceneResult = await this.mcpClient.inspect<SceneStats>(
      'get_scene_stats',
      {}
    );
    const sceneStats = sceneResult.data;

    // 取得效能統計
    const perfResult = await this.mcpClient.managePerformance<PerformanceStats>(
      'show_stats',
      { category: 'rendering' }
    );
    const perfStats = perfResult.data;

    // 取得 Actor 列表
    const actorsResult = await this.mcpClient.controlActor<ActorInfo[]>(
      'list',
      {}
    );
    const actors = Array.isArray(actorsResult.data) ? actorsResult.data : [];

    // 1. 偵測過多動態光源
    const dynamicLightCount = sceneStats?.dynamicLightCount ?? 0;
    if (dynamicLightCount > THRESHOLDS.MAX_DYNAMIC_LIGHTS) {
      antiPatterns.push({
        id: 'too-many-dynamic-lights',
        severity: dynamicLightCount > THRESHOLDS.MAX_DYNAMIC_LIGHTS * 2 ? 'critical' : 'warning',
        category: 'lighting',
        description: `場景中有 ${dynamicLightCount} 個動態光源，超過建議上限 (${THRESHOLDS.MAX_DYNAMIC_LIGHTS})`,
        affectedAssets: this.findDynamicLightActors(actors),
        fix: '將不需要即時變化的光源設為 Stationary 或 Static，或使用光照烘焙',
        estimatedImprovement: `減少 ${dynamicLightCount - THRESHOLDS.MAX_DYNAMIC_LIGHTS} 個動態光源可降低約 ${Math.round((dynamicLightCount - THRESHOLDS.MAX_DYNAMIC_LIGHTS) * 0.5)}ms GPU 時間`,
      });
    }

    // 2. 偵測未合併網格（高 Draw Call）
    const totalDrawCalls = perfStats?.drawCalls ?? 0;
    if (totalDrawCalls > THRESHOLDS.MAX_DRAW_CALLS) {
      antiPatterns.push({
        id: 'unmerged-meshes',
        severity: totalDrawCalls > THRESHOLDS.MAX_DRAW_CALLS * 2 ? 'critical' : 'warning',
        category: 'rendering',
        description: `Draw Call 數量 (${totalDrawCalls}) 超過建議上限 (${THRESHOLDS.MAX_DRAW_CALLS})，可能存在大量未合併的網格`,
        affectedAssets: [],
        fix: '使用 Merge Actors 工具合併靜態網格，啟用 Nanite，或使用 Instanced Static Mesh / HISM',
        estimatedImprovement: `合併網格可將 Draw Call 降低 30-60%，預計改善 ${Math.round((totalDrawCalls - THRESHOLDS.MAX_DRAW_CALLS) * 0.01)}ms 渲染時間`,
      });
    }

    // 3. 偵測過大貼圖
    const oversizedTextureActors = actors.filter(
      (a) => (a.textureSize ?? 0) > THRESHOLDS.MAX_TEXTURE_SIZE
    );
    if (oversizedTextureActors.length > 0) {
      antiPatterns.push({
        id: 'oversized-textures',
        severity: oversizedTextureActors.length > 10 ? 'critical' : 'warning',
        category: 'texture',
        description: `發現 ${oversizedTextureActors.length} 個使用超過 ${THRESHOLDS.MAX_TEXTURE_SIZE} 像素貼圖的資產`,
        affectedAssets: oversizedTextureActors.map((a) => a.path ?? a.name ?? 'unknown'),
        fix: '降低貼圖解析度至 4096 以下，或使用 Virtual Texture 處理大型貼圖',
        estimatedImprovement: `降低貼圖尺寸可減少約 ${oversizedTextureActors.length * 16}MB 記憶體使用`,
      });
    }

    // 4. 偵測過高材質指令數
    const highInstructionActors = actors.filter(
      (a) => (a.materialInstructionCount ?? 0) > THRESHOLDS.MAX_MATERIAL_INSTRUCTIONS
    );
    if (highInstructionActors.length > 0) {
      antiPatterns.push({
        id: 'high-material-instruction-count',
        severity: highInstructionActors.length > 5 ? 'critical' : 'warning',
        category: 'material',
        description: `發現 ${highInstructionActors.length} 個材質指令數超過 ${THRESHOLDS.MAX_MATERIAL_INSTRUCTIONS} 的資產`,
        affectedAssets: highInstructionActors.map((a) => a.path ?? a.name ?? 'unknown'),
        fix: '簡化材質圖表，減少數學運算節點，使用 Material Instance 替代複雜的動態分支',
        estimatedImprovement: `簡化材質可降低 Shader 編譯時間與 GPU 渲染負載，預計改善 10-20% 渲染效能`,
      });
    }

    // 5. 偵測過多 Tick 更新
    const tickActors = actors.filter((a) => a.hasTick === true);
    if (tickActors.length > THRESHOLDS.MAX_TICK_ACTORS) {
      antiPatterns.push({
        id: 'excessive-tick-updates',
        severity: tickActors.length > THRESHOLDS.MAX_TICK_ACTORS * 2 ? 'critical' : 'warning',
        category: 'gameplay',
        description: `場景中有 ${tickActors.length} 個 Actor 啟用 Tick 更新，超過建議上限 (${THRESHOLDS.MAX_TICK_ACTORS})`,
        affectedAssets: tickActors.map((a) => a.path ?? a.name ?? 'unknown'),
        fix: '將不需要每幀更新的邏輯改為事件驅動或使用 Timer，設定 Tick Interval 降低更新頻率',
        estimatedImprovement: `減少 Tick Actor 可降低約 ${Math.round((tickActors.length - THRESHOLDS.MAX_TICK_ACTORS) * 0.02)}ms Game Thread 時間`,
      });
    }

    // 儲存到快取
    const hash = this.cacheManager.computeHash(JSON.stringify(antiPatterns));
    this.cacheManager.set(CACHE_KEYS.ANTI_PATTERNS, hash, antiPatterns);

    this.logger.info('Anti-pattern detection completed', {
      patternsFound: antiPatterns.length,
    });

    return antiPatterns;
  }

  // ─── 私有輔助方法 ───

  /**
   * 分析 GPU 效能
   */
  private async profileGpu(): Promise<GpuAnalysis> {
    const perfResult = await this.mcpClient.managePerformance<PerformanceStats>(
      'show_stats',
      { category: 'gpu' }
    );

    const stats = perfResult.data;
    const gpuTimeMs = stats?.gpuTimeMs ?? 0;

    // 從場景統計估算 Shader 複雜度與 Overdraw
    const sceneResult = await this.mcpClient.inspect<SceneStats>(
      'get_scene_stats',
      {}
    );
    const sceneStats = sceneResult.data;

    // 估算 Shader 複雜度 (0-100)
    const actorCount = sceneStats?.actorCount ?? 0;
    const particleCount = sceneStats?.particleSystemCount ?? 0;
    const shaderComplexity = Math.min(100, Math.round(
      (actorCount * 0.01) + (particleCount * 0.5) + (gpuTimeMs * 2)
    ));

    // 估算 Overdraw 比率
    const overdrawRatio = gpuTimeMs > 0 ? Math.min(5, gpuTimeMs / 10) : 1.0;

    const recommendations: string[] = [];

    if (gpuTimeMs > THRESHOLDS.GPU_TIME_CRITICAL_MS) {
      recommendations.push(
        `GPU 時間 (${gpuTimeMs.toFixed(2)}ms) 超過 30fps 門檻，需要立即最佳化渲染管線`
      );
    } else if (gpuTimeMs > THRESHOLDS.GPU_TIME_WARNING_MS) {
      recommendations.push(
        `GPU 時間 (${gpuTimeMs.toFixed(2)}ms) 超過 60fps 門檻，建議最佳化 Shader 與減少 Overdraw`
      );
    }

    if (shaderComplexity > 70) {
      recommendations.push(
        '場景 Shader 複雜度偏高，建議簡化材質或使用 LOD 材質'
      );
    }

    if (overdrawRatio > 3) {
      recommendations.push(
        'Overdraw 比率偏高，建議檢查半透明材質與粒子系統的渲染順序'
      );
    }

    return {
      gpuTimeMs,
      shaderComplexity,
      overdrawRatio,
      recommendations,
    };
  }

  /**
   * 計算效能摘要
   */
  private computeSummary(
    drawCalls: DrawCallAnalysis,
    memory: MemoryAnalysis,
    gpu: GpuAnalysis,
    antiPatterns: AntiPattern[]
  ): PerformanceSummary {
    const criticalIssues = antiPatterns.filter((p) => p.severity === 'critical').length;
    const warnings = antiPatterns.filter((p) => p.severity === 'warning').length;

    // 計算各項分數 (0-100)
    const drawCallScore = this.scoreDrawCalls(drawCalls.totalDrawCalls);
    const memoryScore = this.scoreMemory(memory.totalMemoryMB);
    const gpuScore = this.scoreGpuTime(gpu.gpuTimeMs);
    const antiPatternPenalty = criticalIssues * 10 + warnings * 5;

    // 加權平均
    const rawScore = (drawCallScore * 0.3 + memoryScore * 0.3 + gpuScore * 0.4);
    const overallScore = Math.max(0, Math.min(100, Math.round(rawScore - antiPatternPenalty)));

    // 估算 FPS
    const estimatedFps = this.estimateFps(gpu.gpuTimeMs);

    return {
      overallScore,
      criticalIssues,
      warnings,
      estimatedFps,
    };
  }

  /**
   * 產生最佳化建議
   */
  private generateRecommendations(
    drawCalls: DrawCallAnalysis,
    memory: MemoryAnalysis,
    gpu: GpuAnalysis,
    nanite: NaniteAnalysis,
    lumen: LumenAnalysis,
    antiPatterns: AntiPattern[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let recId = 0;

    // 根據 Draw Call 產生建議
    if (drawCalls.totalDrawCalls > THRESHOLDS.MAX_DRAW_CALLS) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'high',
        category: 'rendering',
        title: '降低 Draw Call 數量',
        description: `當前 Draw Call (${drawCalls.totalDrawCalls}) 過高，影響 CPU 渲染效能`,
        steps: [
          '使用 Merge Actors 工具合併相鄰的靜態網格',
          '對重複出現的網格使用 Instanced Static Mesh',
          '啟用 Nanite 自動處理 LOD 與 Draw Call',
          '檢查是否有不必要的小型網格可以移除',
        ],
        estimatedImpact: '預計可降低 30-60% Draw Call，提升 5-15 FPS',
        relatedIssues: antiPatterns.filter((p) => p.id === 'unmerged-meshes').map((p) => p.id),
      });
    }

    // 根據記憶體產生建議
    if (memory.totalMemoryMB > THRESHOLDS.MEMORY_WARNING_MB) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: memory.totalMemoryMB > THRESHOLDS.MEMORY_CRITICAL_MB ? 'high' : 'medium',
        category: 'memory',
        title: '最佳化記憶體使用',
        description: `總記憶體使用 (${memory.totalMemoryMB}MB) 偏高`,
        steps: [
          '啟用 Texture Streaming 並設定適當的 Streaming Pool 大小',
          '降低不必要的高解析度貼圖',
          '使用 LOD 減少遠處網格的記憶體佔用',
          '檢查是否有未使用的資產佔用記憶體',
        ],
        estimatedImpact: '預計可降低 20-40% 記憶體使用',
        relatedIssues: [],
      });
    }

    // Nanite 專屬建議
    if (!nanite.enabled && nanite.fallbackTriangles > THRESHOLDS.NANITE_RECOMMENDED_TRIANGLES) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'high',
        category: 'nanite',
        title: '啟用 Nanite 虛擬化幾何',
        description: `場景有大量三角形 (${nanite.fallbackTriangles}) 未使用 Nanite`,
        steps: [
          '在 Project Settings 中啟用 Nanite',
          '對高面數靜態網格啟用 Nanite',
          '設定適當的 Nanite Streaming Pool 大小',
          '確認 Fallback Mesh 設定正確',
        ],
        estimatedImpact: '啟用 Nanite 可大幅降低 Draw Call 並自動處理 LOD',
        relatedIssues: [],
      });
    }

    // Lumen 專屬建議
    if (lumen.globalIlluminationEnabled && gpu.gpuTimeMs > THRESHOLDS.GPU_TIME_WARNING_MS) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'medium',
        category: 'lumen',
        title: '調整 Lumen 設定以平衡效能',
        description: 'Lumen 啟用中且 GPU 時間偏高',
        steps: [
          '降低 Lumen 品質等級（從 Epic 降至 High 或 Medium）',
          '若不需要硬體光線追蹤，改用軟體光線追蹤',
          '調整 Lumen Scene Detail 降低追蹤精度',
          '對不需要動態 GI 的區域使用烘焙光照',
        ],
        estimatedImpact: '降低 Lumen 品質可減少 2-5ms GPU 時間',
        relatedIssues: [],
      });
    }

    // 根據反模式產生建議
    for (const pattern of antiPatterns) {
      if (pattern.severity === 'critical') {
        recommendations.push({
          id: `rec-${++recId}`,
          priority: 'high',
          category: pattern.category,
          title: `修復嚴重反模式：${pattern.description.substring(0, 50)}`,
          description: pattern.description,
          steps: [pattern.fix],
          estimatedImpact: pattern.estimatedImprovement,
          relatedIssues: [pattern.id],
        });
      }
    }

    return recommendations;
  }

  /**
   * 從 Actor 列表中找出動態光源
   */
  private findDynamicLightActors(actors: ActorInfo[]): string[] {
    return actors
      .filter((a) => {
        const className = (a.className ?? '').toLowerCase();
        return className.includes('light') && className.includes('dynamic') ||
               className === 'pointlight' ||
               className === 'spotlight' ||
               className === 'rectlight';
      })
      .map((a) => a.path ?? a.name ?? 'unknown');
  }

  /**
   * 評分 Draw Call (0-100)
   */
  private scoreDrawCalls(drawCalls: number): number {
    if (drawCalls <= 1000) return 100;
    if (drawCalls <= 3000) return 80;
    if (drawCalls <= THRESHOLDS.MAX_DRAW_CALLS) return 60;
    if (drawCalls <= THRESHOLDS.MAX_DRAW_CALLS * 2) return 30;
    return 10;
  }

  /**
   * 評分記憶體 (0-100)
   */
  private scoreMemory(memoryMB: number): number {
    if (memoryMB <= 2048) return 100;
    if (memoryMB <= THRESHOLDS.MEMORY_WARNING_MB) return 80;
    if (memoryMB <= 6144) return 50;
    if (memoryMB <= THRESHOLDS.MEMORY_CRITICAL_MB) return 30;
    return 10;
  }

  /**
   * 評分 GPU 時間 (0-100)
   */
  private scoreGpuTime(gpuTimeMs: number): number {
    if (gpuTimeMs <= 8) return 100;
    if (gpuTimeMs <= THRESHOLDS.GPU_TIME_WARNING_MS) return 80;
    if (gpuTimeMs <= 25) return 50;
    if (gpuTimeMs <= THRESHOLDS.GPU_TIME_CRITICAL_MS) return 30;
    return 10;
  }

  /**
   * 估算 FPS
   */
  private estimateFps(gpuTimeMs: number): { low: number; mid: number; high: number } {
    if (gpuTimeMs <= 0) {
      return { low: 30, mid: 60, high: 120 };
    }

    // 基於 GPU 時間估算 FPS 範圍
    const baseFps = 1000 / gpuTimeMs;
    return {
      low: Math.max(1, Math.round(baseFps * 0.6)),
      mid: Math.max(1, Math.round(baseFps * 0.8)),
      high: Math.max(1, Math.round(baseFps)),
    };
  }
}
