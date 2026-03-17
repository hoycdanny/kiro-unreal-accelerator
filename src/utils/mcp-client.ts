/**
 * MCP Client
 * 
 * 封裝 Unreal Engine MCP 的 35 個工具呼叫
 * 
 * Validates: Requirements 18.1
 */

import type { Severity } from '../types/analysis.js';
import type { PowerError } from '../types/error.js';
import { Logger } from './logger.js';

/**
 * MCP 客戶端配置
 */
export interface McpClientConfig {
  /** Unreal Engine 專案路徑 */
  projectPath: string;
  /** 工具呼叫逾時（毫秒） */
  timeout: number;
  /** 是否啟用除錯日誌 */
  debug: boolean;
}

/**
 * MCP 工具呼叫結果
 */
export interface McpToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: PowerError;
}

/**
 * MCP 工具呼叫器介面
 * 
 * 允許注入不同的工具呼叫實作（例如測試用的 mock）
 */
export interface McpToolInvoker {
  invoke(toolName: string, params: Record<string, unknown>): Promise<unknown>;
}

const DEFAULT_CONFIG: McpClientConfig = {
  projectPath: '',
  timeout: 30000,
  debug: false,
};

/**
 * 所有支援的 MCP 工具名稱
 */
export const MCP_TOOL_NAMES = [
  'manage_asset',
  'manage_blueprint',
  'control_actor',
  'control_editor',
  'manage_level',
  'build_environment',
  'inspect',
  'manage_lighting',
  'manage_performance',
  'manage_geometry',
  'manage_skeleton',
  'manage_material_authoring',
  'manage_texture',
  'manage_gas',
  'manage_character',
  'manage_combat',
  'manage_ai',
  'manage_inventory',
  'manage_interaction',
  'manage_widget_authoring',
  'manage_networking',
  'manage_game_framework',
  'manage_sessions',
  'manage_level_structure',
  'manage_volumes',
  'manage_navigation',
  'manage_splines',
  'manage_sequence',
  'manage_input',
  'manage_behavior_tree',
  'manage_audio',
  'animation_physics',
  'system_control',
  'manage_tools',
  'manage_unreal_engine',
] as const;

export type McpToolName = typeof MCP_TOOL_NAMES[number];


/**
 * 建立 PowerError
 */
function createPowerError(
  code: string,
  severity: Severity,
  message: string,
  context: PowerError['context'],
  suggestion: string
): PowerError {
  return {
    code,
    severity,
    message,
    context,
    suggestion,
  };
}

/**
 * MCP 客戶端
 * 
 * 封裝所有 Unreal Engine MCP 工具的呼叫，提供統一的錯誤處理與日誌記錄
 */
export class McpClient {
  private config: McpClientConfig;
  private logger: Logger;
  private invoker: McpToolInvoker | null = null;

  constructor(config: Partial<McpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(
      { level: this.config.debug ? 'debug' : 'info' },
      { module: 'McpClient' }
    );
  }

  /**
   * 設定工具呼叫器（用於依賴注入）
   */
  setInvoker(invoker: McpToolInvoker): void {
    this.invoker = invoker;
  }

  /**
   * 取得配置
   */
  getConfig(): McpClientConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<McpClientConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.debug !== undefined) {
      this.logger.setLevel(config.debug ? 'debug' : 'info');
    }
  }

  /**
   * 呼叫 MCP 工具
   */
  private async callTool<T>(
    toolName: McpToolName,
    action: string,
    params: Record<string, unknown>
  ): Promise<McpToolResult<T>> {
    this.logger.debug(`Calling MCP tool: ${toolName}`, { action, params });

    try {
      if (!this.invoker) {
        return {
          success: false,
          error: createPowerError(
            'MCP_NO_INVOKER',
            'critical',
            'MCP tool invoker not configured',
            { tool: toolName },
            'Configure an MCP tool invoker using setInvoker() before calling tools'
          ),
        };
      }

      const result = await Promise.race([
        this.invoker.invoke(toolName, { action, ...params }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
        ),
      ]);

      this.logger.debug(`MCP tool ${toolName} completed`, { action });

      return {
        success: true,
        data: result as T,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage === 'Timeout';

      this.logger.error(`MCP tool ${toolName} failed: ${errorMessage}`, { action });

      return {
        success: false,
        error: createPowerError(
          isTimeout ? 'MCP_TIMEOUT' : 'MCP_CALL_FAILED',
          'critical',
          isTimeout
            ? `MCP tool ${toolName} timed out after ${this.config.timeout}ms`
            : `MCP tool ${toolName} failed: ${errorMessage}`,
          { tool: toolName },
          isTimeout
            ? 'Check if Unreal Editor is responding and increase timeout if needed'
            : 'Check MCP server connection and Unreal Editor status'
        ),
      };
    }
  }

  // ─── 資產管理工具 ───

  /**
   * 管理資產
   * 
   * 建立、匯入、複製、重新命名、刪除資產。編輯材質圖與實例。分析依賴關係。
   */
  async manageAsset<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_asset', action, params);
  }

  /**
   * 管理 Blueprint
   * 
   * 建立 Blueprint，新增 SCS 元件（網格、碰撞、相機），操作圖形節點。
   */
  async manageBlueprint<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_blueprint', action, params);
  }

  /**
   * 控制 Actor
   * 
   * 生成 Actor，設定變換，啟用物理，新增元件，管理標籤，附加 Actor。
   */
  async controlActor<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('control_actor', action, params);
  }

  /**
   * 控制編輯器
   * 
   * 啟動/停止 PIE，控制視口相機，執行控制台命令，截圖，模擬輸入。
   */
  async controlEditor<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('control_editor', action, params);
  }

  /**
   * 管理關卡
   * 
   * 載入/儲存關卡，設定串流，管理 World Partition 單元，建置光照。
   */
  async manageLevel<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_level', action, params);
  }

  /**
   * 建置環境
   * 
   * 建立/雕刻地形，繪製植被，生成程序化地形/生態群落。
   */
  async buildEnvironment<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('build_environment', action, params);
  }

  /**
   * 檢查物件
   * 
   * 檢查任何 UObject：讀取/寫入屬性，列出元件，匯出快照，查詢類別資訊。
   */
  async inspect<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('inspect', action, params);
  }

  /**
   * 管理光照
   * 
   * 生成光源（點光源、聚光燈、矩形光、天空光），設定 GI、陰影、體積霧，建置光照。
   */
  async manageLighting<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_lighting', action, params);
  }

  /**
   * 管理效能
   * 
   * 執行效能分析/基準測試，設定可擴展性、LOD、Nanite 與最佳化設定。
   */
  async managePerformance<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_performance', action, params);
  }

  /**
   * 管理幾何體
   * 
   * 使用 Geometry Script 建立程序化網格：布林運算、變形器、UV、碰撞、LOD 生成。
   */
  async manageGeometry<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_geometry', action, params);
  }

  /**
   * 管理骨架
   * 
   * 編輯骨架網格：新增插槽，設定物理資產，設定蒙皮權重，建立變形目標。
   */
  async manageSkeleton<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_skeleton', action, params);
  }

  /**
   * 管理材質製作
   * 
   * 建立材質與表達式、參數、函數、實例，以及地形混合層。
   */
  async manageMaterialAuthoring<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_material_authoring', action, params);
  }

  /**
   * 管理貼圖
   * 
   * 建立程序化貼圖，處理影像，烘焙法線/AO 貼圖，設定壓縮設定。
   */
  async manageTexture<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_texture', action, params);
  }

  /**
   * 管理 GAS
   * 
   * 建立 Gameplay Ability、Effect、Attribute Set 與 Gameplay Cue。
   */
  async manageGas<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_gas', action, params);
  }

  /**
   * 管理角色
   * 
   * 建立角色 Blueprint，設定移動、運動與動畫狀態機。
   */
  async manageCharacter<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_character', action, params);
  }

  /**
   * 管理戰鬥
   * 
   * 建立武器（掃射/投射物射擊），設定傷害類型、碰撞箱、裝填、近戰戰鬥（連招、格擋、招架）。
   */
  async manageCombat<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_combat', action, params);
  }

  /**
   * 管理 AI
   * 
   * 建立 AI 控制器，設定行為樹、黑板、EQS 查詢與感知系統。
   */
  async manageAi<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_ai', action, params);
  }

  /**
   * 管理物品欄
   * 
   * 建立物品資料資產、物品欄元件、世界拾取物、掉落表與製作配方。
   */
  async manageInventory<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_inventory', action, params);
  }

  /**
   * 管理互動
   * 
   * 建立互動物件：門、開關、寶箱、拉桿。設定可破壞網格與觸發體積。
   */
  async manageInteraction<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_interaction', action, params);
  }

  /**
   * 管理 Widget 製作
   * 
   * 建立 UMG Widget：按鈕、文字、圖片、滑桿。設定佈局、綁定、動畫。建置 HUD 與選單。
   */
  async manageWidgetAuthoring<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_widget_authoring', action, params);
  }

  /**
   * 管理網路
   * 
   * 設定多人遊戲：屬性複製、RPC（Server/Client/Multicast）、權限、相關性與網路預測。
   */
  async manageNetworking<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_networking', action, params);
  }

  /**
   * 管理遊戲框架
   * 
   * 建立 GameMode、GameState、PlayerController、PlayerState Blueprint。設定比賽流程、隊伍、計分與生成。
   */
  async manageGameFramework<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_game_framework', action, params);
  }

  /**
   * 管理會話
   * 
   * 設定本地多人遊戲：分割畫面佈局、LAN 主機/加入、語音聊天頻道與按鍵說話。
   */
  async manageSessions<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_sessions', action, params);
  }

  /**
   * 管理關卡結構
   * 
   * 建立關卡與子關卡。設定 World Partition、串流、資料層、HLOD 與關卡實例。
   */
  async manageLevelStructure<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_level_structure', action, params);
  }

  /**
   * 管理體積
   * 
   * 建立觸發體積、阻擋體積、物理體積、音訊體積與導航邊界。
   */
  async manageVolumes<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_volumes', action, params);
  }

  /**
   * 管理導航
   * 
   * 設定 NavMesh 設定，新增導航修改器，建立導航連結與智慧連結用於尋路。
   */
  async manageNavigation<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_navigation', action, params);
  }

  /**
   * 管理樣條線
   * 
   * 建立樣條線 Actor，新增/修改點，沿樣條線附加網格，查詢樣條線資料。
   */
  async manageSplines<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_splines', action, params);
  }

  /**
   * 管理序列
   * 
   * 編輯關卡序列：新增軌道，綁定 Actor，設定關鍵幀，控制播放，錄製相機。
   */
  async manageSequence<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_sequence', action, params);
  }

  /**
   * 管理輸入
   * 
   * 建立輸入動作與映射上下文。新增按鍵/手把綁定與修改器和觸發器。
   */
  async manageInput<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_input', action, params);
  }

  /**
   * 管理行為樹
   * 
   * 建立行為樹，新增任務/裝飾器/服務節點，設定節點屬性。
   */
  async manageBehaviorTree<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_behavior_tree', action, params);
  }

  /**
   * 管理音訊
   * 
   * 播放/停止音效，新增音訊元件，設定混音、衰減、空間音訊，製作 Sound Cue/MetaSound。
   */
  async manageAudio<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_audio', action, params);
  }

  /**
   * 動畫與物理
   * 
   * 建立動畫 Blueprint、混合空間、蒙太奇、狀態機、Control Rig、IK 骨架、布娃娃與載具物理。
   */
  async animationPhysics<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('animation_physics', action, params);
  }

  /**
   * 系統控制
   * 
   * 執行效能分析，設定品質/CVar，執行控制台命令，執行 UBT，管理 Widget。
   */
  async systemControl<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('system_control', action, params);
  }

  /**
   * 管理工具
   * 
   * 動態 MCP 工具管理。在執行時啟用/停用工具與類別。
   */
  async manageTools<T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<McpToolResult<T>> {
    return this.callTool<T>('manage_tools', action, params);
  }
}
