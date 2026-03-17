/**
 * DependencyAnalyzer Unit Tests
 * 
 * 依賴分析模組單元測試
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyAnalyzer } from '../../analyzers/DependencyAnalyzer.js';
import { McpClient } from '../../utils/mcp-client.js';
import { AnalysisCacheManager } from '../../utils/cache.js';

/**
 * 建立 mock MCP 客戶端
 */
function createMockMcpClient(
  invokeImpl?: (toolName: string, params: Record<string, unknown>) => Promise<unknown>
): McpClient {
  const client = new McpClient({ debug: false });
  const mockInvoker = {
    invoke: vi.fn().mockImplementation(invokeImpl ?? (() => Promise.resolve({}))),
  };
  client.setInvoker(mockInvoker);
  return client;
}

/**
 * 建立帶有預設回傳的 mock MCP 客戶端
 */
function createMcpClientWithResponse(response: unknown): McpClient {
  return createMockMcpClient(() => Promise.resolve(response));
}

describe('DependencyAnalyzer', () => {
  let cacheManager: AnalysisCacheManager;

  beforeEach(() => {
    cacheManager = new AnalysisCacheManager();
  });

  describe('buildDependencyTree', () => {
    it('should build dependency tree for asset with no dependencies', async () => {
      const client = createMcpClientWithResponse({
        assetPath: '/Game/Textures/T_Wood',
        className: 'Texture2D',
        dependencies: [],
        referencedBy: [],
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const tree = await analyzer.buildDependencyTree('/Game/Textures/T_Wood');

      expect(tree.root).toBe('/Game/Textures/T_Wood');
      expect(tree.directDependencies).toHaveLength(0);
      expect(tree.totalDependencyCount).toBe(0);
      expect(tree.maxDepth).toBe(0);
    });

    it('should build dependency tree with direct dependencies', async () => {
      const responses: Record<string, unknown> = {
        '/Game/Materials/M_Wood': {
          assetPath: '/Game/Materials/M_Wood',
          className: 'Material',
          dependencies: ['/Game/Textures/T_Wood_Diffuse', '/Game/Textures/T_Wood_Normal'],
          referencedBy: [],
        },
        '/Game/Textures/T_Wood_Diffuse': {
          assetPath: '/Game/Textures/T_Wood_Diffuse',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Materials/M_Wood'],
        },
        '/Game/Textures/T_Wood_Normal': {
          assetPath: '/Game/Textures/T_Wood_Normal',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Materials/M_Wood'],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? {});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const tree = await analyzer.buildDependencyTree('/Game/Materials/M_Wood');

      expect(tree.root).toBe('/Game/Materials/M_Wood');
      expect(tree.directDependencies).toHaveLength(2);
      expect(tree.totalDependencyCount).toBe(2);
      expect(tree.maxDepth).toBe(1);
    });

    it('should build dependency tree with nested dependencies', async () => {
      const responses: Record<string, unknown> = {
        '/Game/Blueprints/BP_Actor': {
          assetPath: '/Game/Blueprints/BP_Actor',
          className: 'Blueprint',
          dependencies: ['/Game/Meshes/SM_Cube'],
          referencedBy: [],
        },
        '/Game/Meshes/SM_Cube': {
          assetPath: '/Game/Meshes/SM_Cube',
          className: 'StaticMesh',
          dependencies: ['/Game/Materials/M_Default'],
          referencedBy: ['/Game/Blueprints/BP_Actor'],
        },
        '/Game/Materials/M_Default': {
          assetPath: '/Game/Materials/M_Default',
          className: 'Material',
          dependencies: ['/Game/Textures/T_Default'],
          referencedBy: ['/Game/Meshes/SM_Cube'],
        },
        '/Game/Textures/T_Default': {
          assetPath: '/Game/Textures/T_Default',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Materials/M_Default'],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? {});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const tree = await analyzer.buildDependencyTree('/Game/Blueprints/BP_Actor');

      expect(tree.root).toBe('/Game/Blueprints/BP_Actor');
      expect(tree.totalDependencyCount).toBe(3);
      expect(tree.maxDepth).toBe(3);
    });


    it('should handle circular dependencies without infinite loop', async () => {
      const responses: Record<string, unknown> = {
        '/Game/A': {
          assetPath: '/Game/A',
          className: 'Blueprint',
          dependencies: ['/Game/B'],
          referencedBy: ['/Game/B'],
        },
        '/Game/B': {
          assetPath: '/Game/B',
          className: 'Blueprint',
          dependencies: ['/Game/A'],
          referencedBy: ['/Game/A'],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? {});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const tree = await analyzer.buildDependencyTree('/Game/A');

      // Should complete without hanging
      expect(tree.root).toBe('/Game/A');
      expect(tree.totalDependencyCount).toBe(1); // Only B, A is root
    });

    it('should use cache for repeated calls', async () => {
      const client = createMcpClientWithResponse({
        assetPath: '/Game/Cached',
        className: 'Texture2D',
        dependencies: [],
        referencedBy: [],
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const tree1 = await analyzer.buildDependencyTree('/Game/Cached');
      const tree2 = await analyzer.buildDependencyTree('/Game/Cached');

      expect(tree1).toEqual(tree2);
    });

    it('should correctly identify asset types in dependency nodes', async () => {
      const responses: Record<string, unknown> = {
        '/Game/Materials/M_Test': {
          assetPath: '/Game/Materials/M_Test',
          className: 'Material',
          dependencies: ['/Game/Textures/T_Test'],
          referencedBy: [],
        },
        '/Game/Textures/T_Test': {
          assetPath: '/Game/Textures/T_Test',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Materials/M_Test'],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? {});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const tree = await analyzer.buildDependencyTree('/Game/Materials/M_Test');

      expect(tree.directDependencies[0].assetType).toBe('Texture2D');
    });
  });

  describe('findOrphanedAssets', () => {
    it('should find assets with no incoming references', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_Used', className: 'Texture2D', dependencies: [], referencedBy: [] },
        { assetPath: '/Game/Textures/T_Orphan', className: 'Texture2D', dependencies: [], referencedBy: [] },
        { assetPath: '/Game/Materials/M_User', className: 'Material', dependencies: ['/Game/Textures/T_Used'], referencedBy: [] },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const orphaned = await analyzer.findOrphanedAssets();

      // T_Orphan has no references, T_Used is referenced by M_User
      // M_User has no references but is not orphaned because it references T_Used
      const orphanPaths = orphaned.map((o) => o.assetPath);
      expect(orphanPaths).toContain('/Game/Textures/T_Orphan');
    });

    it('should not mark root assets as orphaned', async () => {
      const assets = [
        { assetPath: '/Game/Maps/MainLevel', className: 'World', dependencies: [], referencedBy: [] },
        { assetPath: '/Game/Blueprints/BP_GameMode', className: 'Blueprint', dependencies: [], referencedBy: [] },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const orphaned = await analyzer.findOrphanedAssets();

      // Maps and GameMode should not be marked as orphaned
      const orphanPaths = orphaned.map((o) => o.assetPath);
      expect(orphanPaths).not.toContain('/Game/Maps/MainLevel');
    });

    it('should return empty array when no orphaned assets exist', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_A', className: 'Texture2D', dependencies: [], referencedBy: [] },
        { assetPath: '/Game/Materials/M_A', className: 'Material', dependencies: ['/Game/Textures/T_A'], referencedBy: [] },
      ];

      // T_A is referenced by M_A, M_A has no references but references T_A
      // Both have at least one connection
      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const orphaned = await analyzer.findOrphanedAssets();

      // M_A has no incoming references but is not a root asset
      // T_A has incoming reference from M_A
      expect(orphaned.some((o) => o.assetPath === '/Game/Textures/T_A')).toBe(false);
    });

    it('should include estimated size for orphaned assets', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_Orphan', className: 'Texture2D', dependencies: [], referencedBy: [], memorySize: 4194304 },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const orphaned = await analyzer.findOrphanedAssets();

      expect(orphaned.length).toBeGreaterThan(0);
      expect(orphaned[0].estimatedSize).toBe(4194304);
    });

    it('should suggest delete for test/temp assets', async () => {
      const assets = [
        { assetPath: '/Game/Test/T_TestTexture', className: 'Texture2D', dependencies: [], referencedBy: [] },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const orphaned = await analyzer.findOrphanedAssets();

      const testAsset = orphaned.find((o) => o.assetPath.includes('Test'));
      expect(testAsset?.suggestion).toBe('delete');
    });
  });


  describe('analyzeChunkDuplication', () => {
    it('should detect assets in multiple chunks', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_Shared', className: 'Texture2D', chunkId: 1, memorySize: 1048576 },
        { assetPath: '/Game/Textures/T_Shared', className: 'Texture2D', chunkId: 2, memorySize: 1048576 },
        { assetPath: '/Game/Textures/T_Unique', className: 'Texture2D', chunkId: 1, memorySize: 524288 },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeChunkDuplication();

      expect(report.duplicatedAssets).toHaveLength(1);
      expect(report.duplicatedAssets[0].assetPath).toBe('/Game/Textures/T_Shared');
      expect(report.duplicatedAssets[0].chunks).toContain(1);
      expect(report.duplicatedAssets[0].chunks).toContain(2);
    });

    it('should report no duplication when assets are unique per chunk', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_A', className: 'Texture2D', chunkId: 1, memorySize: 1048576 },
        { assetPath: '/Game/Textures/T_B', className: 'Texture2D', chunkId: 2, memorySize: 1048576 },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeChunkDuplication();

      expect(report.duplicatedAssets).toHaveLength(0);
      expect(report.totalWastedSizeMB).toBe(0);
    });

    it('should calculate wasted size correctly', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_Big', className: 'Texture2D', chunkId: 1, memorySize: 10485760 },
        { assetPath: '/Game/Textures/T_Big', className: 'Texture2D', chunkId: 2, memorySize: 10485760 },
        { assetPath: '/Game/Textures/T_Big', className: 'Texture2D', chunkId: 3, memorySize: 10485760 },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeChunkDuplication();

      expect(report.duplicatedAssets).toHaveLength(1);
      expect(report.duplicatedAssets[0].chunks).toHaveLength(3);
      // Wasted = 10MB * 2 (3 chunks - 1) = 20MB
      expect(report.totalWastedSizeMB).toBeGreaterThan(0);
    });

    it('should provide recommendations when duplications found', async () => {
      const assets = [
        { assetPath: '/Game/Textures/T_Dup', className: 'Texture2D', chunkId: 1, memorySize: 1048576 },
        { assetPath: '/Game/Textures/T_Dup', className: 'Texture2D', chunkId: 2, memorySize: 1048576 },
      ];

      const client = createMockMcpClient((_toolName, params) => {
        if (params.path === '/Game') {
          return Promise.resolve(assets);
        }
        return Promise.resolve({});
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeChunkDuplication();

      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle empty asset list', async () => {
      const client = createMcpClientWithResponse([]);
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeChunkDuplication();

      expect(report.duplicatedAssets).toHaveLength(0);
      expect(report.totalWastedSizeMB).toBe(0);
    });
  });

  describe('getImpactAnalysis', () => {
    it('should report safe to delete when no references exist', async () => {
      const client = createMcpClientWithResponse({
        assetPath: '/Game/Textures/T_Unused',
        className: 'Texture2D',
        dependencies: [],
        referencedBy: [],
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const analysis = await analyzer.getImpactAnalysis('/Game/Textures/T_Unused');

      expect(analysis.targetAsset).toBe('/Game/Textures/T_Unused');
      expect(analysis.directReferences).toHaveLength(0);
      expect(analysis.indirectReferences).toHaveLength(0);
      expect(analysis.totalAffectedAssets).toBe(0);
      expect(analysis.safeToDelete).toBe(true);
      expect(analysis.warnings).toHaveLength(0);
    });

    it('should list direct references', async () => {
      const responses: Record<string, unknown> = {
        '/Game/Textures/T_Wood': {
          assetPath: '/Game/Textures/T_Wood',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Materials/M_Wood', '/Game/Materials/M_WoodDark'],
        },
        '/Game/Materials/M_Wood': {
          assetPath: '/Game/Materials/M_Wood',
          className: 'Material',
          dependencies: ['/Game/Textures/T_Wood'],
          referencedBy: [],
        },
        '/Game/Materials/M_WoodDark': {
          assetPath: '/Game/Materials/M_WoodDark',
          className: 'Material',
          dependencies: ['/Game/Textures/T_Wood'],
          referencedBy: [],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const analysis = await analyzer.getImpactAnalysis('/Game/Textures/T_Wood');

      expect(analysis.directReferences).toHaveLength(2);
      expect(analysis.directReferences).toContain('/Game/Materials/M_Wood');
      expect(analysis.directReferences).toContain('/Game/Materials/M_WoodDark');
      expect(analysis.safeToDelete).toBe(false);
    });

    it('should find indirect references', async () => {
      const responses: Record<string, unknown> = {
        '/Game/Textures/T_Base': {
          assetPath: '/Game/Textures/T_Base',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Materials/M_Base'],
        },
        '/Game/Materials/M_Base': {
          assetPath: '/Game/Materials/M_Base',
          className: 'Material',
          dependencies: ['/Game/Textures/T_Base'],
          referencedBy: ['/Game/Meshes/SM_Wall'],
        },
        '/Game/Meshes/SM_Wall': {
          assetPath: '/Game/Meshes/SM_Wall',
          className: 'StaticMesh',
          dependencies: ['/Game/Materials/M_Base'],
          referencedBy: [],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const analysis = await analyzer.getImpactAnalysis('/Game/Textures/T_Base');

      expect(analysis.directReferences).toContain('/Game/Materials/M_Base');
      expect(analysis.indirectReferences).toContain('/Game/Meshes/SM_Wall');
      expect(analysis.totalAffectedAssets).toBe(2);
      expect(analysis.safeToDelete).toBe(false);
    });

    it('should warn about root asset references', async () => {
      const responses: Record<string, unknown> = {
        '/Game/Textures/T_Critical': {
          assetPath: '/Game/Textures/T_Critical',
          className: 'Texture2D',
          dependencies: [],
          referencedBy: ['/Game/Maps/MainLevel'],
        },
        '/Game/Maps/MainLevel': {
          assetPath: '/Game/Maps/MainLevel',
          className: 'World',
          dependencies: ['/Game/Textures/T_Critical'],
          referencedBy: [],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        const assetPath = params.assetPath as string;
        return Promise.resolve(responses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const analysis = await analyzer.getImpactAnalysis('/Game/Textures/T_Critical');

      expect(analysis.safeToDelete).toBe(false);
      expect(analysis.warnings.some((w) => w.includes('重要資產'))).toBe(true);
    });

    it('should generate warnings for direct references', async () => {
      const client = createMcpClientWithResponse({
        assetPath: '/Game/Textures/T_Ref',
        className: 'Texture2D',
        dependencies: [],
        referencedBy: ['/Game/Materials/M_A'],
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const analysis = await analyzer.getImpactAnalysis('/Game/Textures/T_Ref');

      expect(analysis.warnings.length).toBeGreaterThan(0);
      expect(analysis.warnings.some((w) => w.includes('直接參照'))).toBe(true);
    });
  });


  describe('analyzeWorldPartitionDependencies', () => {
    it('should analyze data layer dependencies', async () => {
      const layers = [
        { name: 'Landscape', assets: ['/Game/Landscape/L_Terrain'] },
        { name: 'Buildings', assets: ['/Game/Buildings/SM_House'] },
      ];

      const assetResponses: Record<string, unknown> = {
        '/Game/Landscape/L_Terrain': {
          assetPath: '/Game/Landscape/L_Terrain',
          className: 'Landscape',
          dependencies: [],
          referencedBy: ['/Game/Buildings/SM_House'],
        },
        '/Game/Buildings/SM_House': {
          assetPath: '/Game/Buildings/SM_House',
          className: 'StaticMesh',
          dependencies: ['/Game/Landscape/L_Terrain'],
          referencedBy: [],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        if (params.includeDataLayers) {
          return Promise.resolve(layers);
        }
        const assetPath = params.assetPath as string;
        return Promise.resolve(assetResponses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeWorldPartitionDependencies();

      expect(report.dataLayers).toHaveLength(2);
      expect(report.dataLayers.find((l) => l.name === 'Buildings')?.dependencies).toContain('Landscape');
    });

    it('should detect cross-layer dependencies', async () => {
      const layers = [
        { name: 'LayerA', assets: ['/Game/A/Asset1'] },
        { name: 'LayerB', assets: ['/Game/B/Asset2'] },
      ];

      const assetResponses: Record<string, unknown> = {
        '/Game/A/Asset1': {
          assetPath: '/Game/A/Asset1',
          className: 'Blueprint',
          dependencies: ['/Game/B/Asset2'],
          referencedBy: [],
        },
        '/Game/B/Asset2': {
          assetPath: '/Game/B/Asset2',
          className: 'Blueprint',
          dependencies: [],
          referencedBy: ['/Game/A/Asset1'],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        if (params.includeDataLayers) {
          return Promise.resolve(layers);
        }
        const assetPath = params.assetPath as string;
        return Promise.resolve(assetResponses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeWorldPartitionDependencies();

      expect(report.crossLayerDependencies.length).toBeGreaterThan(0);
      const crossDep = report.crossLayerDependencies.find(
        (c) => c.from === 'LayerA' && c.to === 'LayerB'
      );
      expect(crossDep).toBeDefined();
      expect(crossDep?.assets).toContain('/Game/A/Asset1');
    });

    it('should handle empty data layers', async () => {
      const client = createMcpClientWithResponse([]);
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeWorldPartitionDependencies();

      expect(report.dataLayers).toHaveLength(0);
      expect(report.crossLayerDependencies).toHaveLength(0);
    });

    it('should provide recommendations for many cross-layer dependencies', async () => {
      // Create many cross-layer dependencies
      const layers: Array<{ name: string; assets: string[] }> = [];
      const assetResponses: Record<string, unknown> = {};

      for (let i = 0; i < 15; i++) {
        const layerName = `Layer${i}`;
        const assetPath = `/Game/Layer${i}/Asset`;
        const nextAssetPath = `/Game/Layer${(i + 1) % 15}/Asset`;

        layers.push({ name: layerName, assets: [assetPath] });
        assetResponses[assetPath] = {
          assetPath,
          className: 'Blueprint',
          dependencies: [nextAssetPath],
          referencedBy: [],
        };
      }

      const client = createMockMcpClient((_toolName, params) => {
        if (params.includeDataLayers) {
          return Promise.resolve(layers);
        }
        const assetPath = params.assetPath as string;
        return Promise.resolve(assetResponses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeWorldPartitionDependencies();

      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect circular layer dependencies', async () => {
      const layers = [
        { name: 'LayerA', assets: ['/Game/A/Asset'] },
        { name: 'LayerB', assets: ['/Game/B/Asset'] },
      ];

      const assetResponses: Record<string, unknown> = {
        '/Game/A/Asset': {
          assetPath: '/Game/A/Asset',
          className: 'Blueprint',
          dependencies: ['/Game/B/Asset'],
          referencedBy: ['/Game/B/Asset'],
        },
        '/Game/B/Asset': {
          assetPath: '/Game/B/Asset',
          className: 'Blueprint',
          dependencies: ['/Game/A/Asset'],
          referencedBy: ['/Game/A/Asset'],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        if (params.includeDataLayers) {
          return Promise.resolve(layers);
        }
        const assetPath = params.assetPath as string;
        return Promise.resolve(assetResponses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeWorldPartitionDependencies();

      // Should detect circular dependency and provide recommendation
      const hasCircularWarning = report.recommendations.some((r) => r.includes('循環'));
      expect(hasCircularWarning).toBe(true);
    });

    it('should track layer dependents correctly', async () => {
      const layers = [
        { name: 'Base', assets: ['/Game/Base/Asset'] },
        { name: 'Derived', assets: ['/Game/Derived/Asset'] },
      ];

      const assetResponses: Record<string, unknown> = {
        '/Game/Base/Asset': {
          assetPath: '/Game/Base/Asset',
          className: 'Blueprint',
          dependencies: [],
          referencedBy: ['/Game/Derived/Asset'],
        },
        '/Game/Derived/Asset': {
          assetPath: '/Game/Derived/Asset',
          className: 'Blueprint',
          dependencies: ['/Game/Base/Asset'],
          referencedBy: [],
        },
      };

      const client = createMockMcpClient((_toolName, params) => {
        if (params.includeDataLayers) {
          return Promise.resolve(layers);
        }
        const assetPath = params.assetPath as string;
        return Promise.resolve(assetResponses[assetPath] ?? { dependencies: [], referencedBy: [] });
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeWorldPartitionDependencies();

      const baseLayer = report.dataLayers.find((l) => l.name === 'Base');
      expect(baseLayer?.dependents).toContain('Derived');
    });
  });

  describe('caching behavior', () => {
    it('should use cache for all analysis methods', async () => {
      const client = createMcpClientWithResponse({
        assetPath: '/Game/Test',
        className: 'Blueprint',
        dependencies: [],
        referencedBy: [],
      });
      const analyzer = new DependencyAnalyzer(client, cacheManager);

      // First calls
      await analyzer.buildDependencyTree('/Game/Test');
      await analyzer.findOrphanedAssets();
      await analyzer.analyzeChunkDuplication();
      await analyzer.getImpactAnalysis('/Game/Test');
      await analyzer.analyzeWorldPartitionDependencies();

      // Second calls should use cache
      const tree = await analyzer.buildDependencyTree('/Game/Test');
      const orphaned = await analyzer.findOrphanedAssets();
      const chunks = await analyzer.analyzeChunkDuplication();
      const impact = await analyzer.getImpactAnalysis('/Game/Test');
      const wp = await analyzer.analyzeWorldPartitionDependencies();

      expect(tree).toBeDefined();
      expect(orphaned).toBeDefined();
      expect(chunks).toBeDefined();
      expect(impact).toBeDefined();
      expect(wp).toBeDefined();
    });
  });
});
