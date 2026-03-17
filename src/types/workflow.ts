/**
 * Workflow Types
 * 
 * 工作流相關型別定義
 * 
 * Validates: Requirements 5.1–5.4
 */

/**
 * Cron 表達式型別
 */
export type CronExpression = string;

/**
 * 工作流定義
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  schedule?: CronExpression;
}

/**
 * 工作流步驟
 */
export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  params: Record<string, unknown>;
  condition?: StepCondition;
  onFailure: 'stop' | 'skip' | 'retry';
  retryCount?: number;
}

/**
 * 步驟條件
 */
export interface StepCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

/**
 * 工作流執行結果
 */
export interface WorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  stepResults: StepResult[];
  startTime: string;
  endTime: string;
  duration: number;
}

/**
 * 步驟執行結果
 */
export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  output: unknown;
  error?: string;
  duration: number;
}
