/**
 * ReportGenerator Unit Tests
 * 
 * Validates: Requirements 18.2, 18.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReportGenerator } from '../../generators/ReportGenerator.js';
import type { ReportConfig } from '../../types/report.js';
import type {
  PerformanceReport,
  CodeQualityReport,
  CompatibilityReport,
} from '../../types/analysis.js';
import type { AssetAnalysisResult } from '../../types/asset.js';

// ─── Test Fixtures ───

function makeAssetAnalysis(overrides: Partial<AssetAnalysisResult> = {}): AssetAnalysisResult {
  return {
    assetPath: '/Game/Meshes/SM_Rock',
    assetType: 'StaticMesh',
    detectedIssues: [],
    suggestedPreset: 'StaticMesh_Nanite',
    naniteCompatible: true,
    estimatedMemory: 64,
    ...overrides,
  };
}

function makePerformanceReport(overrides: Partial<PerformanceReport> = {}): PerformanceReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    summary: {
      overallScore: 75,
      criticalIssues: 1,
      warnings: 2,
      estimatedFps: { low: 30, mid: 60, high: 120 },
    },
    drawCallAnalysis: {
      totalDrawCalls: 3000,
      staticMeshDrawCalls: 2000,
      skeletalMeshDrawCalls: 500,
      particleDrawCalls: 300,
      uiDrawCalls: 200,
      recommendations: [],
    },
    memoryAnalysis: {
      totalMemoryMB: 4096,
      textureMemoryMB: 2048,
      meshMemoryMB: 1024,
      audioMemoryMB: 512,
      scriptMemoryMB: 512,
      recommendations: [],
    },
    gpuAnalysis: {
      gpuTimeMs: 12.5,
      shaderComplexity: 45,
      overdrawRatio: 1.5,
      recommendations: [],
    },
    naniteAnalysis: {
      enabled: true,
      naniteTriangles: 500000,
      fallbackTriangles: 100000,
      streamingPoolSizeMB: 512,
      recommendations: [],
    },
    lumenAnalysis: {
      globalIlluminationEnabled: true,
      reflectionsEnabled: true,
      rayTracingEnabled: false,
      qualityLevel: 'High',
      recommendations: [],
    },
    antiPatterns: [
      {
        id: 'too-many-dynamic-lights',
        severity: 'warning',
        category: 'lighting',
        description: 'Too many dynamic lights',
        affectedAssets: ['/Game/Lights/PointLight1'],
        fix: 'Use static or stationary lights',
        estimatedImprovement: 'Reduce 2ms GPU time',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        priority: 'high',
        category: 'rendering',
        title: 'Reduce Draw Calls',
        description: 'Draw calls are high',
        steps: ['Merge meshes', 'Enable Nanite'],
        estimatedImpact: 'Improve 5-10 FPS',
        relatedIssues: [],
      },
    ],
    ...overrides,
  };
}

function makeCodeQualityReport(overrides: Partial<CodeQualityReport> = {}): CodeQualityReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    summary: {
      overallScore: 80,
      totalIssues: 5,
      criticalIssues: 1,
      warnings: 2,
      suggestions: 2,
    },
    namingViolations: [
      {
        assetPath: '/Game/Meshes/rock01',
        currentName: 'rock01',
        expectedPattern: 'SM_[Name]',
        suggestedName: 'SM_Rock01',
      },
    ],
    circularDependencies: [
      {
        chain: ['A', 'B', 'C', 'A'],
        severity: 'warning',
        suggestedFix: 'Extract shared interface',
      },
    ],
    blueprintCppBalance: {
      blueprintPercentage: 70,
      cppPercentage: 30,
      recommendations: ['Move performance-critical logic to C++'],
      issues: [],
    },
    architectureIssues: [
      {
        id: 'arch-1',
        severity: 'warning',
        category: 'coupling',
        description: 'High coupling between modules',
        affectedFiles: ['/Source/MyGame/A.cpp', '/Source/MyGame/B.cpp'],
        suggestedRefactoring: 'Use dependency injection',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        priority: 'medium',
        category: 'naming',
        title: 'Fix naming conventions',
        description: 'Several assets violate naming rules',
        steps: ['Rename assets following SM_/T_/M_ prefixes'],
        estimatedImpact: 'Improved project organization',
        relatedIssues: [],
      },
    ],
    ...overrides,
  };
}

function makeCompatibilityReport(overrides: Partial<CompatibilityReport> = {}): CompatibilityReport {
  return {
    targetPlatform: 'PS5',
    issues: [
      {
        id: 'compat-1',
        severity: 'warning',
        platform: 'PS5',
        category: 'memory',
        description: 'Memory usage near budget',
        affectedAssets: ['/Game/Maps/MainLevel'],
        fix: 'Reduce texture resolution',
      },
    ],
    shaderCompatibility: {
      featureLevel: 'SM6',
      shaderModel: '6.0',
      compatible: true,
      incompatibleShaders: [],
      recommendations: [],
    },
    memoryBudget: {
      budgetMB: 8192,
      usedMB: 7000,
      remainingMB: 1192,
      overBudget: false,
      recommendations: [],
    },
    canBuild: true,
    blockingIssues: [],
    ...overrides,
  };
}

const jsonConfig: ReportConfig = { format: 'json', includeCharts: false, sections: [] };
const mdConfig: ReportConfig = { format: 'markdown', includeCharts: false, sections: [] };

// ─── Tests ───

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  describe('generateAssetReport', () => {
    it('should generate valid JSON for asset report', async () => {
      const assets = [makeAssetAnalysis(), makeAssetAnalysis({ assetPath: '/Game/Textures/T_Grass', assetType: 'Texture2D', naniteCompatible: false, estimatedMemory: 32 })];
      const result = await generator.generateAssetReport(assets, jsonConfig);
      const parsed = JSON.parse(result);
      expect(parsed.totalAssets).toBe(2);
      expect(parsed.naniteCompatible).toBe(1);
      expect(parsed.totalEstimatedMemoryMB).toBe(96);
      expect(parsed.assets).toHaveLength(2);
    });

    it('should generate markdown for asset report', async () => {
      const assets = [makeAssetAnalysis()];
      const result = await generator.generateAssetReport(assets, mdConfig);
      expect(result).toContain('# Asset Analysis Report');
      expect(result).toContain('/Game/Meshes/SM_Rock');
      expect(result).toContain('StaticMesh');
    });

    it('should count issues by severity', async () => {
      const assets = [
        makeAssetAnalysis({
          detectedIssues: [
            { id: '1', severity: 'critical', category: 'perf', title: 'High poly', description: '', affectedAssets: [] },
            { id: '2', severity: 'warning', category: 'perf', title: 'No LOD', description: '', affectedAssets: [] },
          ],
        }),
      ];
      const result = await generator.generateAssetReport(assets, jsonConfig);
      const parsed = JSON.parse(result);
      expect(parsed.issuesSummary.critical).toBe(1);
      expect(parsed.issuesSummary.warning).toBe(1);
      expect(parsed.issuesSummary.info).toBe(0);
    });

    it('should handle empty asset list', async () => {
      const result = await generator.generateAssetReport([], jsonConfig);
      const parsed = JSON.parse(result);
      expect(parsed.totalAssets).toBe(0);
      expect(parsed.assets).toHaveLength(0);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate valid JSON for performance report', async () => {
      const report = makePerformanceReport();
      const result = await generator.generatePerformanceReport(report, jsonConfig);
      const parsed = JSON.parse(result);
      expect(parsed.summary.overallScore).toBe(75);
      expect(parsed.drawCallAnalysis.totalDrawCalls).toBe(3000);
      expect(parsed.memoryAnalysis.totalMemoryMB).toBe(4096);
      expect(parsed.antiPatterns).toHaveLength(1);
    });

    it('should generate markdown for performance report', async () => {
      const report = makePerformanceReport();
      const result = await generator.generatePerformanceReport(report, mdConfig);
      expect(result).toContain('# Performance Report');
      expect(result).toContain('## Summary');
      expect(result).toContain('## Draw Call Analysis');
      expect(result).toContain('## Memory Analysis');
      expect(result).toContain('## GPU Analysis');
      expect(result).toContain('## Anti-Patterns');
      expect(result).toContain('## Recommendations');
    });

    it('should include anti-pattern details in markdown', async () => {
      const report = makePerformanceReport();
      const result = await generator.generatePerformanceReport(report, mdConfig);
      expect(result).toContain('Too many dynamic lights');
      expect(result).toContain('Use static or stationary lights');
    });

    it('should handle report with no anti-patterns', async () => {
      const report = makePerformanceReport({ antiPatterns: [] });
      const result = await generator.generatePerformanceReport(report, mdConfig);
      expect(result).not.toContain('## Anti-Patterns');
    });
  });

  describe('generateCodeQualityReport', () => {
    it('should generate valid JSON for code quality report', async () => {
      const report = makeCodeQualityReport();
      const result = await generator.generateCodeQualityReport(report, jsonConfig);
      const parsed = JSON.parse(result);
      expect(parsed.summary.overallScore).toBe(80);
      expect(parsed.namingViolations).toHaveLength(1);
      expect(parsed.circularDependencies).toHaveLength(1);
    });

    it('should generate markdown for code quality report', async () => {
      const report = makeCodeQualityReport();
      const result = await generator.generateCodeQualityReport(report, mdConfig);
      expect(result).toContain('# Code Quality Report');
      expect(result).toContain('## Naming Violations');
      expect(result).toContain('## Circular Dependencies');
      expect(result).toContain('## Blueprint/C++ Balance');
      expect(result).toContain('## Architecture Issues');
    });

    it('should show naming violation table in markdown', async () => {
      const report = makeCodeQualityReport();
      const result = await generator.generateCodeQualityReport(report, mdConfig);
      expect(result).toContain('rock01');
      expect(result).toContain('SM_Rock01');
    });

    it('should show circular dependency chain', async () => {
      const report = makeCodeQualityReport();
      const result = await generator.generateCodeQualityReport(report, mdConfig);
      expect(result).toContain('A → B → C → A');
    });

    it('should handle empty violations', async () => {
      const report = makeCodeQualityReport({ namingViolations: [], circularDependencies: [], architectureIssues: [] });
      const result = await generator.generateCodeQualityReport(report, mdConfig);
      expect(result).not.toContain('## Naming Violations');
      expect(result).not.toContain('## Circular Dependencies');
      expect(result).not.toContain('## Architecture Issues');
    });
  });

  describe('generateCompatibilityReport', () => {
    it('should generate valid JSON for compatibility report', async () => {
      const report = makeCompatibilityReport();
      const result = await generator.generateCompatibilityReport(report, jsonConfig);
      const parsed = JSON.parse(result);
      expect(parsed.targetPlatform).toBe('PS5');
      expect(parsed.canBuild).toBe(true);
      expect(parsed.issues).toHaveLength(1);
    });

    it('should generate markdown for compatibility report', async () => {
      const report = makeCompatibilityReport();
      const result = await generator.generateCompatibilityReport(report, mdConfig);
      expect(result).toContain('# Compatibility Report');
      expect(result).toContain('Target Platform: PS5');
      expect(result).toContain('## Build Status');
      expect(result).toContain('## Shader Compatibility');
      expect(result).toContain('## Memory Budget');
    });

    it('should show build blocked when canBuild is false', async () => {
      const report = makeCompatibilityReport({
        canBuild: false,
        blockingIssues: [{
          id: 'block-1', severity: 'critical', platform: 'PS5',
          category: 'shader', description: 'Unsupported shader', affectedAssets: [], fix: 'Use SM5',
        }],
      });
      const result = await generator.generateCompatibilityReport(report, mdConfig);
      expect(result).toContain('❌ No');
      expect(result).toContain('Blocking Issues: 1');
    });

    it('should list incompatible shaders', async () => {
      const report = makeCompatibilityReport({
        shaderCompatibility: {
          featureLevel: 'SM5', shaderModel: '5.0', compatible: false,
          incompatibleShaders: ['RayTracingShader', 'NaniteShader'],
          recommendations: [],
        },
      });
      const result = await generator.generateCompatibilityReport(report, mdConfig);
      expect(result).toContain('RayTracingShader, NaniteShader');
    });
  });

  describe('generateDashboard', () => {
    it('should generate dashboard with all sections', async () => {
      const result = await generator.generateDashboard({
        assetAnalysis: [makeAssetAnalysis()],
        performanceReport: makePerformanceReport(),
        codeQualityReport: makeCodeQualityReport(),
        compatibilityReport: makeCompatibilityReport(),
      });
      expect(result).toContain('# Project Health Dashboard');
      expect(result).toContain('## Overall Health');
      expect(result).toContain('## Asset Summary');
      expect(result).toContain('## Performance Summary');
      expect(result).toContain('## Code Quality Summary');
      expect(result).toContain('## Compatibility Summary');
      expect(result).toContain('## Top Recommendations');
    });

    it('should compute average overall score', async () => {
      const result = await generator.generateDashboard({
        performanceReport: makePerformanceReport({ summary: { overallScore: 60, criticalIssues: 0, warnings: 0, estimatedFps: { low: 30, mid: 60, high: 120 } } }),
        codeQualityReport: makeCodeQualityReport({ summary: { overallScore: 80, totalIssues: 0, criticalIssues: 0, warnings: 0, suggestions: 0 } }),
      });
      // (60 + 80) / 2 = 70
      expect(result).toContain('**70/100**');
    });

    it('should handle empty dashboard data', async () => {
      const result = await generator.generateDashboard({});
      expect(result).toContain('# Project Health Dashboard');
      expect(result).toContain('No analysis data available.');
      expect(result).not.toContain('## Asset Summary');
    });

    it('should sort recommendations by priority', async () => {
      const perfReport = makePerformanceReport({
        recommendations: [
          { id: 'r1', priority: 'low', category: 'a', title: 'Low Priority', description: 'desc', steps: [], estimatedImpact: '', relatedIssues: [] },
          { id: 'r2', priority: 'high', category: 'b', title: 'High Priority', description: 'desc', steps: [], estimatedImpact: '', relatedIssues: [] },
        ],
      });
      const result = await generator.generateDashboard({ performanceReport: perfReport });
      const highIdx = result.indexOf('High Priority');
      const lowIdx = result.indexOf('Low Priority');
      expect(highIdx).toBeLessThan(lowIdx);
    });

    it('should limit top recommendations to 5', async () => {
      const recs = Array.from({ length: 8 }, (_, i) => ({
        id: `r${i}`, priority: 'medium' as const, category: 'test', title: `Rec ${i}`,
        description: 'desc', steps: [], estimatedImpact: '', relatedIssues: [],
      }));
      const result = await generator.generateDashboard({
        performanceReport: makePerformanceReport({ recommendations: recs }),
      });
      const matches = result.match(/### \[MEDIUM\]/g);
      expect(matches).toHaveLength(5);
    });

    it('should show compatibility canBuild status', async () => {
      const result = await generator.generateDashboard({
        compatibilityReport: makeCompatibilityReport({ canBuild: false, blockingIssues: [{ id: 'b1', severity: 'critical', platform: 'PS5', category: 'shader', description: 'err', affectedAssets: [], fix: 'fix' }] }),
      });
      expect(result).toContain('Can build: No');
    });
  });
});
