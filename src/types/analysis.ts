/**
 * Analysis Types
 * 
 * 分析相關型別定義
 * 
 * Validates: Requirements 6.1–6.5, 7.1–7.5, 9.1–9.5, 10.1–10.5
 */

import type { AssetType } from './asset.js';

// ─── 共用型別 ───

/**
 * 嚴重度等級
 */
export type Severity = 'critical' | 'warning' | 'info';

/**
 * 問題
 */
export interface Issue {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  affectedAssets: string[];
  location?: {
    file: string;
    line?: number;
  };
}

/**
 * 建議
 */
export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  steps: string[];
  estimatedImpact: string;
  relatedIssues: string[];
}

// ─── 效能分析 (PerformanceAnalyzer) ───

/**
 * 效能報告
 */
export interface PerformanceReport {
  timestamp: string;
  summary: PerformanceSummary;
  drawCallAnalysis: DrawCallAnalysis;
  memoryAnalysis: MemoryAnalysis;
  gpuAnalysis: GpuAnalysis;
  naniteAnalysis: NaniteAnalysis;
  lumenAnalysis: LumenAnalysis;
  antiPatterns: AntiPattern[];
  recommendations: Recommendation[];
}

/**
 * 效能摘要
 */
export interface PerformanceSummary {
  overallScore: number;
  criticalIssues: number;
  warnings: number;
  estimatedFps: { low: number; mid: number; high: number };
}


/**
 * 反模式
 */
export interface AntiPattern {
  id: string;
  severity: Severity;
  category: string;
  description: string;
  affectedAssets: string[];
  fix: string;
  estimatedImprovement: string;
}

/**
 * Draw Call 分析
 */
export interface DrawCallAnalysis {
  totalDrawCalls: number;
  staticMeshDrawCalls: number;
  skeletalMeshDrawCalls: number;
  particleDrawCalls: number;
  uiDrawCalls: number;
  recommendations: string[];
}

/**
 * 記憶體分析
 */
export interface MemoryAnalysis {
  totalMemoryMB: number;
  textureMemoryMB: number;
  meshMemoryMB: number;
  audioMemoryMB: number;
  scriptMemoryMB: number;
  recommendations: string[];
}

/**
 * GPU 分析
 */
export interface GpuAnalysis {
  gpuTimeMs: number;
  shaderComplexity: number;
  overdrawRatio: number;
  recommendations: string[];
}

/**
 * Nanite 分析
 */
export interface NaniteAnalysis {
  enabled: boolean;
  naniteTriangles: number;
  fallbackTriangles: number;
  streamingPoolSizeMB: number;
  recommendations: string[];
}

/**
 * Lumen 分析
 */
export interface LumenAnalysis {
  globalIlluminationEnabled: boolean;
  reflectionsEnabled: boolean;
  rayTracingEnabled: boolean;
  qualityLevel: string;
  recommendations: string[];
}

// ─── 程式碼品質分析 (CodeQualityAnalyzer) ───

/**
 * 程式碼品質報告
 */
export interface CodeQualityReport {
  timestamp: string;
  summary: QualitySummary;
  namingViolations: NamingViolation[];
  circularDependencies: CircularDependency[];
  blueprintCppBalance: BalanceAnalysis;
  architectureIssues: ArchitectureIssue[];
  recommendations: Recommendation[];
}

/**
 * 品質摘要
 */
export interface QualitySummary {
  overallScore: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  suggestions: number;
}

/**
 * 命名違規
 */
export interface NamingViolation {
  assetPath: string;
  currentName: string;
  expectedPattern: string;
  suggestedName: string;
}

/**
 * 循環依賴
 */
export interface CircularDependency {
  chain: string[];
  severity: Severity;
  suggestedFix: string;
}

/**
 * Blueprint/C++ 平衡分析
 */
export interface BalanceAnalysis {
  blueprintPercentage: number;
  cppPercentage: number;
  recommendations: string[];
  issues: ArchitectureIssue[];
}

/**
 * 架構問題
 */
export interface ArchitectureIssue {
  id: string;
  severity: Severity;
  category: string;
  description: string;
  affectedFiles: string[];
  suggestedRefactoring: string;
}


// ─── 平台相容性 (CompatibilityChecker) ───

/**
 * 目標平台
 */
export type TargetPlatform =
  | 'Windows'
  | 'Mac'
  | 'Linux'
  | 'iOS'
  | 'Android'
  | 'PS5'
  | 'XboxSeriesX'
  | 'Switch';

/**
 * 相容性問題
 */
export interface CompatibilityIssue {
  id: string;
  severity: Severity;
  platform: TargetPlatform;
  category: 'shader' | 'memory' | 'feature' | 'input' | 'rendering';
  description: string;
  affectedAssets: string[];
  fix: string;
}

/**
 * 相容性報告
 */
export interface CompatibilityReport {
  targetPlatform: TargetPlatform;
  issues: CompatibilityIssue[];
  shaderCompatibility: ShaderCompatibility;
  memoryBudget: MemoryBudgetAnalysis;
  canBuild: boolean;
  blockingIssues: CompatibilityIssue[];
}

/**
 * Shader 相容性
 */
export interface ShaderCompatibility {
  featureLevel: string;
  shaderModel: string;
  compatible: boolean;
  incompatibleShaders: string[];
  recommendations: string[];
}

/**
 * 記憶體預算分析
 */
export interface MemoryBudgetAnalysis {
  budgetMB: number;
  usedMB: number;
  remainingMB: number;
  overBudget: boolean;
  recommendations: string[];
}

/**
 * 可擴展性報告
 */
export interface ScalabilityReport {
  qualityLevels: string[];
  issues: CompatibilityIssue[];
  recommendations: string[];
}

// ─── 依賴分析 (DependencyAnalyzer) ───

/**
 * 依賴樹
 */
export interface DependencyTree {
  root: string;
  directDependencies: DependencyNode[];
  totalDependencyCount: number;
  maxDepth: number;
}

/**
 * 依賴節點
 */
export interface DependencyNode {
  assetPath: string;
  assetType: AssetType;
  dependencies: DependencyNode[];
  referencedBy: string[];
  chunkId?: number;
}

/**
 * 孤立資產
 */
export interface OrphanedAsset {
  assetPath: string;
  assetType: AssetType;
  estimatedSize: number;
  suggestion: 'delete' | 'reconnect';
}

/**
 * Chunk 重複報告
 */
export interface ChunkDuplicationReport {
  duplicatedAssets: Array<{
    assetPath: string;
    chunks: number[];
    estimatedWastedSizeMB: number;
  }>;
  totalWastedSizeMB: number;
  recommendations: string[];
}

/**
 * 影響分析
 */
export interface ImpactAnalysis {
  targetAsset: string;
  directReferences: string[];
  indirectReferences: string[];
  totalAffectedAssets: number;
  safeToDelete: boolean;
  warnings: string[];
}

/**
 * World Partition 依賴報告
 */
export interface WorldPartitionDependencyReport {
  dataLayers: Array<{
    name: string;
    dependencies: string[];
    dependents: string[];
  }>;
  crossLayerDependencies: Array<{
    from: string;
    to: string;
    assets: string[];
  }>;
  recommendations: string[];
}

/**
 * 重構建議
 */
export interface RefactoringSuggestion {
  id: string;
  type: 'extract' | 'inline' | 'rename' | 'move' | 'split' | 'merge';
  description: string;
  targetAssets: string[];
  steps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

// ─── 知識管理 (KnowledgeManager) ───

/**
 * 知識文件
 * 
 * Validates: Requirements 8.1, 8.2, 8.3
 */
export interface KnowledgeDocument {
  key: string;
  title: string;
  content: string;
  tags: string[];
  lastUpdated: string; // ISO timestamp
  version?: string;
}

/**
 * API 變更類型
 */
export type ApiChangeType = 'deprecated' | 'removed' | 'modified' | 'added';

/**
 * API 變更記錄
 * 
 * Validates: Requirements 8.2, 8.4
 */
export interface ApiChange {
  apiName: string;
  changeType: ApiChangeType;
  description: string;
  affectedCodePaths: string[];
  suggestedReplacement?: string;
  engineVersion: string;
}
