/**
 * BlueprintManager
 * 
 * 通用藍圖邏輯生成模組
 * 
 * 解決的核心痛點：
 * - AI 目前只能生成 C++ code，無法直接操作 Blueprint 節點圖
 * - BP 原型轉 C++ 時 reference 更新是噩夢
 * - 如果 AI 能直接在 BP 裡建好節點、連好線、設好邏輯，
 *   開發者就不用再走「BP 原型 → 手動搬到 C++」這條路
 * 
 * 提供能力：
 * - 從模板建立完整 Blueprint（含 SCS 元件、變數、函數）
 * - 在 Blueprint 圖中建立節點並連線（Event Graph 邏輯）
 * - 建立函數圖並填入邏輯節點
 * - 新增/設定變數、事件派發器
 * - 編譯與驗證 Blueprint
 */

import type { McpClient } from '../utils/mcp-client.js';
import type { AnalysisCacheManager } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';

// ─── 型別定義 ───

/** Blueprint 資訊 */
export interface BlueprintInfo {
  blueprintPath: string;
  name: string;
  parentClass: string;
  variables?: BlueprintVariable[];
  functions?: BlueprintFunction[];
  components?: BlueprintComponent[];
}

/** Blueprint 變數定義 */
export interface BlueprintVariable {
  name: string;
  type: string;
  defaultValue?: unknown;
  category?: string;
  isReplicated?: boolean;
  isPublic?: boolean;
  description?: string;
}

/** Blueprint 函數定義 */
export interface BlueprintFunction {
  name: string;
  category?: string;
  description?: string;
  inputs?: FunctionParam[];
  outputs?: FunctionParam[];
}

/** 函數參數 */
export interface FunctionParam {
  name: string;
  type: string;
}

/** Blueprint 元件定義 */
export interface BlueprintComponent {
  name: string;
  componentClass: string;
  attachTo?: string;
  properties?: Record<string, unknown>;
}

/** 節點定義 */
export interface NodeDefinition {
  /** 節點類型（K2Node_CallFunction, K2Node_IfThenElse 等） */
  nodeType: string;
  /** 節點名稱（用於後續連線引用） */
  name: string;
  /** 圖中位置 */
  posX?: number;
  posY?: number;
  /** 成員類別（函數所屬的類別） */
  memberClass?: string;
  /** 成員名稱（函數名稱） */
  memberName?: string;
  /** 額外屬性 */
  properties?: Record<string, unknown>;
}

/** 節點連線定義 */
export interface PinConnection {
  fromNodeId: string;
  fromPin: string;
  toNodeId: string;
  toPin: string;
}

/** 圖邏輯定義（一組節點 + 連線） */
export interface GraphLogic {
  /** 目標圖名稱（EventGraph, 函數名稱等） */
  graphName: string;
  /** 節點列表 */
  nodes: NodeDefinition[];
  /** 連線列表 */
  connections: PinConnection[];
}

/** Blueprint 建立選項 */
export interface BlueprintCreateOptions {
  name: string;
  path: string;
  parentClass: string;
  variables?: BlueprintVariable[];
  functions?: BlueprintFunction[];
  components?: BlueprintComponent[];
  /** 圖邏輯（節點 + 連線） */
  graphLogics?: GraphLogic[];
  compile?: boolean;
  save?: boolean;
}

/** Blueprint 建立結果 */
export interface BlueprintCreateResult {
  success: boolean;
  blueprintPath: string;
  error?: string;
  /** 各步驟結果 */
  steps: StepResult[];
}

/** 步驟結果 */
export interface StepResult {
  step: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

/** 節點建立結果 */
export interface NodeCreateResult {
  success: boolean;
  nodeId?: string;
  nodeName: string;
  error?: string;
}

/** 批次節點建立結果 */
export interface GraphBuildResult {
  success: boolean;
  graphName: string;
  nodesCreated: number;
  connectionsCreated: number;
  errors: string[];
  /** 節點名稱 → nodeId 的映射 */
  nodeIdMap: Record<string, string>;
}

/** 模板套用選項 */
export interface TemplateApplyOptions {
  /** 模板資料（JSON 格式，與 templates/blueprints/*.json 相同結構） */
  template: BlueprintTemplate;
  /** 建立路徑 */
  path: string;
  /** 覆寫名稱（不指定則用模板名稱） */
  nameOverride?: string;
  /** 是否也建立圖邏輯 */
  includeGraphLogic?: boolean;
  compile?: boolean;
  save?: boolean;
}

/** Blueprint 模板結構（對應 templates/blueprints/*.json） */
export interface BlueprintTemplate {
  name: string;
  description?: string;
  parentClass: string;
  components?: TemplateComponent[];
  variables?: TemplateVariable[];
  functions?: TemplateFunction[];
  events?: TemplateEvent[];
}

/** 模板元件 */
export interface TemplateComponent {
  name: string;
  class: string;
  attachTo?: string | null;
  isRoot?: boolean;
  isDefault?: boolean;
  properties?: Record<string, unknown>;
}

/** 模板變數 */
export interface TemplateVariable {
  name: string;
  type: string;
  default?: unknown;
  category?: string;
  replication?: string;
  description?: string;
}

/** 模板函數 */
export interface TemplateFunction {
  name: string;
  category?: string;
  description?: string;
  inputs?: FunctionParam[];
  outputs?: FunctionParam[];
}

/** 模板事件 */
export interface TemplateEvent {
  name: string;
  category?: string;
  description?: string;
  parameters?: FunctionParam[];
}


// ─── BlueprintManager 類別 ───

/**
 * BlueprintManager
 * 
 * 通用藍圖邏輯生成器，讓 AI 可以直接在 Blueprint 裡：
 * - 建立完整的 Blueprint（含元件樹、變數、函數定義）
 * - 在 Event Graph 或函數圖中建立節點並連線
 * - 從模板一鍵生成完整的 Blueprint 結構
 * - 編譯與驗證 Blueprint
 * 
 * 這樣開發者就不需要：
 * - 先在 BP Editor 手動搭原型
 * - 再手動搬到 C++ 處理 reference 更新
 * - AI 直接在 BP 裡把邏輯做好，省去轉換的痛苦
 */
export class BlueprintManager {
  private mcpClient: McpClient;
  private cacheManager: AnalysisCacheManager;
  private logger: Logger;

  constructor(mcpClient: McpClient, cacheManager: AnalysisCacheManager) {
    this.mcpClient = mcpClient;
    this.cacheManager = cacheManager;
    this.logger = new Logger({ level: 'info' }, { module: 'BlueprintManager' });
  }

  // ─── Blueprint 建立 ───

  /**
   * 建立完整的 Blueprint
   * 
   * 一次完成：建立 BP → 加元件 → 加變數 → 加函數 → 建圖邏輯 → 編譯
   */
  async createBlueprint(options: BlueprintCreateOptions): Promise<BlueprintCreateResult> {
    const { name, path, parentClass, compile = true, save = true } = options;
    const blueprintPath = `${path}/${name}`;
    const steps: StepResult[] = [];

    this.logger.info(`Creating blueprint: ${name}`, { path, parentClass });

    // 1. 建立 Blueprint
    const createResult = await this.mcpClient.manageBlueprint('create', {
      blueprintPath,
      parentClass,
      save: false,
    });

    steps.push({
      step: 'create_blueprint',
      success: createResult.success,
      error: createResult.error?.message,
    });

    if (!createResult.success) {
      return { success: false, blueprintPath, error: createResult.error?.message, steps };
    }

    // 2. 加入 SCS 元件
    if (options.components?.length) {
      for (const comp of options.components) {
        const result = await this.addComponent(blueprintPath, comp);
        steps.push(result);
      }
    }

    // 3. 加入變數
    if (options.variables?.length) {
      for (const variable of options.variables) {
        const result = await this.addVariable(blueprintPath, variable);
        steps.push(result);
      }
    }

    // 4. 加入函數
    if (options.functions?.length) {
      for (const func of options.functions) {
        const result = await this.addFunction(blueprintPath, func);
        steps.push(result);
      }
    }

    // 5. 建立圖邏輯（節點 + 連線）
    if (options.graphLogics?.length) {
      for (const graphLogic of options.graphLogics) {
        const result = await this.buildGraphLogic(blueprintPath, graphLogic);
        steps.push({
          step: `build_graph_${graphLogic.graphName}`,
          success: result.success,
          error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
          data: result,
        });
      }
    }

    // 6. 編譯
    if (compile) {
      const compileResult = await this.compileBlueprint(blueprintPath, save);
      steps.push(compileResult);
    }

    const hasErrors = steps.some(s => !s.success);
    return {
      success: !hasErrors,
      blueprintPath,
      error: hasErrors ? '部分步驟失敗，請查看 steps 詳情' : undefined,
      steps,
    };
  }

  // ─── 元件管理 ───

  /**
   * 新增 SCS 元件到 Blueprint
   */
  async addComponent(
    blueprintPath: string,
    component: BlueprintComponent
  ): Promise<StepResult> {
    this.logger.debug(`Adding component: ${component.name}`, { blueprintPath });

    const result = await this.mcpClient.manageBlueprint('add_scs_component', {
      blueprintPath,
      componentName: component.name,
      componentClass: component.componentClass,
      ...(component.attachTo ? { parentComponent: component.attachTo } : {}),
    });

    // 設定元件屬性
    if (result.success && component.properties) {
      for (const [propName, propValue] of Object.entries(component.properties)) {
        await this.mcpClient.manageBlueprint('set_scs_property', {
          blueprintPath,
          componentName: component.name,
          propertyName: propName,
          value: propValue,
        });
      }
    }

    return {
      step: `add_component_${component.name}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  // ─── 變數管理 ───

  /**
   * 新增變數到 Blueprint
   */
  async addVariable(
    blueprintPath: string,
    variable: BlueprintVariable
  ): Promise<StepResult> {
    this.logger.debug(`Adding variable: ${variable.name}`, { blueprintPath });

    const result = await this.mcpClient.manageBlueprint('add_variable', {
      blueprintPath,
      variableName: variable.name,
      variableType: variable.type,
      ...(variable.defaultValue !== undefined ? { defaultValue: variable.defaultValue } : {}),
      ...(variable.category ? { category: variable.category } : {}),
      ...(variable.isReplicated ? { isReplicated: variable.isReplicated } : {}),
      ...(variable.isPublic !== undefined ? { isPublic: variable.isPublic } : {}),
    });

    return {
      step: `add_variable_${variable.name}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  /**
   * 移除變數
   */
  async removeVariable(blueprintPath: string, variableName: string): Promise<StepResult> {
    const result = await this.mcpClient.manageBlueprint('remove_variable', {
      blueprintPath,
      variableName,
    });

    return {
      step: `remove_variable_${variableName}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  // ─── 函數管理 ───

  /**
   * 新增函數到 Blueprint
   */
  async addFunction(
    blueprintPath: string,
    func: BlueprintFunction
  ): Promise<StepResult> {
    this.logger.debug(`Adding function: ${func.name}`, { blueprintPath });

    const params: Record<string, unknown> = {
      blueprintPath,
      functionName: func.name,
    };

    if (func.inputs?.length) {
      params.inputs = func.inputs.map(p => ({ name: p.name, type: p.type }));
    }
    if (func.outputs?.length) {
      params.outputs = func.outputs.map(p => ({ name: p.name, type: p.type }));
    }
    if (func.category) {
      params.category = func.category;
    }

    const result = await this.mcpClient.manageBlueprint('add_function', params);

    return {
      step: `add_function_${func.name}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  /**
   * 新增自訂事件到 Blueprint
   */
  async addEvent(
    blueprintPath: string,
    eventName: string,
    parameters?: FunctionParam[]
  ): Promise<StepResult> {
    this.logger.debug(`Adding event: ${eventName}`, { blueprintPath });

    const result = await this.mcpClient.manageBlueprint('add_event', {
      blueprintPath,
      eventName,
      ...(parameters?.length ? { parameters: parameters.map(p => ({ name: p.name, type: p.type })) } : {}),
    });

    return {
      step: `add_event_${eventName}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  // ─── 節點圖操作（核心能力） ───

  /**
   * 在 Blueprint 圖中建立單一節點
   */
  async createNode(
    blueprintPath: string,
    graphName: string,
    node: NodeDefinition
  ): Promise<NodeCreateResult> {
    this.logger.debug(`Creating node: ${node.name}`, { blueprintPath, graphName });

    const params: Record<string, unknown> = {
      blueprintPath,
      graphName,
      nodeType: node.nodeType,
      ...(node.posX !== undefined ? { posX: node.posX } : {}),
      ...(node.posY !== undefined ? { posY: node.posY } : {}),
      ...(node.memberClass ? { memberClass: node.memberClass } : {}),
      ...(node.memberName ? { memberName: node.memberName } : {}),
      ...(node.properties ? { properties: node.properties } : {}),
    };

    const result = await this.mcpClient.manageBlueprint('add_node', params);

    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      const nodeId = (data.nodeId as string) || (data.id as string) || '';
      return { success: true, nodeId, nodeName: node.name };
    }

    return {
      success: false,
      nodeName: node.name,
      error: result.error?.message || '節點建立失敗',
    };
  }

  /**
   * 連接兩個節點的 Pin
   */
  async connectPins(
    blueprintPath: string,
    graphName: string,
    connection: PinConnection
  ): Promise<StepResult> {
    const result = await this.mcpClient.manageBlueprint('connect_pins', {
      blueprintPath,
      graphName,
      fromNodeId: connection.fromNodeId,
      fromPin: connection.fromPin,
      toNodeId: connection.toNodeId,
      toPin: connection.toPin,
    });

    return {
      step: `connect_${connection.fromPin}_to_${connection.toPin}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  /**
   * 建立完整的圖邏輯（批次建立節點 + 連線）
   * 
   * 這是最核心的方法：一次把一整段邏輯的節點和連線都建好
   */
  async buildGraphLogic(
    blueprintPath: string,
    graphLogic: GraphLogic
  ): Promise<GraphBuildResult> {
    const { graphName, nodes, connections } = graphLogic;
    this.logger.info(`Building graph logic: ${graphName}`, {
      nodeCount: nodes.length,
      connectionCount: connections.length,
    });

    const nodeIdMap: Record<string, string> = {};
    const errors: string[] = [];
    let nodesCreated = 0;
    let connectionsCreated = 0;

    // 1. 建立所有節點
    for (const node of nodes) {
      const result = await this.createNode(blueprintPath, graphName, node);
      if (result.success && result.nodeId) {
        nodeIdMap[node.name] = result.nodeId;
        nodesCreated++;
      } else {
        errors.push(`Node '${node.name}': ${result.error}`);
      }
    }

    // 2. 建立所有連線（用 nodeIdMap 解析名稱 → ID）
    for (const conn of connections) {
      const fromId = nodeIdMap[conn.fromNodeId] || conn.fromNodeId;
      const toId = nodeIdMap[conn.toNodeId] || conn.toNodeId;

      if (!fromId || !toId) {
        errors.push(`Connection: 找不到節點 '${conn.fromNodeId}' 或 '${conn.toNodeId}'`);
        continue;
      }

      const result = await this.connectPins(blueprintPath, graphName, {
        fromNodeId: fromId,
        fromPin: conn.fromPin,
        toNodeId: toId,
        toPin: conn.toPin,
      });

      if (result.success) {
        connectionsCreated++;
      } else {
        errors.push(`Connection ${conn.fromPin}→${conn.toPin}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      graphName,
      nodesCreated,
      connectionsCreated,
      errors,
      nodeIdMap,
    };
  }

  /**
   * 設定節點的 Pin 預設值
   */
  async setNodePinDefault(
    blueprintPath: string,
    graphName: string,
    nodeId: string,
    pinName: string,
    value: unknown
  ): Promise<StepResult> {
    const result = await this.mcpClient.manageBlueprint('set_pin_default_value', {
      blueprintPath,
      graphName,
      nodeId,
      pinName,
      value,
    });

    return {
      step: `set_pin_default_${pinName}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  /**
   * 刪除節點
   */
  async deleteNode(
    blueprintPath: string,
    graphName: string,
    nodeId: string
  ): Promise<StepResult> {
    const result = await this.mcpClient.manageBlueprint('delete_node', {
      blueprintPath,
      graphName,
      nodeId,
    });

    return {
      step: `delete_node_${nodeId}`,
      success: result.success,
      error: result.error?.message,
    };
  }

  // ─── 模板系統 ───

  /**
   * 從模板建立 Blueprint
   * 
   * 讀取 templates/blueprints/*.json 格式的模板，
   * 一鍵生成完整的 Blueprint 結構
   */
  async createFromTemplate(options: TemplateApplyOptions): Promise<BlueprintCreateResult> {
    const { template, path, nameOverride, compile = true, save = true } = options;
    const name = nameOverride || template.name;

    this.logger.info(`Creating blueprint from template: ${name}`, {
      templateName: template.name,
      parentClass: template.parentClass,
    });

    // 轉換模板格式為 BlueprintCreateOptions
    const createOptions: BlueprintCreateOptions = {
      name,
      path,
      parentClass: template.parentClass,
      compile,
      save,
    };

    // 轉換元件
    if (template.components?.length) {
      createOptions.components = template.components
        .filter(c => !c.isDefault) // 跳過引擎預設元件
        .map(c => ({
          name: c.name,
          componentClass: c.class,
          attachTo: c.attachTo || undefined,
          properties: c.properties,
        }));
    }

    // 轉換變數
    if (template.variables?.length) {
      createOptions.variables = template.variables.map(v => ({
        name: v.name,
        type: v.type,
        defaultValue: v.default,
        category: v.category,
        isReplicated: v.replication === 'Replicated' || v.replication === 'RepNotify',
        description: v.description,
      }));
    }

    // 轉換函數
    if (template.functions?.length) {
      createOptions.functions = template.functions.map(f => ({
        name: f.name,
        category: f.category,
        description: f.description,
        inputs: f.inputs,
        outputs: f.outputs,
      }));
    }

    return this.createBlueprint(createOptions);
  }

  // ─── 查詢與檢查 ───

  /**
   * 取得 Blueprint 詳細資訊
   */
  async getBlueprintInfo(blueprintPath: string): Promise<BlueprintInfo | null> {
    const result = await this.mcpClient.manageBlueprint('get_blueprint', {
      blueprintPath,
    });

    if (!result.success) return null;

    const data = result.data as Record<string, unknown>;
    return {
      blueprintPath,
      name: blueprintPath.split('/').pop() || blueprintPath,
      parentClass: (data.parentClass as string) || 'Unknown',
    };
  }

  /**
   * 取得 Blueprint 的圖詳情（節點列表）
   */
  async getGraphDetails(
    blueprintPath: string,
    graphName: string
  ): Promise<unknown> {
    const result = await this.mcpClient.manageBlueprint('get_graph_details', {
      blueprintPath,
      graphName,
    });

    return result.success ? result.data : null;
  }

  /**
   * 取得節點詳情（Pin 列表等）
   */
  async getNodeDetails(
    blueprintPath: string,
    graphName: string,
    nodeId: string
  ): Promise<unknown> {
    const result = await this.mcpClient.manageBlueprint('get_node_details', {
      blueprintPath,
      graphName,
      nodeId,
    });

    return result.success ? result.data : null;
  }

  /**
   * 列出可用的節點類型
   */
  async listNodeTypes(filter?: string): Promise<unknown> {
    const result = await this.mcpClient.manageBlueprint('list_node_types', {
      ...(filter ? { nodeType: filter } : {}),
    });

    return result.success ? result.data : null;
  }

  /**
   * 取得 SCS 元件樹
   */
  async getComponentTree(blueprintPath: string): Promise<unknown> {
    const result = await this.mcpClient.manageBlueprint('get_scs', {
      blueprintPath,
    });

    return result.success ? result.data : null;
  }

  // ─── 編譯與儲存 ───

  /**
   * 編譯 Blueprint
   */
  async compileBlueprint(
    blueprintPath: string,
    save: boolean = true
  ): Promise<StepResult> {
    this.logger.info(`Compiling blueprint: ${blueprintPath}`);

    const result = await this.mcpClient.manageBlueprint('compile', {
      blueprintPath,
      save,
    });

    return {
      step: 'compile',
      success: result.success,
      error: result.error?.message,
    };
  }

  // ─── 便利方法：常見邏輯模式 ───

  /**
   * 建立 BeginPlay 事件節點
   * 
   * 幾乎每個 Blueprint 都需要的起始點
   */
  async addBeginPlayEvent(
    blueprintPath: string,
    graphName: string = 'EventGraph'
  ): Promise<NodeCreateResult> {
    return this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_Event',
      name: 'BeginPlay',
      posX: 0,
      posY: 0,
      memberName: 'ReceiveBeginPlay',
    });
  }

  /**
   * 建立 Tick 事件節點
   */
  async addTickEvent(
    blueprintPath: string,
    graphName: string = 'EventGraph'
  ): Promise<NodeCreateResult> {
    return this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_Event',
      name: 'Tick',
      posX: 0,
      posY: 300,
      memberName: 'ReceiveTick',
    });
  }

  /**
   * 建立函數呼叫節點
   */
  async addFunctionCallNode(
    blueprintPath: string,
    graphName: string,
    functionName: string,
    targetClass?: string,
    position?: { x: number; y: number }
  ): Promise<NodeCreateResult> {
    return this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_CallFunction',
      name: `Call_${functionName}`,
      posX: position?.x ?? 300,
      posY: position?.y ?? 0,
      memberClass: targetClass,
      memberName: functionName,
    });
  }

  /**
   * 建立 Branch（If/Else）節點
   */
  async addBranchNode(
    blueprintPath: string,
    graphName: string,
    position?: { x: number; y: number }
  ): Promise<NodeCreateResult> {
    return this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_IfThenElse',
      name: 'Branch',
      posX: position?.x ?? 300,
      posY: position?.y ?? 0,
    });
  }

  /**
   * 建立 Print String 節點（除錯用）
   */
  async addPrintStringNode(
    blueprintPath: string,
    graphName: string,
    message: string = 'Debug',
    position?: { x: number; y: number }
  ): Promise<NodeCreateResult> {
    const result = await this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_CallFunction',
      name: `Print_${message.replace(/\s/g, '_')}`,
      posX: position?.x ?? 500,
      posY: position?.y ?? 0,
      memberClass: 'KismetSystemLibrary',
      memberName: 'PrintString',
    });

    // 設定訊息預設值
    if (result.success && result.nodeId) {
      await this.setNodePinDefault(
        blueprintPath,
        graphName,
        result.nodeId,
        'InString',
        message
      );
    }

    return result;
  }

  /**
   * 建立變數 Get 節點
   */
  async addVariableGetNode(
    blueprintPath: string,
    graphName: string,
    variableName: string,
    position?: { x: number; y: number }
  ): Promise<NodeCreateResult> {
    return this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_VariableGet',
      name: `Get_${variableName}`,
      posX: position?.x ?? 0,
      posY: position?.y ?? 0,
      properties: { variableName },
    });
  }

  /**
   * 建立變數 Set 節點
   */
  async addVariableSetNode(
    blueprintPath: string,
    graphName: string,
    variableName: string,
    position?: { x: number; y: number }
  ): Promise<NodeCreateResult> {
    return this.createNode(blueprintPath, graphName, {
      nodeType: 'K2Node_VariableSet',
      name: `Set_${variableName}`,
      posX: position?.x ?? 300,
      posY: position?.y ?? 0,
      properties: { variableName },
    });
  }
}
