import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  McpClient,
  MCP_TOOL_NAMES,
  type McpToolInvoker,
} from '../../utils/mcp-client.js';

describe('McpClient', () => {
  let client: McpClient;
  let mockInvoker: McpToolInvoker;

  beforeEach(() => {
    client = new McpClient({ projectPath: '/test/project', timeout: 5000 });
    mockInvoker = {
      invoke: vi.fn().mockResolvedValue({ success: true }),
    };
    client.setInvoker(mockInvoker);
  });

  it('should have 35 MCP tool names', () => {
    expect(MCP_TOOL_NAMES.length).toBe(35);
  });

  it('should return error when no invoker is set', async () => {
    const noInvokerClient = new McpClient();
    const result = await noInvokerClient.manageAsset('list');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('MCP_NO_INVOKER');
  });

  it('should call invoker with correct tool name and params', async () => {
    await client.manageAsset('list', { path: '/Game' });
    expect(mockInvoker.invoke).toHaveBeenCalledWith('manage_asset', {
      action: 'list',
      path: '/Game',
    });
  });

  it('should return success result from invoker', async () => {
    (mockInvoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ items: ['a', 'b'] });
    const result = await client.manageAsset('list');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ items: ['a', 'b'] });
  });

  it('should handle invoker errors', async () => {
    (mockInvoker.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection lost'));
    const result = await client.manageAsset('list');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('MCP_CALL_FAILED');
    expect(result.error?.message).toContain('Connection lost');
  });

  it('should handle timeout', async () => {
    const fastClient = new McpClient({ timeout: 50 });
    fastClient.setInvoker({
      invoke: () => new Promise((resolve) => setTimeout(resolve, 200)),
    });
    const result = await fastClient.manageAsset('list');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('MCP_TIMEOUT');
  });

  it('should expose all 33 tool methods', () => {
    // Verify key methods exist
    expect(typeof client.manageAsset).toBe('function');
    expect(typeof client.manageBlueprint).toBe('function');
    expect(typeof client.controlActor).toBe('function');
    expect(typeof client.controlEditor).toBe('function');
    expect(typeof client.manageLevel).toBe('function');
    expect(typeof client.buildEnvironment).toBe('function');
    expect(typeof client.inspect).toBe('function');
    expect(typeof client.manageLighting).toBe('function');
    expect(typeof client.managePerformance).toBe('function');
    expect(typeof client.manageGeometry).toBe('function');
    expect(typeof client.manageSkeleton).toBe('function');
    expect(typeof client.manageMaterialAuthoring).toBe('function');
    expect(typeof client.manageTexture).toBe('function');
    expect(typeof client.manageGas).toBe('function');
    expect(typeof client.manageCharacter).toBe('function');
    expect(typeof client.manageCombat).toBe('function');
    expect(typeof client.manageAi).toBe('function');
    expect(typeof client.manageInventory).toBe('function');
    expect(typeof client.manageInteraction).toBe('function');
    expect(typeof client.manageWidgetAuthoring).toBe('function');
    expect(typeof client.manageNetworking).toBe('function');
    expect(typeof client.manageGameFramework).toBe('function');
    expect(typeof client.manageSessions).toBe('function');
    expect(typeof client.manageLevelStructure).toBe('function');
    expect(typeof client.manageVolumes).toBe('function');
    expect(typeof client.manageNavigation).toBe('function');
    expect(typeof client.manageSplines).toBe('function');
    expect(typeof client.manageSequence).toBe('function');
    expect(typeof client.manageInput).toBe('function');
    expect(typeof client.manageBehaviorTree).toBe('function');
    expect(typeof client.manageAudio).toBe('function');
    expect(typeof client.animationPhysics).toBe('function');
    expect(typeof client.systemControl).toBe('function');
  });

  it('should allow config updates', () => {
    client.updateConfig({ timeout: 10000, debug: true });
    const config = client.getConfig();
    expect(config.timeout).toBe(10000);
    expect(config.debug).toBe(true);
  });

  it('should call correct tool for each method', async () => {
    const methods: Array<[string, keyof McpClient]> = [
      ['manage_blueprint', 'manageBlueprint'],
      ['control_actor', 'controlActor'],
      ['control_editor', 'controlEditor'],
      ['manage_level', 'manageLevel'],
      ['build_environment', 'buildEnvironment'],
      ['inspect', 'inspect'],
      ['manage_lighting', 'manageLighting'],
      ['manage_performance', 'managePerformance'],
      ['manage_geometry', 'manageGeometry'],
      ['manage_skeleton', 'manageSkeleton'],
      ['manage_material_authoring', 'manageMaterialAuthoring'],
      ['manage_texture', 'manageTexture'],
      ['manage_gas', 'manageGas'],
      ['manage_character', 'manageCharacter'],
      ['manage_combat', 'manageCombat'],
      ['manage_ai', 'manageAi'],
      ['manage_inventory', 'manageInventory'],
      ['manage_interaction', 'manageInteraction'],
      ['manage_widget_authoring', 'manageWidgetAuthoring'],
      ['manage_networking', 'manageNetworking'],
      ['manage_game_framework', 'manageGameFramework'],
      ['manage_sessions', 'manageSessions'],
      ['manage_level_structure', 'manageLevelStructure'],
      ['manage_volumes', 'manageVolumes'],
      ['manage_navigation', 'manageNavigation'],
      ['manage_splines', 'manageSplines'],
      ['manage_sequence', 'manageSequence'],
      ['manage_input', 'manageInput'],
      ['manage_behavior_tree', 'manageBehaviorTree'],
      ['manage_audio', 'manageAudio'],
      ['animation_physics', 'animationPhysics'],
      ['system_control', 'systemControl'],
    ];

    for (const [toolName, methodName] of methods) {
      (mockInvoker.invoke as ReturnType<typeof vi.fn>).mockClear();
      const method = client[methodName] as (action: string, params?: Record<string, unknown>) => Promise<unknown>;
      await method.call(client, 'test_action');
      expect(mockInvoker.invoke).toHaveBeenCalledWith(toolName, { action: 'test_action' });
    }
  });
});
