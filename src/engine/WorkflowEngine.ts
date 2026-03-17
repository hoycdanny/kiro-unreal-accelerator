/**
 * WorkflowEngine
 * 
 * 工作流引擎 - 定義、執行、排程與查詢工作流
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import type {
  WorkflowDefinition,
  WorkflowStep,
  StepCondition,
  WorkflowResult,
  StepResult,
  CronExpression,
} from '../types/workflow.js';
import { Logger } from '../utils/logger.js';

/**
 * 步驟動作執行器介面
 * 
 * 允許注入不同的動作執行實作（例如 MCP 工具呼叫或測試用 mock）
 */
export interface StepActionExecutor {
  execute(action: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * 排程項目
 */
export interface ScheduleEntry {
  workflowId: string;
  cron: CronExpression;
  createdAt: string;
}

/**
 * 工作流引擎
 * 
 * 負責工作流的定義、執行、排程與狀態查詢
 */
export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private results: Map<string, WorkflowResult> = new Map();
  private schedules: Map<string, ScheduleEntry> = new Map();
  private logger: Logger;
  private executor: StepActionExecutor | null = null;

  constructor() {
    this.logger = new Logger(
      { level: 'info' },
      { module: 'WorkflowEngine' }
    );
  }

  /**
   * 設定步驟動作執行器（用於依賴注入）
   */
  setExecutor(executor: StepActionExecutor): void {
    this.executor = executor;
  }

  /**
   * 定義工作流
   * 
   * 儲存工作流定義供後續執行
   * Validates: Requirement 5.1
   */
  async defineWorkflow(definition: WorkflowDefinition): Promise<void> {
    if (!definition.id || !definition.name) {
      throw new Error('Workflow definition must have an id and name');
    }
    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Workflow definition must have at least one step');
    }

    this.workflows.set(definition.id, { ...definition, steps: definition.steps.map(s => ({ ...s })) });
    this.logger.info(`Workflow defined: ${definition.name}`, { workflow: definition.id });
  }

  /**
   * 列出所有工作流定義
   * 
   * Validates: Requirement 5.1
   */
  async listWorkflows(): Promise<WorkflowDefinition[]> {
    return Array.from(this.workflows.values());
  }

  /**
   * 執行工作流
   * 
   * 依序執行所有步驟，處理 onFailure 策略（stop/skip/retry）
   * 支援條件分支評估
   * Validates: Requirements 5.2, 5.3, 5.4
   */
  async executeWorkflow(workflowId: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!this.executor) {
      throw new Error('Step action executor not configured. Call setExecutor() first.');
    }

    const startTime = new Date();
    const stepResults: StepResult[] = [];
    let overallStatus: WorkflowResult['status'] = 'completed';
    let stopped = false;

    this.logger.info(`Executing workflow: ${workflow.name}`, { workflow: workflowId });

    for (const step of workflow.steps) {
      if (stopped) {
        break;
      }

      const stepStart = Date.now();

      // Evaluate condition if present
      if (step.condition) {
        const previousOutput = stepResults.length > 0
          ? stepResults[stepResults.length - 1].output
          : undefined;

        const conditionMet = this.evaluateCondition(step.condition, previousOutput);
        if (!conditionMet) {
          stepResults.push({
            stepId: step.id,
            status: 'skipped',
            output: null,
            duration: Date.now() - stepStart,
          });
          this.logger.info(`Step skipped (condition not met): ${step.name}`, { workflow: workflowId });
          continue;
        }
      }

      // Execute step with failure handling
      const result = await this.executeStep(step);
      stepResults.push(result);

      if (result.status === 'failed') {
        if (step.onFailure === 'stop') {
          overallStatus = 'failed';
          stopped = true;
          this.logger.error(`Workflow stopped at step: ${step.name}`, { workflow: workflowId });
        } else {
          overallStatus = 'partial';
        }
      } else if (result.status === 'skipped' && result.error) {
        // Step was skipped due to failure (onFailure=skip)
        overallStatus = 'partial';
      }
    }

    const endTime = new Date();
    const workflowResult: WorkflowResult = {
      workflowId,
      status: overallStatus,
      stepResults,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
    };

    this.results.set(workflowId, workflowResult);
    this.logger.info(`Workflow completed: ${workflow.name} (${overallStatus})`, { workflow: workflowId });

    return workflowResult;
  }

  /**
   * 執行單一步驟，處理 onFailure 策略
   */
  private async executeStep(step: WorkflowStep): Promise<StepResult> {
    const stepStart = Date.now();
    const maxAttempts = step.onFailure === 'retry' ? (step.retryCount ?? 3) : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`Executing step: ${step.name} (attempt ${attempt}/${maxAttempts})`);
        const output = await this.executor!.execute(step.action, step.params);
        return {
          stepId: step.id,
          status: 'success',
          output,
          duration: Date.now() - stepStart,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (attempt === maxAttempts) {
          this.logger.error(`Step failed: ${step.name} - ${errorMessage}`);

          if (step.onFailure === 'skip') {
            return {
              stepId: step.id,
              status: 'skipped',
              output: null,
              error: errorMessage,
              duration: Date.now() - stepStart,
            };
          }

          return {
            stepId: step.id,
            status: 'failed',
            output: null,
            error: errorMessage,
            duration: Date.now() - stepStart,
          };
        }

        this.logger.warn(`Step ${step.name} attempt ${attempt} failed, retrying...`);
      }
    }

    // Should not reach here, but TypeScript needs a return
    return {
      stepId: step.id,
      status: 'failed',
      output: null,
      error: 'Unexpected execution path',
      duration: Date.now() - stepStart,
    };
  }

  /**
   * 評估步驟條件
   * 
   * 根據前一步驟的結果評估條件是否成立
   * Validates: Requirement 5.4
   */
  evaluateCondition(condition: StepCondition, context: unknown): boolean {
    const fieldValue = this.resolveField(condition.field, context);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'neq':
        return fieldValue !== condition.value;
      case 'gt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number'
          && fieldValue > condition.value;
      case 'lt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number'
          && fieldValue < condition.value;
      case 'contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;
      default:
        this.logger.warn(`Unknown condition operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * 解析欄位路徑取得值
   * 
   * 支援點分隔的巢狀路徑，例如 "result.status"
   */
  private resolveField(field: string, context: unknown): unknown {
    if (context === null || context === undefined) {
      return undefined;
    }

    const parts = field.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * 排程工作流
   * 
   * 儲存排程設定（實際排程執行需要外部排程器）
   * Validates: Requirement 5.5
   */
  async scheduleWorkflow(workflowId: string, cron: CronExpression): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!cron || cron.trim().length === 0) {
      throw new Error('Cron expression must not be empty');
    }

    this.schedules.set(workflowId, {
      workflowId,
      cron,
      createdAt: new Date().toISOString(),
    });

    this.logger.info(`Workflow scheduled: ${workflow.name} (${cron})`, { workflow: workflowId });
  }

  /**
   * 取得工作流執行狀態
   * 
   * Validates: Requirement 5.2
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowResult | undefined> {
    return this.results.get(workflowId);
  }

  /**
   * 取得工作流排程
   */
  getSchedule(workflowId: string): ScheduleEntry | undefined {
    return this.schedules.get(workflowId);
  }

  /**
   * 取得工作流定義
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }
}
