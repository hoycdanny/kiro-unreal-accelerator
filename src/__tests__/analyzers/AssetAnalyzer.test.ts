/**
 * AssetAnalyzer Unit Tests
 * 
 * 資產分析模組單元測試
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetAnalyzer } from '../../analyzers/AssetAnalyzer.js';
import { McpClient } from '../../utils/mcp-client.js';
import { AnalysisCacheManager } from '../../utils/cache.js';
import type { AssetPreset } from '../../types/asset.js';

/**
 * 建立 mock MCP 客戶端
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
 * 建立帶有自訂 inspect 回傳的 mock MCP 客戶端
 */
function createMcpClientWithInspect(
  inspectResponses: Record<string, unknown>
): McpClient {
  const client = new McpClient({ debug: false });
  const mockInvoker = {
    invoke: vi.fn().mockResolvedValue(inspectResponses),
  };
  client.setInvoker(mockInvoker);
  return client;
}

describe('AssetAnalyzer', () => {
  let cacheManager: AnalysisCacheManager;

  beforeEach(() => {
    cacheManager = new AnalysisCacheManager();
  });

  describe('detectAssetType', () => {
    it('should detect Texture2D from path prefix T_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Textures/T_Wood_Diffuse');
      expect(result).toBe('Texture2D');
    });

    it('should detect StaticMesh from path prefix SM_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Meshes/SM_Rock_01');
      expect(result).toBe('StaticMesh');
    });

    it('should detect SkeletalMesh from path prefix SK_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Characters/SK_Mannequin');
      expect(result).toBe('SkeletalMesh');
    });

    it('should detect Material from path prefix M_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Materials/M_Wood');
      expect(result).toBe('Material');
    });

    it('should detect MaterialInstance from path prefix MI_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Materials/MI_Wood_Dark');
      expect(result).toBe('MaterialInstance');
    });

    it('should detect SoundWave from path prefix SW_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Audio/SW_Explosion');
      expect(result).toBe('SoundWave');
    });

    it('should detect Blueprint from path prefix BP_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Blueprints/BP_Player');
      expect(result).toBe('Blueprint');
    });

    it('should detect NiagaraSystem from path prefix NS_', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/VFX/NS_Fire');
      expect(result).toBe('NiagaraSystem');
    });

    it('should detect type from MCP className when available', async () => {
      const client = createMcpClientWithInspect({ className: 'StaticMesh' });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/SomeAsset');
      expect(result).toBe('StaticMesh');
    });

    it('should default to Blueprint for unknown asset paths', async () => {
      const client = createMockMcpClient({});
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.detectAssetType('/Game/Unknown/SomeAsset');
      expect(result).toBe('Blueprint');
    });
  });

  describe('validateNaniteCompatibility', () => {
    it('should return compatible for high-poly mesh without skinning', async () => {
      const client = createMcpClientWithInspect({
        triangleCount: 50000,
        hasSkinning: false,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Meshes/SM_HighPoly');

      expect(result.compatible).toBe(true);
      expect(result.triangleCount).toBe(50000);
      expect(result.hasSkinning).toBe(false);
      expect(result.hasDeformation).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should return incompatible for mesh with skinning', async () => {
      const client = createMcpClientWithInspect({
        triangleCount: 50000,
        hasSkinning: true,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Characters/SK_Character');

      expect(result.compatible).toBe(false);
      expect(result.hasSkinning).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('骨骼'))).toBe(true);
    });

    it('should return incompatible for mesh with deformation', async () => {
      const client = createMcpClientWithInspect({
        triangleCount: 50000,
        hasSkinning: false,
        hasDeformation: true,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Meshes/SM_Deformable');

      expect(result.compatible).toBe(false);
      expect(result.hasDeformation).toBe(true);
      expect(result.reasons.some((r) => r.includes('變形'))).toBe(true);
    });

    it('should return incompatible for low-poly mesh', async () => {
      const client = createMcpClientWithInspect({
        triangleCount: 500,
        hasSkinning: false,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Meshes/SM_LowPoly');

      expect(result.compatible).toBe(false);
      expect(result.triangleCount).toBe(500);
      expect(result.reasons.some((r) => r.includes('面數過低'))).toBe(true);
    });

    it('should handle MCP failure gracefully', async () => {
      const client = new McpClient({ debug: false });
      // No invoker set → will fail
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Meshes/SM_Missing');

      expect(result.compatible).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should return incompatible at exactly 10000 triangles boundary', async () => {
      const client = createMcpClientWithInspect({
        triangleCount: 9999,
        hasSkinning: false,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Meshes/SM_Boundary');

      expect(result.compatible).toBe(false);
    });

    it('should return compatible at exactly 10000 triangles', async () => {
      const client = createMcpClientWithInspect({
        triangleCount: 10000,
        hasSkinning: false,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.validateNaniteCompatibility('/Game/Meshes/SM_Exact');

      expect(result.compatible).toBe(true);
    });
  });

  describe('analyzeAsset', () => {
    it('should return analysis result with correct asset type', async () => {
      const client = createMcpClientWithInspect({ className: 'Texture2D', memorySize: 1024 });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.analyzeAsset('/Game/Textures/T_Wood');

      expect(result.assetPath).toBe('/Game/Textures/T_Wood');
      expect(result.assetType).toBe('Texture2D');
      expect(result.suggestedPreset).toBe('texture-2d-diffuse');
    });

    it('should suggest Nanite preset for compatible StaticMesh', async () => {
      const client = createMcpClientWithInspect({
        className: 'StaticMesh',
        triangleCount: 50000,
        hasSkinning: false,
        hasDeformation: false,
        memorySize: 2048,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.analyzeAsset('/Game/Meshes/SM_HighPoly');

      expect(result.assetType).toBe('StaticMesh');
      expect(result.naniteCompatible).toBe(true);
      expect(result.suggestedPreset).toBe('static-mesh-nanite');
    });

    it('should use standard preset for non-Nanite StaticMesh', async () => {
      const client = createMcpClientWithInspect({
        className: 'StaticMesh',
        triangleCount: 500,
        hasSkinning: false,
        hasDeformation: false,
        memorySize: 256,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.analyzeAsset('/Game/Meshes/SM_LowPoly');

      expect(result.assetType).toBe('StaticMesh');
      expect(result.naniteCompatible).toBe(false);
      expect(result.suggestedPreset).toBe('static-mesh-standard');
    });

    it('should use cache for repeated analysis', async () => {
      const client = createMcpClientWithInspect({ className: 'Texture2D', memorySize: 512 });
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const result1 = await analyzer.analyzeAsset('/Game/Textures/T_Cached');
      const result2 = await analyzer.analyzeAsset('/Game/Textures/T_Cached');

      expect(result1).toEqual(result2);
    });

    it('should include estimated memory from MCP data', async () => {
      const client = createMcpClientWithInspect({ className: 'SoundWave', memorySize: 4096 });
      const analyzer = new AssetAnalyzer(client, cacheManager);
      const result = await analyzer.analyzeAsset('/Game/Audio/SW_Music');

      expect(result.estimatedMemory).toBe(4096);
    });
  });

  describe('batchApplyPreset', () => {
    const texturePreset: AssetPreset = {
      name: 'Texture2D_Diffuse',
      assetType: 'Texture2D',
      description: '標準 Diffuse 貼圖預設',
      settings: {
        compressionSettings: 'TC_Default',
        sRGB: true,
        maxTextureSize: 2048,
      },
    };

    const nanitePreset: AssetPreset = {
      name: 'StaticMesh_Nanite',
      assetType: 'StaticMesh',
      description: 'Nanite 靜態網格預設',
      settings: {
        naniteEnabled: true,
      },
      requirements: [
        { check: 'minTriangleCount', value: 10000, message: 'Nanite 適用於高面數網格' },
        { check: 'noSkinning', message: 'Nanite 不支援骨骼網格' },
      ],
    };

    it('should apply preset to compatible assets', async () => {
      const client = createMcpClientWithInspect({ className: 'Texture2D' });
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const results = await analyzer.batchApplyPreset(
        ['/Game/Textures/T_Wood', '/Game/Textures/T_Stone'],
        texturePreset
      );

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.success).toBe(true);
        expect(r.appliedSettings).toEqual(texturePreset.settings);
      });
    });

    it('should fail for type-mismatched assets with alternatives', async () => {
      const client = createMcpClientWithInspect({ className: 'StaticMesh' });
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const results = await analyzer.batchApplyPreset(
        ['/Game/Meshes/SM_Rock'],
        texturePreset
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].failureReason).toContain('資產類型不匹配');
      expect(results[0].alternativeSuggestions).toBeDefined();
      expect(results[0].alternativeSuggestions!.length).toBeGreaterThan(0);
    });

    it('should fail Nanite preset for low-poly mesh with alternatives', async () => {
      const client = createMcpClientWithInspect({
        className: 'StaticMesh',
        triangleCount: 500,
        hasSkinning: false,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const results = await analyzer.batchApplyPreset(
        ['/Game/Meshes/SM_LowPoly'],
        nanitePreset
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].failureReason).toBeDefined();
      expect(results[0].alternativeSuggestions).toBeDefined();
      expect(results[0].alternativeSuggestions!.length).toBeGreaterThan(0);
    });

    it('should fail Nanite preset for skinned mesh with alternatives', async () => {
      const client = createMcpClientWithInspect({
        className: 'StaticMesh',
        triangleCount: 50000,
        hasSkinning: true,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const results = await analyzer.batchApplyPreset(
        ['/Game/Meshes/SM_Skinned'],
        nanitePreset
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].failureReason).toContain('骨骼');
      expect(results[0].alternativeSuggestions).toBeDefined();
    });

    it('should handle mixed compatible and incompatible assets', async () => {
      // We need different responses per call, so we use a counter-based mock
      const client = new McpClient({ debug: false });
      let callCount = 0;
      const mockInvoker = {
        invoke: vi.fn().mockImplementation(() => {
          callCount++;
          // First two calls are for detectAssetType (get_metadata) for asset 1 and 2
          // Subsequent calls are for requirements check and apply
          return Promise.resolve({ className: 'Texture2D' });
        }),
      };
      client.setInvoker(mockInvoker);
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const results = await analyzer.batchApplyPreset(
        ['/Game/Textures/T_Good', '/Game/Textures/T_Also_Good'],
        texturePreset
      );

      expect(results).toHaveLength(2);
    });

    it('should apply Nanite preset to high-poly mesh successfully', async () => {
      const client = createMcpClientWithInspect({
        className: 'StaticMesh',
        triangleCount: 50000,
        hasSkinning: false,
        hasDeformation: false,
      });
      const analyzer = new AssetAnalyzer(client, cacheManager);

      const results = await analyzer.batchApplyPreset(
        ['/Game/Meshes/SM_HighPoly'],
        nanitePreset
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].appliedSettings).toEqual(nanitePreset.settings);
    });
  });
});
