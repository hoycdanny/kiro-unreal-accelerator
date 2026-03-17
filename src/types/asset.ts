/**
 * Asset Types
 * 
 * 資產相關型別定義
 * 
 * Validates: Requirements 1.1–1.5
 */

/**
 * 支援的資產類型
 */
export type AssetType =
  | 'Texture2D'
  | 'StaticMesh'
  | 'SkeletalMesh'
  | 'Material'
  | 'MaterialInstance'
  | 'SoundWave'
  | 'SoundCue'
  | 'Blueprint'
  | 'AnimSequence'
  | 'AnimMontage'
  | 'ParticleSystem'
  | 'NiagaraSystem';

/**
 * 驗證規則
 */
export interface ValidationRule {
  check: string;
  value?: number | string;
  message: string;
}

/**
 * 需求檢查
 */
export interface RequirementCheck {
  check: string;
  value?: number | string;
  message: string;
}

/**
 * 資產預設設定
 */
export interface AssetPreset {
  name: string;
  assetType: AssetType;
  description: string;
  settings: Record<string, unknown>;
  validations?: ValidationRule[];
  requirements?: RequirementCheck[];
}

/**
 * 資產分析結果
 */
export interface AssetAnalysisResult {
  assetPath: string;
  assetType: AssetType;
  detectedIssues: Issue[];
  suggestedPreset: string | null;
  naniteCompatible: boolean;
  estimatedMemory: number;
}

/**
 * Nanite 驗證結果
 */
export interface NaniteValidation {
  compatible: boolean;
  triangleCount: number;
  hasSkinning: boolean;
  hasDeformation: boolean;
  reasons: string[];
  suggestions: string[];
}

/**
 * 預設套用結果
 */
export interface ApplyResult {
  assetPath: string;
  success: boolean;
  appliedSettings?: Record<string, unknown>;
  failureReason?: string;
  alternativeSuggestions?: string[];
}

// Issue is imported from analysis.ts for use in AssetAnalysisResult
import type { Issue } from './analysis.js';
