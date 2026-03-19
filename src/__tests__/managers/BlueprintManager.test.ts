/**
 * BlueprintManager 測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlueprintManager } from '../../managers/BlueprintManager.js';
import { McpClient } from '../../utils/mcp-client.js';
import { AnalysisCacheManager } from '../../utils/cache.js';

describe('BlueprintManager', () => {
  let manager: BlueprintManager;
  let mcpClient: McpClient;
  let mockInvoker: { invoke: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mcpClient = new McpClient({ timeout: 5000 });
    mockInvoker = { invoke: vi.fn().mockResolvedValue({}) };
    mcpClient.setInvoker(mockInvoker);
    const cache = new AnalysisCacheManager();
    manager = new BlueprintManager(mcpClient, cache);
  });

  it('should create a basic blueprint', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const result = await manager.createBlueprint({
      name: 'BP_Test',
      path: '/Game/Test',
      parentClass: 'Actor',
      compile: false,
      save: false,
    });

    expect(result.blueprintPath).toBe('/Game/Test/BP_Test');
    expect(result.success).toBe(true);
    expect(mockInvoker.invoke).toHaveBeenCalledWith(
      'manage_blueprint',
      expect.objectContaining({ action: 'create', blueprintPath: '/Game/Test/BP_Test' })
    );
  });

  it('should add variables to blueprint', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const result = await manager.addVariable('/Game/Test/BP_Test', {
      name: 'Health',
      type: 'Float',
      defaultValue: 100.0,
      category: 'Stats',
      isReplicated: true,
    });

    expect(result.success).toBe(true);
    expect(result.step).toBe('add_variable_Health');
    expect(mockInvoker.invoke).toHaveBeenCalledWith(
      'manage_blueprint',
      expect.objectContaining({
        action: 'add_variable',
        variableName: 'Health',
        variableType: 'Float',
      })
    );
  });

  it('should add functions to blueprint', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const result = await manager.addFunction('/Game/Test/BP_Test', {
      name: 'TakeDamage',
      category: 'Combat',
      inputs: [{ name: 'Amount', type: 'Float' }],
      outputs: [{ name: 'ActualDamage', type: 'Float' }],
    });

    expect(result.success).toBe(true);
    expect(result.step).toBe('add_function_TakeDamage');
  });

  it('should add SCS components', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const result = await manager.addComponent('/Game/Test/BP_Test', {
      name: 'MeshComp',
      componentClass: 'StaticMeshComponent',
      attachTo: 'RootComponent',
      properties: { castShadow: true },
    });

    expect(result.success).toBe(true);
    expect(result.step).toBe('add_component_MeshComp');
  });

  it('should create nodes in graph', async () => {
    mockInvoker.invoke.mockResolvedValue({ nodeId: 'node_123', success: true });

    const result = await manager.createNode('/Game/Test/BP_Test', 'EventGraph', {
      nodeType: 'K2Node_CallFunction',
      name: 'PrintHello',
      posX: 300,
      posY: 0,
      memberClass: 'KismetSystemLibrary',
      memberName: 'PrintString',
    });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBe('node_123');
    expect(result.nodeName).toBe('PrintHello');
  });

  it('should connect pins between nodes', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const result = await manager.connectPins('/Game/Test/BP_Test', 'EventGraph', {
      fromNodeId: 'node_1',
      fromPin: 'Then',
      toNodeId: 'node_2',
      toPin: 'Execute',
    });

    expect(result.success).toBe(true);
  });

  it('should build complete graph logic with nodes and connections', async () => {
    let callCount = 0;
    mockInvoker.invoke.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ nodeId: `node_${callCount}`, success: true });
    });

    const result = await manager.buildGraphLogic('/Game/Test/BP_Test', {
      graphName: 'EventGraph',
      nodes: [
        { nodeType: 'K2Node_Event', name: 'BeginPlay', posX: 0, posY: 0, memberName: 'ReceiveBeginPlay' },
        { nodeType: 'K2Node_CallFunction', name: 'PrintHello', posX: 300, posY: 0, memberClass: 'KismetSystemLibrary', memberName: 'PrintString' },
      ],
      connections: [
        { fromNodeId: 'BeginPlay', fromPin: 'Then', toNodeId: 'PrintHello', toPin: 'Execute' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.nodesCreated).toBe(2);
    expect(result.connectionsCreated).toBe(1);
    expect(result.nodeIdMap).toHaveProperty('BeginPlay');
    expect(result.nodeIdMap).toHaveProperty('PrintHello');
  });

  it('should create blueprint from template', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const template = {
      name: 'BP_TestActor',
      parentClass: '/Script/Engine.Actor',
      variables: [
        { name: 'Health', type: 'float', default: 100.0, category: 'Stats', replication: 'Replicated' },
      ],
      functions: [
        { name: 'TakeDamage', category: 'Combat', inputs: [{ name: 'Amount', type: 'float' }], outputs: [] },
      ],
    };

    const result = await manager.createFromTemplate({
      template,
      path: '/Game/Test',
      compile: false,
      save: false,
    });

    expect(result.blueprintPath).toBe('/Game/Test/BP_TestActor');
    expect(result.success).toBe(true);
  });

  it('should handle create failure gracefully', async () => {
    mockInvoker.invoke.mockRejectedValue(new Error('Blueprint already exists'));

    const result = await manager.createBlueprint({
      name: 'BP_Existing',
      path: '/Game/Test',
      parentClass: 'Actor',
    });

    expect(result.success).toBe(false);
    expect(result.steps[0].step).toBe('create_blueprint');
    expect(result.steps[0].success).toBe(false);
  });

  it('should add convenience event nodes', async () => {
    mockInvoker.invoke.mockResolvedValue({ nodeId: 'bp_node_1', success: true });

    const beginPlay = await manager.addBeginPlayEvent('/Game/Test/BP_Test');
    expect(beginPlay.success).toBe(true);
    expect(beginPlay.nodeName).toBe('BeginPlay');

    const tick = await manager.addTickEvent('/Game/Test/BP_Test');
    expect(tick.success).toBe(true);
    expect(tick.nodeName).toBe('Tick');
  });

  it('should add branch node', async () => {
    mockInvoker.invoke.mockResolvedValue({ nodeId: 'branch_1', success: true });

    const result = await manager.addBranchNode('/Game/Test/BP_Test', 'EventGraph', { x: 400, y: 0 });
    expect(result.success).toBe(true);
    expect(result.nodeName).toBe('Branch');
  });

  it('should add variable get/set nodes', async () => {
    mockInvoker.invoke.mockResolvedValue({ nodeId: 'var_node', success: true });

    const getResult = await manager.addVariableGetNode('/Game/Test/BP_Test', 'EventGraph', 'Health');
    expect(getResult.success).toBe(true);
    expect(getResult.nodeName).toBe('Get_Health');

    const setResult = await manager.addVariableSetNode('/Game/Test/BP_Test', 'EventGraph', 'Health');
    expect(setResult.success).toBe(true);
    expect(setResult.nodeName).toBe('Set_Health');
  });

  it('should get blueprint info', async () => {
    mockInvoker.invoke.mockResolvedValue({ parentClass: '/Script/Engine.Actor', success: true });

    const info = await manager.getBlueprintInfo('/Game/Test/BP_Test');
    expect(info).not.toBeNull();
    expect(info?.blueprintPath).toBe('/Game/Test/BP_Test');
  });

  it('should compile blueprint', async () => {
    mockInvoker.invoke.mockResolvedValue({ success: true });

    const result = await manager.compileBlueprint('/Game/Test/BP_Test');
    expect(result.success).toBe(true);
    expect(result.step).toBe('compile');
  });
});
