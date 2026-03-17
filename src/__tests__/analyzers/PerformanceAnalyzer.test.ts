/**
 * PerformanceAnalyzer Unit Tests
 * 
 * 效能分析模組單元測試
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceAnalyzer } from '../../analyzers/PerformanceAnalyzer.js';
import { McpClient } from '../../utils/mcp-client.js';
import { AnalysisCacheManager } from '../../utils/cache.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockResponses = Record<string, any>;

/**
 * 建立帶有自訂回傳的 mock MCP 客戶端
 */
function createMockMcpClient(responses: MockResponses = {}): McpClient {
  const client = new McpClient({ debug: false });
  const mockInvoker = {
    invoke: vi.fn().mockImplementation((_toolName: string, params: Record<string, unknown>) => {
      const action = params.action as string;
      // Return matching response by action, or empty object
      return Promise.resolve(responses[action] ?? {});
    }),
  };
  client.setInvoker(mockInvoker);
  return client;
}

/**
 * 建立預設場景的 mock 回傳
 */
function createDefaultResponses(overrides: MockResponses = {}): MockResponses {
  return {
    show_stats: {
      drawCalls: 2000,
      staticMeshDrawCalls: 1200,
      skeletalMeshDrawCalls: 300,
      particleDrawCalls: 100,
      uiDrawCalls: 50,
      gpuTimeMs: 12,
      totalMemoryMB: 3000,
      textureMemoryMB: 1500,
      meshMemoryMB: 800,
      audioMemoryMB: 200,
      scriptMemoryMB: 100,
      ...overrides['show_stats'],
    },
    get_scene_stats: {
      actorCount: 500,
      staticMeshCount: 300,
      skeletalMeshCount: 20,
      lightCount: 15,
      dynamicLightCount: 5,
      particleSystemCount: 10,
      widgetCount: 30,
      ...overrides['get_scene_stats'],
    },
    get_project_settings: {
      naniteEnabled: true,
      lumenGIEnabled: true,
      lumenReflectionsEnabled: true,
      rayTracingEnabled: false,
      lumenQuality: 'High',
      naniteStreamingPoolSizeMB: 1024,
      ...overrides['get_project_settings'],
    },
    find_by_class: [],
    list: [],
    ...overrides,
  };
}

describe('PerformanceAnalyzer', () => {
  let cacheManager: AnalysisCacheManager;

  beforeEach(() => {
    cacheManager = new AnalysisCacheManager();
  });

  describe('analyzeScene', () => {
    it('should return a complete PerformanceReport', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeScene();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.drawCallAnalysis).toBeDefined();
      expect(report.memoryAnalysis).toBeDefined();
      expect(report.gpuAnalysis).toBeDefined();
      expect(report.naniteAnalysis).toBeDefined();
      expect(report.lumenAnalysis).toBeDefined();
      expect(report.antiPatterns).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should calculate overall score between 0 and 100', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeScene();

      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
    });

    it('should use cache for repeated analysis', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report1 = await analyzer.analyzeScene();
      const report2 = await analyzer.analyzeScene();

      expect(report1.timestamp).toBe(report2.timestamp);
    });

    it('should estimate FPS based on GPU time', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { gpuTimeMs: 10 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeScene();

      expect(report.summary.estimatedFps.low).toBeGreaterThan(0);
      expect(report.summary.estimatedFps.mid).toBeGreaterThan(report.summary.estimatedFps.low);
      expect(report.summary.estimatedFps.high).toBeGreaterThanOrEqual(report.summary.estimatedFps.mid);
    });
  });

  describe('profileDrawCalls', () => {
    it('should return draw call statistics', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileDrawCalls();

      expect(analysis.totalDrawCalls).toBe(2000);
      expect(analysis.staticMeshDrawCalls).toBe(1200);
      expect(analysis.skeletalMeshDrawCalls).toBe(300);
      expect(analysis.particleDrawCalls).toBe(100);
      expect(analysis.uiDrawCalls).toBe(50);
    });

    it('should provide recommendations when draw calls exceed threshold', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { drawCalls: 6000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileDrawCalls();

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.some((r) => r.includes('Draw Call'))).toBe(true);
    });

    it('should recommend HISM when static mesh draw calls are high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { drawCalls: 3000, staticMeshDrawCalls: 2500 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileDrawCalls();

      expect(analysis.recommendations.some((r) => r.includes('HISM') || r.includes('Nanite'))).toBe(true);
    });

    it('should recommend GPU particles when particle draw calls are high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { particleDrawCalls: 600 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileDrawCalls();

      expect(analysis.recommendations.some((r) => r.includes('粒子') || r.includes('GPU'))).toBe(true);
    });

    it('should recommend UI optimization when UI draw calls are high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { uiDrawCalls: 250 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileDrawCalls();

      expect(analysis.recommendations.some((r) => r.includes('UI') || r.includes('Widget'))).toBe(true);
    });
  });

  describe('profileMemory', () => {
    it('should return memory statistics', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileMemory();

      expect(analysis.totalMemoryMB).toBe(3000);
      expect(analysis.textureMemoryMB).toBe(1500);
      expect(analysis.meshMemoryMB).toBe(800);
      expect(analysis.audioMemoryMB).toBe(200);
      expect(analysis.scriptMemoryMB).toBe(100);
    });

    it('should warn when memory exceeds warning threshold', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { totalMemoryMB: 5000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileMemory();

      expect(analysis.recommendations.some((r) => r.includes('記憶體') || r.includes('警告'))).toBe(true);
    });

    it('should provide critical warning when memory exceeds critical threshold', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { totalMemoryMB: 9000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileMemory();

      expect(analysis.recommendations.some((r) => r.includes('嚴重') || r.includes('立即'))).toBe(true);
    });

    it('should recommend texture streaming when texture memory is high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { totalMemoryMB: 4000, textureMemoryMB: 3000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.profileMemory();

      expect(analysis.recommendations.some((r) => r.includes('貼圖') || r.includes('Texture'))).toBe(true);
    });
  });

  describe('analyzeNaniteUsage', () => {
    it('should return Nanite analysis with enabled status', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeNaniteUsage();

      expect(analysis.enabled).toBe(true);
      expect(analysis.streamingPoolSizeMB).toBe(1024);
    });

    it('should recommend enabling Nanite when disabled', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: { naniteEnabled: false },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeNaniteUsage();

      expect(analysis.enabled).toBe(false);
      expect(analysis.recommendations.some((r) => r.includes('Nanite') && r.includes('啟用'))).toBe(true);
    });

    it('should recommend larger streaming pool when too small', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: { naniteEnabled: true, naniteStreamingPoolSizeMB: 256 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeNaniteUsage();

      expect(analysis.recommendations.some((r) => r.includes('Streaming Pool'))).toBe(true);
    });

    it('should count Nanite and fallback triangles from actors', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        find_by_class: [
          { name: 'SM_Rock1', triangleCount: 50000, naniteEnabled: true },
          { name: 'SM_Rock2', triangleCount: 30000, naniteEnabled: true },
          { name: 'SM_Prop', triangleCount: 5000, naniteEnabled: false },
        ],
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeNaniteUsage();

      expect(analysis.naniteTriangles).toBe(80000);
      expect(analysis.fallbackTriangles).toBe(5000);
    });
  });

  describe('analyzeLumenSettings', () => {
    it('should return Lumen settings analysis', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeLumenSettings();

      expect(analysis.globalIlluminationEnabled).toBe(true);
      expect(analysis.reflectionsEnabled).toBe(true);
      expect(analysis.rayTracingEnabled).toBe(false);
      expect(analysis.qualityLevel).toBe('High');
    });

    it('should recommend enabling reflections when only GI is enabled', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: { lumenGIEnabled: true, lumenReflectionsEnabled: false },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeLumenSettings();

      expect(analysis.recommendations.some((r) => r.includes('反射'))).toBe(true);
    });

    it('should recommend enabling GI when only reflections are enabled', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: { lumenGIEnabled: false, lumenReflectionsEnabled: true },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeLumenSettings();

      expect(analysis.recommendations.some((r) => r.includes('GI'))).toBe(true);
    });

    it('should warn about high GPU load when all features are enabled', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: {
          lumenGIEnabled: true,
          lumenReflectionsEnabled: true,
          rayTracingEnabled: true,
        },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeLumenSettings();

      expect(analysis.recommendations.some((r) => r.includes('GPU') || r.includes('負載'))).toBe(true);
    });

    it('should warn about Epic/Cinematic quality during development', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: { lumenQuality: 'Epic' },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeLumenSettings();

      expect(analysis.recommendations.some((r) => r.includes('Epic') || r.includes('開發'))).toBe(true);
    });
  });

  describe('detectAntiPatterns', () => {
    it('should detect too many dynamic lights', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_scene_stats: { dynamicLightCount: 15 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      const lightPattern = patterns.find((p) => p.id === 'too-many-dynamic-lights');
      expect(lightPattern).toBeDefined();
      expect(lightPattern?.severity).toBe('warning');
      expect(lightPattern?.category).toBe('lighting');
    });

    it('should mark critical severity for excessive dynamic lights', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_scene_stats: { dynamicLightCount: 20 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      const lightPattern = patterns.find((p) => p.id === 'too-many-dynamic-lights');
      expect(lightPattern?.severity).toBe('critical');
    });

    it('should detect unmerged meshes (high draw calls)', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { drawCalls: 7000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      const meshPattern = patterns.find((p) => p.id === 'unmerged-meshes');
      expect(meshPattern).toBeDefined();
      expect(meshPattern?.fix).toContain('Merge');
    });

    it('should detect oversized textures', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { name: 'Actor1', textureSize: 8192, path: '/Game/Actors/Actor1' },
          { name: 'Actor2', textureSize: 2048, path: '/Game/Actors/Actor2' },
        ],
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      const texturePattern = patterns.find((p) => p.id === 'oversized-textures');
      expect(texturePattern).toBeDefined();
      expect(texturePattern?.affectedAssets).toContain('/Game/Actors/Actor1');
      expect(texturePattern?.affectedAssets).not.toContain('/Game/Actors/Actor2');
    });

    it('should detect high material instruction count', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { name: 'Actor1', materialInstructionCount: 300, path: '/Game/Actors/Actor1' },
          { name: 'Actor2', materialInstructionCount: 100, path: '/Game/Actors/Actor2' },
        ],
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      const materialPattern = patterns.find((p) => p.id === 'high-material-instruction-count');
      expect(materialPattern).toBeDefined();
      expect(materialPattern?.category).toBe('material');
    });

    it('should detect excessive Tick updates', async () => {
      // Create 60 actors with Tick enabled
      const tickActors = Array.from({ length: 60 }, (_, i) => ({
        name: `Actor${i}`,
        hasTick: true,
        path: `/Game/Actors/Actor${i}`,
      }));

      const client = createMockMcpClient(createDefaultResponses({
        list: tickActors,
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      const tickPattern = patterns.find((p) => p.id === 'excessive-tick-updates');
      expect(tickPattern).toBeDefined();
      expect(tickPattern?.category).toBe('gameplay');
      expect(tickPattern?.fix).toContain('Timer');
    });

    it('should return empty array when no anti-patterns detected', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_scene_stats: { dynamicLightCount: 3 },
        show_stats: { drawCalls: 1000 },
        list: [],
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      expect(patterns).toHaveLength(0);
    });

    it('should provide fix suggestions for each anti-pattern', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_scene_stats: { dynamicLightCount: 15 },
        show_stats: { drawCalls: 7000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const patterns = await analyzer.detectAntiPatterns();

      patterns.forEach((pattern) => {
        expect(pattern.fix).toBeDefined();
        expect(pattern.fix.length).toBeGreaterThan(0);
        expect(pattern.estimatedImprovement).toBeDefined();
      });
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations based on analysis results', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { drawCalls: 7000, totalMemoryMB: 5000 },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeScene();

      expect(report.recommendations.length).toBeGreaterThan(0);
      report.recommendations.forEach((rec) => {
        expect(rec.id).toBeDefined();
        expect(rec.priority).toMatch(/^(high|medium|low)$/);
        expect(rec.category).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.steps.length).toBeGreaterThan(0);
        expect(rec.estimatedImpact).toBeDefined();
      });
    });

    it('should include Nanite-specific recommendations when applicable', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_project_settings: { naniteEnabled: false },
        find_by_class: [
          { name: 'SM_HighPoly', triangleCount: 200000, naniteEnabled: false },
        ],
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeScene();

      const naniteRec = report.recommendations.find((r) => r.category === 'nanite');
      expect(naniteRec).toBeDefined();
      expect(naniteRec?.steps.some((s) => s.includes('Nanite'))).toBe(true);
    });

    it('should include Lumen-specific recommendations when GPU time is high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        show_stats: { gpuTimeMs: 25 },
        get_project_settings: { lumenGIEnabled: true },
      }));
      const analyzer = new PerformanceAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeScene();

      const lumenRec = report.recommendations.find((r) => r.category === 'lumen');
      expect(lumenRec).toBeDefined();
    });
  });
});
