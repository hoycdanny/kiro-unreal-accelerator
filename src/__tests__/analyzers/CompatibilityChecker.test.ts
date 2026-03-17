/**
 * CompatibilityChecker Unit Tests
 * 
 * 平台相容性檢查模組單元測試
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompatibilityChecker } from '../../analyzers/CompatibilityChecker.js';
import { McpClient } from '../../utils/mcp-client.js';
import { AnalysisCacheManager } from '../../utils/cache.js';
import type { TargetPlatform } from '../../types/analysis.js';

/**
 * 建立 mock MCP 客戶端，所有呼叫回傳相同資料
 */
function createMockMcpClient(overrides: Record<string, unknown> = {}): McpClient {
  const client = new McpClient({ debug: false });
  const mockInvoker = {
    invoke: vi.fn().mockResolvedValue(overrides),
  };
  client.setInvoker(mockInvoker);
  return client;
}

/**
 * 建立帶有多種回傳的 mock MCP 客戶端
 * 根據 action 參數回傳不同資料
 */
function createMcpClientWithResponses(
  responses: Record<string, unknown>
): McpClient {
  const client = new McpClient({ debug: false });
  const mockInvoker = {
    invoke: vi.fn().mockImplementation((_tool: string, params: Record<string, unknown>) => {
      const action = params.action as string;
      if (action && responses[action]) {
        return Promise.resolve(responses[action]);
      }
      return Promise.resolve(responses);
    }),
  };
  client.setInvoker(mockInvoker);
  return client;
}

describe('CompatibilityChecker', () => {
  let cacheManager: AnalysisCacheManager;

  beforeEach(() => {
    cacheManager = new AnalysisCacheManager();
  });

  describe('checkShaderCompatibility', () => {
    it('should return compatible for SM5 project on Windows', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('Windows');

      expect(result.compatible).toBe(true);
      expect(result.incompatibleShaders).toHaveLength(0);
      expect(result.featureLevel).toBe('SM5');
    });

    it('should return incompatible for SM6 project on mobile (ES3_1)', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM6',
        featureLevel: 'SM6',
        shaders: [],
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('iOS');

      expect(result.compatible).toBe(false);
      expect(result.featureLevel).toBe('ES3_1');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should return incompatible for SM5 project on Android (ES3_1)', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('Android');

      expect(result.compatible).toBe(false);
      expect(result.featureLevel).toBe('ES3_1');
    });

    it('should detect individual incompatible shaders', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [
          { name: 'M_HighEnd', model: 'SM6' },
          { name: 'M_Standard', model: 'SM5' },
          { name: 'M_Advanced', model: 'SM6' },
        ],
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('Mac');

      // Mac supports SM5, so SM6 shaders are incompatible
      expect(result.incompatibleShaders).toContain('M_HighEnd');
      expect(result.incompatibleShaders).toContain('M_Advanced');
      expect(result.incompatibleShaders).not.toContain('M_Standard');
    });

    it('should return compatible for SM5 project on PS5', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('PS5');

      expect(result.compatible).toBe(true);
    });

    it('should include mobile-specific recommendations for ES3_1 platforms', async () => {
      const client = createMockMcpClient({
        shaderModel: 'ES3_1',
        featureLevel: 'ES3_1',
        shaders: [],
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('Switch');

      expect(result.compatible).toBe(true);
      expect(result.recommendations.some((r) => r.includes('ES3.1'))).toBe(true);
    });

    it('should use cache for repeated checks', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
      });
      const checker = new CompatibilityChecker(client, cacheManager);

      const result1 = await checker.checkShaderCompatibility('Windows');
      const result2 = await checker.checkShaderCompatibility('Windows');

      expect(result1).toEqual(result2);
    });

    it('should handle missing MCP data gracefully', async () => {
      const client = new McpClient({ debug: false });
      // No invoker → will fail
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkShaderCompatibility('Windows');

      // Should default to SM5 and still produce a result
      expect(result).toBeDefined();
      expect(result.shaderModel).toBeDefined();
    });
  });

  describe('checkMemoryBudget', () => {
    it('should return within budget for low memory usage on Windows', async () => {
      const client = createMockMcpClient({
        totalMemoryMB: 4096,
        textureMemoryMB: 2048,
        meshMemoryMB: 1024,
        audioMemoryMB: 256,
        scriptMemoryMB: 128,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkMemoryBudget('Windows');

      expect(result.overBudget).toBe(false);
      expect(result.budgetMB).toBe(16384);
      expect(result.usedMB).toBe(4096);
      expect(result.remainingMB).toBe(12288);
    });

    it('should return over budget for high memory usage on mobile', async () => {
      const client = createMockMcpClient({
        totalMemoryMB: 4096,
        textureMemoryMB: 2048,
        meshMemoryMB: 1024,
        audioMemoryMB: 512,
        scriptMemoryMB: 256,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkMemoryBudget('iOS');

      expect(result.overBudget).toBe(true);
      expect(result.budgetMB).toBe(2048);
      expect(result.usedMB).toBe(4096);
      expect(result.remainingMB).toBe(-2048);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should warn when memory is close to budget', async () => {
      const client = createMockMcpClient({
        totalMemoryMB: 2700,
        textureMemoryMB: 1500,
        meshMemoryMB: 800,
        audioMemoryMB: 200,
        scriptMemoryMB: 100,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkMemoryBudget('Android');

      expect(result.overBudget).toBe(false);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes('接近'))).toBe(true);
    });

    it('should provide texture-specific recommendations when textures dominate', async () => {
      const client = createMockMcpClient({
        totalMemoryMB: 5000,
        textureMemoryMB: 3500,
        meshMemoryMB: 500,
        audioMemoryMB: 200,
        scriptMemoryMB: 100,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkMemoryBudget('Switch');

      expect(result.overBudget).toBe(true);
      expect(result.recommendations.some((r) => r.includes('貼圖'))).toBe(true);
    });

    it('should handle zero memory usage', async () => {
      const client = createMockMcpClient({});
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkMemoryBudget('Windows');

      expect(result.overBudget).toBe(false);
      expect(result.usedMB).toBe(0);
      expect(result.remainingMB).toBe(16384);
    });

    it('should use cache for repeated checks', async () => {
      const client = createMockMcpClient({ totalMemoryMB: 2000 });
      const checker = new CompatibilityChecker(client, cacheManager);

      const result1 = await checker.checkMemoryBudget('PS5');
      const result2 = await checker.checkMemoryBudget('PS5');

      expect(result1).toEqual(result2);
    });
  });

  describe('validateScalabilitySettings', () => {
    it('should return quality levels from project settings', async () => {
      const client = createMockMcpClient({
        qualityLevels: ['Low', 'Medium', 'High', 'Epic'],
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.validateScalabilitySettings();

      expect(result.qualityLevels).toContain('Low');
      expect(result.qualityLevels).toContain('Epic');
    });

    it('should flag Nanite scalability concerns when Nanite is enabled', async () => {
      const client = createMockMcpClient({
        qualityLevels: ['Low', 'Medium', 'High', 'Epic'],
        naniteEnabled: true,
        lumenEnabled: false,
        rayTracingEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.validateScalabilitySettings();

      expect(result.issues.some((i) => i.id.includes('nanite'))).toBe(true);
    });

    it('should flag Lumen scalability concerns when Lumen is enabled', async () => {
      const client = createMockMcpClient({
        qualityLevels: ['Low', 'Medium', 'High', 'Epic'],
        naniteEnabled: false,
        lumenEnabled: true,
        rayTracingEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.validateScalabilitySettings();

      expect(result.issues.some((i) => i.id.includes('lumen'))).toBe(true);
    });

    it('should flag Ray Tracing scalability concerns', async () => {
      const client = createMockMcpClient({
        qualityLevels: ['Low', 'Medium', 'High', 'Epic'],
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: true,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.validateScalabilitySettings();

      expect(result.issues.some((i) => i.id.includes('raytracing'))).toBe(true);
    });

    it('should use default quality levels when not provided', async () => {
      const client = createMockMcpClient({});
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.validateScalabilitySettings();

      expect(result.qualityLevels.length).toBeGreaterThanOrEqual(3);
    });

    it('should use cache for repeated validations', async () => {
      const client = createMockMcpClient({});
      const checker = new CompatibilityChecker(client, cacheManager);

      const result1 = await checker.validateScalabilitySettings();
      const result2 = await checker.validateScalabilitySettings();

      expect(result1).toEqual(result2);
    });
  });

  describe('checkPlatform', () => {
    it('should return canBuild=true when no critical issues', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 4096,
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: false,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('Windows');

      expect(result.canBuild).toBe(true);
      expect(result.blockingIssues).toHaveLength(0);
      expect(result.targetPlatform).toBe('Windows');
    });

    it('should return canBuild=false when shader is incompatible (critical)', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM6',
        featureLevel: 'SM6',
        shaders: [],
        totalMemoryMB: 1000,
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: false,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('iOS');

      expect(result.canBuild).toBe(false);
      expect(result.blockingIssues.length).toBeGreaterThan(0);
      expect(result.blockingIssues.some((i) => i.severity === 'critical')).toBe(true);
    });

    it('should return canBuild=false when memory is over budget (critical)', async () => {
      const client = createMockMcpClient({
        shaderModel: 'ES3_1',
        featureLevel: 'ES3_1',
        shaders: [],
        totalMemoryMB: 5000,
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: false,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('Android');

      expect(result.canBuild).toBe(false);
      expect(result.blockingIssues.some((i) => i.category === 'memory')).toBe(true);
    });

    it('should return canBuild=false when Nanite is enabled on unsupported platform', async () => {
      const client = createMockMcpClient({
        shaderModel: 'ES3_1',
        featureLevel: 'ES3_1',
        shaders: [],
        totalMemoryMB: 1000,
        naniteEnabled: true,
        lumenEnabled: false,
        rayTracingEnabled: false,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('Switch');

      expect(result.canBuild).toBe(false);
      expect(result.blockingIssues.some((i) => i.id.includes('nanite'))).toBe(true);
    });

    it('should return canBuild=false when Lumen is enabled on unsupported platform', async () => {
      const client = createMockMcpClient({
        shaderModel: 'ES3_1',
        featureLevel: 'ES3_1',
        shaders: [],
        totalMemoryMB: 1000,
        naniteEnabled: false,
        lumenEnabled: true,
        rayTracingEnabled: false,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('iOS');

      expect(result.canBuild).toBe(false);
      expect(result.blockingIssues.some((i) => i.id.includes('lumen'))).toBe(true);
    });

    it('should include warning for Ray Tracing on unsupported platform (not critical)', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 4000,
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: true,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('Mac');

      // Ray Tracing unsupported on Mac is a warning, not critical
      expect(result.issues.some((i) => i.id.includes('raytracing'))).toBe(true);
      const rtIssue = result.issues.find((i) => i.id.includes('raytracing'));
      expect(rtIssue?.severity).toBe('warning');
    });

    it('should collect issues from all checks', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM6',
        featureLevel: 'SM6',
        shaders: [{ name: 'M_Complex', model: 'SM6' }],
        totalMemoryMB: 5000,
        naniteEnabled: true,
        lumenEnabled: true,
        rayTracingEnabled: true,
        virtualTextureEnabled: true,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('Android');

      // Should have multiple issues from shader, memory, and features
      expect(result.issues.length).toBeGreaterThan(2);
      expect(result.canBuild).toBe(false);
    });

    it('should have correct severity levels (critical, warning, info)', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 4000,
        naniteEnabled: false,
        lumenEnabled: false,
        rayTracingEnabled: true,
        virtualTextureEnabled: true,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('Mac');

      // All issues should have valid severity
      for (const issue of result.issues) {
        expect(['critical', 'warning', 'info']).toContain(issue.severity);
      }
    });

    it('should have correct issue categories', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM6',
        featureLevel: 'SM6',
        shaders: [],
        totalMemoryMB: 5000,
        naniteEnabled: true,
        lumenEnabled: true,
        rayTracingEnabled: true,
        virtualTextureEnabled: true,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('iOS');

      const validCategories = ['shader', 'memory', 'feature', 'input', 'rendering'];
      for (const issue of result.issues) {
        expect(validCategories).toContain(issue.category);
      }
    });

    it('should use cache for repeated platform checks', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 4000,
      });
      const checker = new CompatibilityChecker(client, cacheManager);

      const result1 = await checker.checkPlatform('PS5');
      const result2 = await checker.checkPlatform('PS5');

      expect(result1).toEqual(result2);
    });

    it('should produce different results for different platforms', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 4000,
        naniteEnabled: true,
        lumenEnabled: false,
        rayTracingEnabled: false,
        virtualTextureEnabled: false,
      });
      const checker = new CompatibilityChecker(client, cacheManager);

      const windowsResult = await checker.checkPlatform('Windows');
      const iosResult = await checker.checkPlatform('iOS');

      // Windows supports Nanite, iOS doesn't
      expect(windowsResult.canBuild).not.toBe(iosResult.canBuild);
    });

    it('should include shaderCompatibility and memoryBudget in report', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 4000,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('XboxSeriesX');

      expect(result.shaderCompatibility).toBeDefined();
      expect(result.shaderCompatibility.featureLevel).toBeDefined();
      expect(result.shaderCompatibility.shaderModel).toBeDefined();
      expect(result.memoryBudget).toBeDefined();
      expect(result.memoryBudget.budgetMB).toBeGreaterThan(0);
    });

    it('should set all blocking issues to critical severity', async () => {
      const client = createMockMcpClient({
        shaderModel: 'SM6',
        featureLevel: 'SM6',
        shaders: [],
        totalMemoryMB: 5000,
        naniteEnabled: true,
        lumenEnabled: true,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform('iOS');

      for (const issue of result.blockingIssues) {
        expect(issue.severity).toBe('critical');
      }
    });
  });

  describe('platform coverage', () => {
    const allPlatforms: TargetPlatform[] = [
      'Windows', 'Mac', 'Linux', 'iOS', 'Android', 'PS5', 'XboxSeriesX', 'Switch',
    ];

    it.each(allPlatforms)('should produce a valid report for %s', async (platform) => {
      const client = createMockMcpClient({
        shaderModel: 'SM5',
        featureLevel: 'SM5',
        shaders: [],
        totalMemoryMB: 2000,
      });
      const checker = new CompatibilityChecker(client, cacheManager);
      const result = await checker.checkPlatform(platform);

      expect(result.targetPlatform).toBe(platform);
      expect(typeof result.canBuild).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.blockingIssues)).toBe(true);
      expect(result.shaderCompatibility).toBeDefined();
      expect(result.memoryBudget).toBeDefined();
    });
  });
});
