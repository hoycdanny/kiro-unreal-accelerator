# Contributing to Kiro Unreal Accelerator

感謝你對本專案的興趣！以下是貢獻指南。

---

## 開發環境設定

```bash
# 安裝依賴
npm install

# 執行測試
npm test

# TypeScript 型別檢查
npx tsc --noEmit

# Lint 檢查
npm run lint
```

## 提交規範

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 新增 Blueprint 節點類型支援
fix: 修正材質連線 Pin 名稱解析
docs: 更新 GAS 模式文件
test: 新增 WorkflowEngine 條件分支測試
refactor: 重構 McpClient 錯誤處理
```

## 程式碼風格

- 遵循 TypeScript strict mode（`tsconfig.json` 已設定）
- 所有公開 API 必須有 JSDoc 註解
- 測試覆蓋率目標 > 80%
- 使用 `vitest` 作為測試框架

## 新增 Steering 文件

1. 在 `steering/` 目錄建立 `.md` 文件
2. 文件開頭包含英文摘要（供非中文使用者參考）
3. 更新 `POWER.md` 的 Steering Files Index 表格
4. 確保 Intent Routing Rules 中有對應的路由規則

## 新增模板

1. 在 `templates/` 對應子目錄建立 `.json` 文件
2. 模板必須包含 `name`、`description`、`version` 欄位
3. 更新 `POWER.md` 的 Templates Index 表格
4. 新增對應的測試案例

## 新增 MCP 工具封裝

1. 在 `src/utils/mcp-client.ts` 中新增工具方法
2. 定義對應的 TypeScript 型別（`src/types/`）
3. 更新 `POWER.md` 的 MCP Tool Mapping 表格
4. 新增單元測試

## 測試

```bash
# 執行所有測試
npm test

# 執行特定測試
npx vitest run src/__tests__/managers/BlueprintManager.test.ts

# 查看覆蓋率
npm run test:coverage
```

## Security Issue Notifications

如果你發現安全漏洞，請不要在公開 Issue 中回報。請透過以下方式通知：

1. **不要**在 GitHub Issues 中公開安全問題
2. 請透過 GitHub Security Advisory 功能私下回報
3. 提供漏洞的詳細描述、重現步驟與潛在影響
4. 我們會在 48 小時內回覆確認

### 安全考量

- MCP 連線僅使用 localhost（流量不離開本機）
- 不要在設定檔中包含敏感資訊（API Key、密碼等）
- 所有外部輸入必須經過驗證
- 避免在日誌中輸出敏感資料

## 授權

提交貢獻即表示你同意以 MIT License 授權你的貢獻。
