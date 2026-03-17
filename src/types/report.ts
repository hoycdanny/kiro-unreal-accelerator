/**
 * Report Types
 * 
 * 報告相關型別定義
 * 
 * Validates: Requirements 18.2
 */

/**
 * 報告格式
 */
export type ReportFormat = 'json' | 'markdown';

/**
 * 報告配置
 */
export interface ReportConfig {
  format: ReportFormat;
  includeCharts: boolean;
  sections: string[];
}
