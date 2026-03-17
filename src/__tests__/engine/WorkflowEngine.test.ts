/**
 * WorkflowEngine Unit Tests
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowEngine, StepActionExecutor } from '../../engine/WorkflowEngine.js';
import type { WorkflowDefinition, WorkflowStep, StepCondition } from '../../types/workflow.js';

/**
 * Helper: create a mock executor
 */
function createMockExecutor(
  behavior: Record<string, () => Promise<unknown>> = {}
): StepActionExecutor {
  return {
    execute: vi.fn(async (action: string, _params: Record<string, unknown>) => {
      if (behavior[action]) {
        return behavior[action]();
      }
      return { success: true, action };
    }),
  };
}

/**
 * Helper: create a simple workflow definition
 */
function createWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'test-workflow-1',
    name: 'Test Workflow',
    description: 'A test workflow',
    steps: [
      {
        id: 'step-1',
        name: 'Step 1',
        action: 'action_1',
        params: { key: 'value' },
        onFailure: 'stop',
      },
    ],
    ...overrides,
  };
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let mockExecutor: StepActionExecutor;

  beforeEach(() => {
    engine = new WorkflowEngine();
    mockExecutor = createMockExecutor();
    engine.setExecutor(mockExecutor);
  });

  // ─── defineWorkflow / listWorkflows (Requirement 5.1) ───

  describe('defineWorkflow', () => {
    it('should store a workflow definition', async () => {
      const workflow = createWorkflow();
      await engine.defineWorkflow(workflow);

      const stored = engine.getWorkflow(workflow.id);
      expect(stored).toBeDefined();
      expect(stored!.id).toBe(workflow.id);
      expect(stored!.name).toBe(workflow.name);
      expect(stored!.steps).toHaveLength(1);
    });

    it('should overwrite an existing workflow with the same id', async () => {
      const workflow1 = createWorkflow({ name: 'Original' });
      const workflow2 = createWorkflow({ name: 'Updated' });

      await engine.defineWorkflow(workflow1);
      await engine.defineWorkflow(workflow2);

      const stored = engine.getWorkflow(workflow1.id);
      expect(stored!.name).toBe('Updated');
    });

    it('should throw if id is missing', async () => {
      const workflow = createWorkflow({ id: '' });
      await expect(engine.defineWorkflow(workflow)).rejects.toThrow('must have an id and name');
    });

    it('should throw if name is missing', async () => {
      const workflow = createWorkflow({ name: '' });
      await expect(engine.defineWorkflow(workflow)).rejects.toThrow('must have an id and name');
    });

    it('should throw if steps are empty', async () => {
      const workflow = createWorkflow({ steps: [] });
      await expect(engine.defineWorkflow(workflow)).rejects.toThrow('at least one step');
    });
  });

  describe('listWorkflows', () => {
    it('should return empty array when no workflows defined', async () => {
      const list = await engine.listWorkflows();
      expect(list).toEqual([]);
    });

    it('should return all defined workflows', async () => {
      await engine.defineWorkflow(createWorkflow({ id: 'wf-1', name: 'WF 1' }));
      await engine.defineWorkflow(createWorkflow({ id: 'wf-2', name: 'WF 2' }));

      const list = await engine.listWorkflows();
      expect(list).toHaveLength(2);
      expect(list.map(w => w.id).sort()).toEqual(['wf-1', 'wf-2']);
    });
  });

  // ─── executeWorkflow (Requirements 5.2, 5.3) ───

  describe('executeWorkflow', () => {
    it('should throw if workflow not found', async () => {
      await expect(engine.executeWorkflow('nonexistent')).rejects.toThrow('Workflow not found');
    });

    it('should throw if executor not set', async () => {
      const freshEngine = new WorkflowEngine();
      await freshEngine.defineWorkflow(createWorkflow());
      await expect(freshEngine.executeWorkflow('test-workflow-1')).rejects.toThrow('executor not configured');
    });

    it('should execute all steps sequentially and return completed status', async () => {
      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
          { id: 's2', name: 'Step 2', action: 'a2', params: {}, onFailure: 'stop' },
          { id: 's3', name: 'Step 3', action: 'a3', params: {}, onFailure: 'stop' },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.status).toBe('completed');
      expect(result.stepResults).toHaveLength(3);
      expect(result.stepResults.every(r => r.status === 'success')).toBe(true);
      expect(result.workflowId).toBe(workflow.id);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should pass correct action and params to executor', async () => {
      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'my_action', params: { foo: 'bar' }, onFailure: 'stop' },
        ],
      });

      await engine.defineWorkflow(workflow);
      await engine.executeWorkflow(workflow.id);

      expect(mockExecutor.execute).toHaveBeenCalledWith('my_action', { foo: 'bar' });
    });

    it('should capture step output', async () => {
      const executor = createMockExecutor({
        a1: async () => ({ data: 42 }),
      });
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.stepResults[0].output).toEqual({ data: 42 });
    });

    // ─── onFailure: stop ───

    it('should stop execution when a step fails with onFailure=stop', async () => {
      const executor = createMockExecutor({
        a2: async () => { throw new Error('Step 2 failed'); },
      });
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
          { id: 's2', name: 'Step 2', action: 'a2', params: {}, onFailure: 'stop' },
          { id: 's3', name: 'Step 3', action: 'a3', params: {}, onFailure: 'stop' },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.status).toBe('failed');
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].status).toBe('success');
      expect(result.stepResults[1].status).toBe('failed');
      expect(result.stepResults[1].error).toBe('Step 2 failed');
    });

    // ─── onFailure: skip ───

    it('should skip failed step and continue when onFailure=skip', async () => {
      const executor = createMockExecutor({
        a2: async () => { throw new Error('Step 2 failed'); },
      });
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
          { id: 's2', name: 'Step 2', action: 'a2', params: {}, onFailure: 'skip' },
          { id: 's3', name: 'Step 3', action: 'a3', params: {}, onFailure: 'stop' },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.status).toBe('partial');
      expect(result.stepResults).toHaveLength(3);
      expect(result.stepResults[0].status).toBe('success');
      expect(result.stepResults[1].status).toBe('skipped');
      expect(result.stepResults[2].status).toBe('success');
    });

    // ─── onFailure: retry ───

    it('should retry failed step when onFailure=retry', async () => {
      let callCount = 0;
      const executor: StepActionExecutor = {
        execute: vi.fn(async () => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Transient error');
          }
          return { recovered: true };
        }),
      };
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'retry', retryCount: 3 },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.status).toBe('completed');
      expect(result.stepResults[0].status).toBe('success');
      expect(result.stepResults[0].output).toEqual({ recovered: true });
      expect(callCount).toBe(3);
    });

    it('should fail after exhausting retries', async () => {
      const executor: StepActionExecutor = {
        execute: vi.fn(async () => {
          throw new Error('Persistent error');
        }),
      };
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'retry', retryCount: 2 },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.status).toBe('partial');
      expect(result.stepResults[0].status).toBe('failed');
      expect(result.stepResults[0].error).toBe('Persistent error');
      expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    it('should default to 3 retries when retryCount not specified', async () => {
      const executor: StepActionExecutor = {
        execute: vi.fn(async () => {
          throw new Error('Error');
        }),
      };
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'retry' },
        ],
      });

      await engine.defineWorkflow(workflow);
      await engine.executeWorkflow(workflow.id);

      expect(executor.execute).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Condition evaluation (Requirement 5.4) ───

  describe('evaluateCondition', () => {
    it('should evaluate eq operator correctly', () => {
      const condition: StepCondition = { field: 'status', operator: 'eq', value: 'ok' };
      expect(engine.evaluateCondition(condition, { status: 'ok' })).toBe(true);
      expect(engine.evaluateCondition(condition, { status: 'error' })).toBe(false);
    });

    it('should evaluate neq operator correctly', () => {
      const condition: StepCondition = { field: 'status', operator: 'neq', value: 'error' };
      expect(engine.evaluateCondition(condition, { status: 'ok' })).toBe(true);
      expect(engine.evaluateCondition(condition, { status: 'error' })).toBe(false);
    });

    it('should evaluate gt operator correctly', () => {
      const condition: StepCondition = { field: 'count', operator: 'gt', value: 5 };
      expect(engine.evaluateCondition(condition, { count: 10 })).toBe(true);
      expect(engine.evaluateCondition(condition, { count: 5 })).toBe(false);
      expect(engine.evaluateCondition(condition, { count: 3 })).toBe(false);
    });

    it('should evaluate lt operator correctly', () => {
      const condition: StepCondition = { field: 'count', operator: 'lt', value: 5 };
      expect(engine.evaluateCondition(condition, { count: 3 })).toBe(true);
      expect(engine.evaluateCondition(condition, { count: 5 })).toBe(false);
      expect(engine.evaluateCondition(condition, { count: 10 })).toBe(false);
    });

    it('should evaluate contains operator for strings', () => {
      const condition: StepCondition = { field: 'message', operator: 'contains', value: 'error' };
      expect(engine.evaluateCondition(condition, { message: 'an error occurred' })).toBe(true);
      expect(engine.evaluateCondition(condition, { message: 'all good' })).toBe(false);
    });

    it('should evaluate contains operator for arrays', () => {
      const condition: StepCondition = { field: 'tags', operator: 'contains', value: 'important' };
      expect(engine.evaluateCondition(condition, { tags: ['important', 'urgent'] })).toBe(true);
      expect(engine.evaluateCondition(condition, { tags: ['normal'] })).toBe(false);
    });

    it('should resolve nested field paths', () => {
      const condition: StepCondition = { field: 'result.data.value', operator: 'eq', value: 42 };
      expect(engine.evaluateCondition(condition, { result: { data: { value: 42 } } })).toBe(true);
      expect(engine.evaluateCondition(condition, { result: { data: { value: 0 } } })).toBe(false);
    });

    it('should return false for undefined fields', () => {
      const condition: StepCondition = { field: 'missing', operator: 'eq', value: 'x' };
      expect(engine.evaluateCondition(condition, { other: 'y' })).toBe(false);
    });

    it('should return false for null/undefined context', () => {
      const condition: StepCondition = { field: 'x', operator: 'eq', value: 1 };
      expect(engine.evaluateCondition(condition, null)).toBe(false);
      expect(engine.evaluateCondition(condition, undefined)).toBe(false);
    });

    it('should return false for gt/lt with non-numeric values', () => {
      const gtCondition: StepCondition = { field: 'val', operator: 'gt', value: 5 };
      expect(engine.evaluateCondition(gtCondition, { val: 'not a number' })).toBe(false);

      const ltCondition: StepCondition = { field: 'val', operator: 'lt', value: 5 };
      expect(engine.evaluateCondition(ltCondition, { val: 'not a number' })).toBe(false);
    });
  });

  // ─── Conditional step execution (Requirement 5.4) ───

  describe('conditional step execution', () => {
    it('should skip step when condition is not met', async () => {
      const executor = createMockExecutor({
        a1: async () => ({ status: 'error' }),
      });
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
          {
            id: 's2', name: 'Step 2', action: 'a2', params: {}, onFailure: 'stop',
            condition: { field: 'status', operator: 'eq', value: 'ok' },
          },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].status).toBe('success');
      expect(result.stepResults[1].status).toBe('skipped');
    });

    it('should execute step when condition is met', async () => {
      const executor = createMockExecutor({
        a1: async () => ({ status: 'ok' }),
      });
      engine.setExecutor(executor);

      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
          {
            id: 's2', name: 'Step 2', action: 'a2', params: {}, onFailure: 'stop',
            condition: { field: 'status', operator: 'eq', value: 'ok' },
          },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].status).toBe('success');
      expect(result.stepResults[1].status).toBe('success');
    });
  });

  // ─── scheduleWorkflow (Requirement 5.5) ───

  describe('scheduleWorkflow', () => {
    it('should store schedule for a workflow', async () => {
      const workflow = createWorkflow();
      await engine.defineWorkflow(workflow);
      await engine.scheduleWorkflow(workflow.id, '0 * * * *');

      const schedule = engine.getSchedule(workflow.id);
      expect(schedule).toBeDefined();
      expect(schedule!.cron).toBe('0 * * * *');
      expect(schedule!.workflowId).toBe(workflow.id);
      expect(schedule!.createdAt).toBeDefined();
    });

    it('should throw if workflow not found', async () => {
      await expect(engine.scheduleWorkflow('nonexistent', '0 * * * *'))
        .rejects.toThrow('Workflow not found');
    });

    it('should throw if cron expression is empty', async () => {
      const workflow = createWorkflow();
      await engine.defineWorkflow(workflow);
      await expect(engine.scheduleWorkflow(workflow.id, ''))
        .rejects.toThrow('Cron expression must not be empty');
    });

    it('should overwrite existing schedule', async () => {
      const workflow = createWorkflow();
      await engine.defineWorkflow(workflow);
      await engine.scheduleWorkflow(workflow.id, '0 * * * *');
      await engine.scheduleWorkflow(workflow.id, '*/5 * * * *');

      const schedule = engine.getSchedule(workflow.id);
      expect(schedule!.cron).toBe('*/5 * * * *');
    });
  });

  // ─── getWorkflowStatus (Requirement 5.2) ───

  describe('getWorkflowStatus', () => {
    it('should return undefined for unexecuted workflow', async () => {
      const status = await engine.getWorkflowStatus('nonexistent');
      expect(status).toBeUndefined();
    });

    it('should return result after execution', async () => {
      const workflow = createWorkflow();
      await engine.defineWorkflow(workflow);
      await engine.executeWorkflow(workflow.id);

      const status = await engine.getWorkflowStatus(workflow.id);
      expect(status).toBeDefined();
      expect(status!.workflowId).toBe(workflow.id);
      expect(status!.status).toBe('completed');
      expect(status!.stepResults).toHaveLength(1);
    });

    it('should return latest result after re-execution', async () => {
      let callCount = 0;
      const executor: StepActionExecutor = {
        execute: vi.fn(async () => {
          callCount++;
          return { run: callCount };
        }),
      };
      engine.setExecutor(executor);

      const workflow = createWorkflow();
      await engine.defineWorkflow(workflow);

      await engine.executeWorkflow(workflow.id);
      await engine.executeWorkflow(workflow.id);

      const status = await engine.getWorkflowStatus(workflow.id);
      expect(status!.stepResults[0].output).toEqual({ run: 2 });
    });
  });

  // ─── Step duration tracking ───

  describe('step duration tracking', () => {
    it('should track duration for each step', async () => {
      const workflow = createWorkflow({
        steps: [
          { id: 's1', name: 'Step 1', action: 'a1', params: {}, onFailure: 'stop' },
        ],
      });

      await engine.defineWorkflow(workflow);
      const result = await engine.executeWorkflow(workflow.id);

      expect(result.stepResults[0].duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.stepResults[0].duration).toBe('number');
    });
  });
});
