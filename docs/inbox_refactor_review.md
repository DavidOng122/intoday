# DesktopApp / Inbox 重构基线

## 目标

- 在不重写 `DesktopApp.jsx` 的前提下逐步拆分桌面端架构。
- 保持现有 Pack、Search、卡片和画布交互不变。
- 建立 `Input → Inbox → 独立卡片 / Pack` 的领域逻辑，默认通过功能开关关闭。

## 当前基线

- `src/pages/DesktopApp.jsx`：7246 行。
- 当前桌面入口使用单一、无日期过滤的画布。
- 工作区已有未提交的 Pack、分享、样式和 Timeline 清理改动，重构必须保留这些修改。
- `npm run build` 可成功完成；全仓库 ESLint 存在历史错误，不能把全量 lint 作为本轮唯一门禁。
- 本地浏览器当前停留在登录页，无法在未登录状态下录制 Pack、Search 和拖拽回归截图。

## 本轮实施结果（2026-08-05）

- `DesktopApp.jsx` 从 7246 行降至 1411 行。
- 已删除运行文件中的 Timeline overlays、`ScheduleSection`、`InlineMiniCalendar`、日期拖动预览逻辑和多 workspace 增删/切换菜单。
- 已统一 `normalizeTask`、Group 高度、Canvas entries/geometry 和桌面共享常量。
- 已新增 Inbox/Library 领域逻辑、默认关闭的 `VITE_INBOX_ENABLED`，以及确认式 `commitTodos` 串行提交接口。
- 已拆分 Icons、删除确认弹窗、Group Prompt、Desktop Canvas、AddPanel、卡片和 Pack Full View。
- 已拆分 `useDesktopViewport`、`useDesktopTaskDrag`、`useDesktopTaskActions` 和 `useDesktopUploads`，并保留拖拽 `flushSync` 的同步调用时机。
- `npm run test:logic` 为 6/6；`npm run build` 成功；新增与共享模块 ESLint 通过。
- 已在登录环境完成主画布、卡片/图片、Pack Full View、Pack Search 与 AddPanel 回归；无 Vite error overlay。控制台仍有既有 PostHog 缺少 token 提示。
- 已保存基线与重构后截图到 `docs/screenshots/`。当前页面文件仍为 1411 行，600–900 行装配层目标留作下一轮低风险拆分，不应宣称已完成。

## 已核验的不一致

1. `DESKTOP_CANVAS_MAX_SCALE`
   - 当前运行实现：`2`
   - 共享常量：`1.6`
   - 采用当前运行值：`2`
2. `normalizeTask`
   - 共享版本已经包含 `desktopGroupActiveDurationType`、`desktopGroupActiveFrom`、`desktopGroupActiveUntil`。
   - DesktopApp 仍保留重复实现，需要切换到共享版本。
3. Group 高度
   - 当前运行实现接收 `tasks[]`，按卡片真实内容估算高度。
   - 共享实现只接收 item count，不能直接替换。
   - 采用当前任务数组算法作为共享接口。
4. Canvas 过滤
   - `resolveDesktopCanvasEntries` 只负责排列调用方传入的数据。
   - 日期、workspace、Inbox/Library 和 feature flag 过滤必须在 selector 层完成。
5. Drag 状态机
   - `flushSync` 位于拖拽提交路径，抽离 Hook 时必须保留调用时机。

## 数据兼容规则

- 新字段：`collectionState: 'inbox' | 'library'`。
- 缺失或无效值默认 `library`，现有数据不会自动进入 Inbox。
- Supabase 使用 `todos.payload` JSON，无需数据库表迁移。
- Timeline/workspace 的旧字段暂时保留为兼容元数据，但不参与桌面画布过滤。

## 回归门禁

- `npm run test:logic`
- `npm run build`
- 针对本轮修改文件执行 ESLint，不要求清理全仓库历史错误。
- 登录环境下手动验证：新增、拖拽、组合 Pack、移出 Pack、Pack Search、全局 Search、导出和分享。
