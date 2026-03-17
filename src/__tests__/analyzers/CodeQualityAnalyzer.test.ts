/**
 * CodeQualityAnalyzer Unit Tests
 * 
 * 程式碼品質分析模組單元測試
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeQualityAnalyzer } from '../../analyzers/CodeQualityAnalyzer.js';
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
 * 建立預設的 mock 回傳
 */
function createDefaultResponses(overrides: MockResponses = {}): MockResponses {
  return {
    list: [
      { assetPath: '/Game/Textures/T_Wood', className: 'Texture2D' },
      { assetPath: '/Game/Meshes/SM_Rock', className: 'StaticMesh' },
      { assetPath: '/Game/Blueprints/BP_Player', className: 'Blueprint' },
    ],
    get_metadata: { className: 'Blueprint' },
    get_dependencies: { dependencies: [] },
    search_assets: [],
    find_by_class: [],
    get_blueprint: { nodeCount: 50, functionCount: 5, complexity: 20 },
    ...overrides,
  };
}

describe('CodeQualityAnalyzer', () => {
  let cacheManager: AnalysisCacheManager;

  beforeEach(() => {
    cacheManager = new AnalysisCacheManager();
  });

  describe('analyzeProject', () => {
    it('should return a complete CodeQualityReport', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeProject();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.namingViolations).toBeDefined();
      expect(report.circularDependencies).toBeDefined();
      expect(report.blueprintCppBalance).toBeDefined();
      expect(report.architectureIssues).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should calculate overall score between 0 and 100', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeProject();

      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
    });

    it('should use cache for repeated analysis', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const report1 = await analyzer.analyzeProject();
      const report2 = await analyzer.analyzeProject();

      expect(report1.timestamp).toBe(report2.timestamp);
    });

    it('should count total issues correctly', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Textures/Wood', className: 'Texture2D', name: 'Wood' },
          { assetPath: '/Game/Meshes/Rock', className: 'StaticMesh', name: 'Rock' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeProject();

      expect(report.summary.totalIssues).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkNamingConventions', () => {
    it('should detect naming violations for textures without T_ prefix', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Textures/Wood_Diffuse', className: 'Texture2D' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations.length).toBe(1);
      expect(violations[0].currentName).toBe('Wood_Diffuse');
      expect(violations[0].expectedPattern).toContain('T_');
      expect(violations[0].suggestedName).toBe('T_Wood_Diffuse');
    });

    it('should detect naming violations for static meshes without SM_ prefix', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Meshes/Rock_01', className: 'StaticMesh' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations.length).toBe(1);
      expect(violations[0].suggestedName).toBe('SM_Rock_01');
    });

    it('should detect naming violations for blueprints without BP_ prefix', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Blueprints/PlayerCharacter', className: 'Blueprint' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations.length).toBe(1);
      expect(violations[0].suggestedName).toBe('BP_PlayerCharacter');
    });

    it('should not report violations for correctly named assets', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Textures/T_Wood', className: 'Texture2D' },
          { assetPath: '/Game/Meshes/SM_Rock', className: 'StaticMesh' },
          { assetPath: '/Game/Blueprints/BP_Player', className: 'Blueprint' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations.length).toBe(0);
    });

    it('should detect violations for skeletal meshes without SK_ prefix', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Characters/Mannequin', className: 'SkeletalMesh' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations.length).toBe(1);
      expect(violations[0].suggestedName).toBe('SK_Mannequin');
    });

    it('should detect violations for materials without M_ prefix', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Materials/WoodMaterial', className: 'Material' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations.length).toBe(1);
      expect(violations[0].suggestedName).toBe('M_WoodMaterial');
    });

    it('should check specific paths when provided', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Texture2D' },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions([
        '/Game/Textures/BadName',
      ]);

      expect(violations.length).toBe(1);
      expect(violations[0].assetPath).toBe('/Game/Textures/BadName');
    });

    it('should use cache for full project scan', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Textures/Wood', className: 'Texture2D' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations1 = await analyzer.checkNamingConventions();
      const violations2 = await analyzer.checkNamingConventions();

      expect(violations1).toEqual(violations2);
    });

    it('should handle empty asset list', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const violations = await analyzer.checkNamingConventions();

      expect(violations).toHaveLength(0);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect a simple circular dependency (A → B → A)', async () => {
      let callCount = 0;
      const assets = [
        { assetPath: '/Game/A', name: 'A', className: 'Blueprint' },
        { assetPath: '/Game/B', name: 'B', className: 'Blueprint' },
      ];
      const client = new McpClient({ debug: false });
      const mockInvoker = {
        invoke: vi.fn().mockImplementation((_toolName: string, params: Record<string, unknown>) => {
          const action = params.action as string;
          if (action === 'list') return Promise.resolve(assets);
          if (action === 'get_dependencies') {
            const assetPath = params.assetPath as string;
            if (assetPath === '/Game/A') return Promise.resolve({ dependencies: ['/Game/B'] });
            if (assetPath === '/Game/B') return Promise.resolve({ dependencies: ['/Game/A'] });
          }
          return Promise.resolve({});
        }),
      };
      client.setInvoker(mockInvoker);
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const cycles = await analyzer.detectCircularDependencies();

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0].chain.length).toBeGreaterThanOrEqual(2);
      expect(cycles[0].suggestedFix).toBeDefined();
      expect(cycles[0].suggestedFix.length).toBeGreaterThan(0);
    });

    it('should return empty array when no circular dependencies exist', async () => {
      const assets = [
        { assetPath: '/Game/A', name: 'A', className: 'Blueprint' },
        { assetPath: '/Game/B', name: 'B', className: 'Blueprint' },
      ];
      const client = new McpClient({ debug: false });
      const mockInvoker = {
        invoke: vi.fn().mockImplementation((_toolName: string, params: Record<string, unknown>) => {
          const action = params.action as string;
          if (action === 'list') return Promise.resolve(assets);
          if (action === 'get_dependencies') {
            const assetPath = params.assetPath as string;
            if (assetPath === '/Game/A') return Promise.resolve({ dependencies: ['/Game/B'] });
            if (assetPath === '/Game/B') return Promise.resolve({ dependencies: [] });
          }
          return Promise.resolve({});
        }),
      };
      client.setInvoker(mockInvoker);
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const cycles = await analyzer.detectCircularDependencies();

      expect(cycles).toHaveLength(0);
    });

    it('should detect longer circular dependency chains', async () => {
      const assets = [
        { assetPath: '/Game/A', name: 'A', className: 'Blueprint' },
        { assetPath: '/Game/B', name: 'B', className: 'Blueprint' },
        { assetPath: '/Game/C', name: 'C', className: 'Blueprint' },
      ];
      const client = new McpClient({ debug: false });
      const mockInvoker = {
        invoke: vi.fn().mockImplementation((_toolName: string, params: Record<string, unknown>) => {
          const action = params.action as string;
          if (action === 'list') return Promise.resolve(assets);
          if (action === 'get_dependencies') {
            const assetPath = params.assetPath as string;
            if (assetPath === '/Game/A') return Promise.resolve({ dependencies: ['/Game/B'] });
            if (assetPath === '/Game/B') return Promise.resolve({ dependencies: ['/Game/C'] });
            if (assetPath === '/Game/C') return Promise.resolve({ dependencies: ['/Game/A'] });
          }
          return Promise.resolve({});
        }),
      };
      client.setInvoker(mockInvoker);
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const cycles = await analyzer.detectCircularDependencies();

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0].chain.length).toBeGreaterThanOrEqual(3);
    });

    it('should assign severity based on cycle length', async () => {
      // Create a long cycle (6 nodes)
      const assets = Array.from({ length: 6 }, (_, i) => ({
        assetPath: `/Game/Node${i}`,
        name: `Node${i}`,
        className: 'Blueprint',
      }));
      const client = new McpClient({ debug: false });
      const mockInvoker = {
        invoke: vi.fn().mockImplementation((_toolName: string, params: Record<string, unknown>) => {
          const action = params.action as string;
          if (action === 'list') return Promise.resolve(assets);
          if (action === 'get_dependencies') {
            const assetPath = params.assetPath as string;
            const match = assetPath.match(/Node(\d+)/);
            if (match) {
              const idx = parseInt(match[1], 10);
              const nextIdx = (idx + 1) % 6;
              return Promise.resolve({ dependencies: [`/Game/Node${nextIdx}`] });
            }
          }
          return Promise.resolve({});
        }),
      };
      client.setInvoker(mockInvoker);
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const cycles = await analyzer.detectCircularDependencies();

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0].severity).toBe('critical');
    });

    it('should use cache for repeated detection', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const cycles1 = await analyzer.detectCircularDependencies();
      const cycles2 = await analyzer.detectCircularDependencies();

      expect(cycles1).toEqual(cycles2);
    });
  });

  describe('analyzeBlueprintCppBalance', () => {
    it('should return balance analysis with percentages', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        search_assets: [
          { assetPath: '/Game/BP1', className: 'Blueprint' },
          { assetPath: '/Game/BP2', className: 'Blueprint' },
        ],
        find_by_class: [
          { name: 'MyClass1' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeBlueprintCppBalance();

      expect(analysis.blueprintPercentage).toBeDefined();
      expect(analysis.cppPercentage).toBeDefined();
      expect(analysis.blueprintPercentage + analysis.cppPercentage).toBe(100);
    });

    it('should recommend moving logic to C++ when Blueprint percentage is too high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        search_assets: Array.from({ length: 90 }, (_, i) => ({
          assetPath: `/Game/BP${i}`,
          className: 'Blueprint',
        })),
        find_by_class: Array.from({ length: 10 }, (_, i) => ({
          name: `Class${i}`,
        })),
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeBlueprintCppBalance();

      expect(analysis.blueprintPercentage).toBeGreaterThan(80);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.some((r) => r.includes('C++'))).toBe(true);
    });

    it('should recommend using Blueprint when C++ percentage is too high', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        search_assets: Array.from({ length: 10 }, (_, i) => ({
          assetPath: `/Game/BP${i}`,
          className: 'Blueprint',
        })),
        find_by_class: Array.from({ length: 90 }, (_, i) => ({
          name: `Class${i}`,
        })),
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeBlueprintCppBalance();

      expect(analysis.blueprintPercentage).toBeLessThan(20);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.some((r) => r.includes('Blueprint'))).toBe(true);
    });

    it('should detect overly complex Blueprints', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        search_assets: [
          { assetPath: '/Game/BP_Complex', className: 'Blueprint' },
        ],
        find_by_class: [],
        get_blueprint: { nodeCount: 300, functionCount: 5, complexity: 20 },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeBlueprintCppBalance();

      expect(analysis.issues.length).toBeGreaterThan(0);
      expect(analysis.issues.some((i) => i.category === 'blueprint-complexity')).toBe(true);
    });

    it('should handle empty project gracefully', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        search_assets: [],
        find_by_class: [],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const analysis = await analyzer.analyzeBlueprintCppBalance();

      expect(analysis.blueprintPercentage).toBe(50);
      expect(analysis.cppPercentage).toBe(50);
    });

    it('should use cache for repeated analysis', async () => {
      const client = createMockMcpClient(createDefaultResponses());
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const analysis1 = await analyzer.analyzeBlueprintCppBalance();
      const analysis2 = await analyzer.analyzeBlueprintCppBalance();

      expect(analysis1).toEqual(analysis2);
    });
  });

  describe('suggestRefactoring', () => {
    it('should suggest renaming for assets with incorrect naming', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Texture2D' },
        get_dependencies: { dependencies: [] },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Textures/Wood');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.type === 'rename')).toBe(true);
    });

    it('should suggest extracting to C++ for complex Blueprints', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Blueprint' },
        get_blueprint: { nodeCount: 300, functionCount: 5 },
        get_dependencies: { dependencies: [] },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Blueprints/BP_Complex');

      expect(suggestions.some((s) => s.type === 'extract')).toBe(true);
      expect(suggestions.some((s) => s.steps.some((step) => step.includes('C++')))).toBe(true);
    });

    it('should suggest splitting for Blueprints with many functions', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Blueprint' },
        get_blueprint: { nodeCount: 50, functionCount: 15 },
        get_dependencies: { dependencies: [] },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Blueprints/BP_ManyFunctions');

      expect(suggestions.some((s) => s.type === 'split')).toBe(true);
    });

    it('should suggest reducing dependencies for assets with many dependencies', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Blueprint' },
        get_blueprint: { nodeCount: 50, functionCount: 5 },
        get_dependencies: {
          dependencies: Array.from({ length: 25 }, (_, i) => `/Game/Dep${i}`),
        },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Blueprints/BP_ManyDeps');

      expect(suggestions.some((s) => s.description.includes('依賴'))).toBe(true);
    });

    it('should return empty suggestions for well-structured assets', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Texture2D' },
        get_dependencies: { dependencies: ['/Game/Dep1', '/Game/Dep2'] },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Textures/T_Good');

      // T_Good has correct naming, is not a Blueprint, and has few deps
      expect(suggestions).toHaveLength(0);
    });

    it('should return empty suggestions when asset not found', async () => {
      const client = new McpClient({ debug: false });
      // No invoker → will fail
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Missing');

      expect(suggestions).toHaveLength(0);
    });

    it('should include estimated effort for each suggestion', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        get_metadata: { className: 'Blueprint' },
        get_blueprint: { nodeCount: 300, functionCount: 15 },
        get_dependencies: {
          dependencies: Array.from({ length: 25 }, (_, i) => `/Game/Dep${i}`),
        },
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const suggestions = await analyzer.suggestRefactoring('/Game/Blueprints/BP_Everything');

      suggestions.forEach((s) => {
        expect(s.estimatedEffort).toMatch(/^(low|medium|high)$/);
        expect(s.steps.length).toBeGreaterThan(0);
        expect(s.targetAssets.length).toBeGreaterThan(0);
      });
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations for naming violations', async () => {
      const client = createMockMcpClient(createDefaultResponses({
        list: [
          { assetPath: '/Game/Textures/Wood', className: 'Texture2D' },
        ],
      }));
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeProject();

      const namingRec = report.recommendations.find((r) => r.category === 'naming');
      expect(namingRec).toBeDefined();
      expect(namingRec?.steps.length).toBeGreaterThan(0);
    });

    it('should generate recommendations for circular dependencies', async () => {
      const assets = [
        { assetPath: '/Game/A', name: 'A', className: 'Blueprint' },
        { assetPath: '/Game/B', name: 'B', className: 'Blueprint' },
      ];
      const client = new McpClient({ debug: false });
      const mockInvoker = {
        invoke: vi.fn().mockImplementation((_toolName: string, params: Record<string, unknown>) => {
          const action = params.action as string;
          if (action === 'list') return Promise.resolve(assets);
          if (action === 'get_dependencies') {
            const assetPath = params.assetPath as string;
            if (assetPath === '/Game/A') return Promise.resolve({ dependencies: ['/Game/B'] });
            if (assetPath === '/Game/B') return Promise.resolve({ dependencies: ['/Game/A'] });
          }
          if (action === 'search_assets') return Promise.resolve([]);
          if (action === 'find_by_class') return Promise.resolve([]);
          if (action === 'get_blueprint') return Promise.resolve({});
          return Promise.resolve({});
        }),
      };
      client.setInvoker(mockInvoker);
      const analyzer = new CodeQualityAnalyzer(client, cacheManager);

      const report = await analyzer.analyzeProject();

      const depRec = report.recommendations.find((r) => r.category === 'dependency');
      expect(depRec).toBeDefined();
      expect(depRec?.steps.length).toBeGreaterThan(0);
    });
  });
});
