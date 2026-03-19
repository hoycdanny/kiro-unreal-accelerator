/**
 * MaterialManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaterialManager } from '../../managers/MaterialManager.js';

// Mock McpClient
function createMockMcpClient() {
  return {
    manageAsset: vi.fn().mockResolvedValue({ success: true, data: {} }),
    manageMaterialAuthoring: vi.fn().mockResolvedValue({ success: true, data: {} }),
    controlActor: vi.fn().mockResolvedValue({ success: true, data: {} }),
    inspect: vi.fn().mockResolvedValue({ success: true, data: {} }),
  } as any;
}

function createMockCacheManager() {
  return {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    computeHash: vi.fn().mockReturnValue('hash'),
  } as any;
}

describe('MaterialManager', () => {
  let manager: MaterialManager;
  let mockMcp: ReturnType<typeof createMockMcpClient>;
  let mockCache: ReturnType<typeof createMockCacheManager>;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    mockCache = createMockCacheManager();
    manager = new MaterialManager(mockMcp, mockCache);
  });

  describe('searchMaterials', () => {
    it('should search with default options', async () => {
      mockMcp.manageAsset.mockResolvedValue({
        success: true,
        data: { assets: ['/Game/Materials/M_Test'] },
      });

      const results = await manager.searchMaterials();
      expect(mockMcp.manageAsset).toHaveBeenCalledWith(
        'search_assets',
        expect.objectContaining({
          packagePaths: ['/Game'],
          recursivePaths: true,
        })
      );
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should search with keyword filter', async () => {
      mockMcp.manageAsset.mockResolvedValue({
        success: true,
        data: { assets: ['/Game/Materials/M_Grass'] },
      });

      await manager.searchMaterials({ keyword: 'grass' });
      expect(mockMcp.manageAsset).toHaveBeenCalledWith(
        'search_assets',
        expect.objectContaining({ searchText: 'grass' })
      );
    });

    it('should respect limit option', async () => {
      const assets = Array.from({ length: 20 }, (_, i) => `/Game/M_Test${i}`);
      mockMcp.manageAsset.mockResolvedValue({
        success: true,
        data: { assets },
      });

      const results = await manager.searchMaterials({ limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('applyMaterialToActor', () => {
    it('should apply material successfully', async () => {
      mockMcp.controlActor.mockResolvedValue({ success: true, data: {} });

      const result = await manager.applyMaterialToActor('TestActor', {
        materialPath: '/Game/M_Test',
      });

      expect(result.success).toBe(true);
      expect(result.actorName).toBe('TestActor');
      expect(result.materialPath).toBe('/Game/M_Test');
    });

    it('should handle apply failure', async () => {
      mockMcp.controlActor.mockResolvedValue({
        success: false,
        error: { message: 'Actor not found' },
      });

      const result = await manager.applyMaterialToActor('BadActor', {
        materialPath: '/Game/M_Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('batchApplyMaterial', () => {
    it('should apply to multiple actors', async () => {
      mockMcp.controlActor.mockResolvedValue({ success: true, data: {} });

      const result = await manager.batchApplyMaterial(
        ['Actor1', 'Actor2', 'Actor3'],
        { materialPath: '/Game/M_Test' }
      );

      expect(result.totalActors).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failCount).toBe(0);
    });

    it('should report partial failures', async () => {
      mockMcp.controlActor
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: false, error: { message: 'fail' } })
        .mockResolvedValueOnce({ success: true, data: {} });

      const result = await manager.batchApplyMaterial(
        ['A1', 'A2', 'A3'],
        { materialPath: '/Game/M_Test' }
      );

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
    });
  });

  describe('createMaterial', () => {
    it('should create material with base color', async () => {
      mockMcp.manageMaterialAuthoring.mockResolvedValue({
        success: true,
        data: { nodeId: 'node123' },
      });
      mockMcp.manageAsset.mockResolvedValue({ success: true, data: {} });

      const result = await manager.createMaterial({
        name: 'M_Test',
        path: '/Game/Materials',
        baseColor: { r: 0.5, g: 0.8, b: 0.2 },
        roughness: 0.7,
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('M_Test');
      expect(result!.type).toBe('Material');
    });

    it('should return null on creation failure', async () => {
      mockMcp.manageMaterialAuthoring.mockResolvedValue({
        success: false,
        error: { message: 'Creation failed' },
      });

      const result = await manager.createMaterial({
        name: 'M_Fail',
        path: '/Game/Materials',
      });

      expect(result).toBeNull();
    });
  });

  describe('replaceMaterial', () => {
    it('should replace material on all specified actors', async () => {
      mockMcp.controlActor.mockResolvedValue({ success: true, data: {} });

      const result = await manager.replaceMaterial(
        ['Actor1', 'Actor2'],
        '/Game/M_Old',
        '/Game/M_New'
      );

      expect(result.totalActors).toBe(2);
      expect(result.successCount).toBe(2);
    });
  });

  describe('getMaterialInfo', () => {
    it('should get Material info', async () => {
      mockMcp.manageMaterialAuthoring.mockResolvedValue({
        success: true,
        data: { domain: 'Surface', blendMode: 'Opaque' },
      });

      const info = await manager.getMaterialInfo('/Game/M_Test');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Material');
    });

    it('should fallback to inspect for MaterialInstance', async () => {
      mockMcp.manageMaterialAuthoring.mockResolvedValue({ success: false });
      mockMcp.inspect.mockResolvedValue({
        success: true,
        data: { parentMaterial: '/Game/M_Parent' },
      });

      const info = await manager.getMaterialInfo('/Game/MI_Test');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('MaterialInstance');
    });
  });
});
