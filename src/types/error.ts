/**
 * Error Types
 * 
 * 錯誤相關型別定義
 */

import type { Severity } from './analysis.js';

/**
 * Power 錯誤
 */
export interface PowerError {
  code: string;
  severity: Severity;
  message: string;
  context: {
    tool?: string;
    asset?: string;
    step?: string;
  };
  suggestion: string;
  documentation?: string;
}
