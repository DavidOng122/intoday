# Desktop-Only 与技术债基线（2026-08-08）

- [x] 删除 Mobile UI、Android 原生工程与 Capacitor 依赖。
- [x] 窄屏继续使用同一套 Desktop UI。
- [x] 保留 Desktop PWA，删除自定义安装提示。
- [x] 删除并忽略版本库中的 `dev-dist` 生成物。
- [x] 将 Desktop 旧路径引用切换到 Feature、Entity 与 Shared 正式路径。
- [x] 修复 `taskOrder` 潜在的未定义引用。
- [x] 删除无引用的运行时与构建依赖。
- [x] 升级 Supabase/PostHog 依赖链，使生产依赖审计为 0 漏洞。
- [x] 将 Profile、Search、Pack Full View 改为按需加载。
- [x] 将 PostHog 改为浏览器空闲时按需加载，避免阻塞首屏。
- [x] 为 `DesktopCanvas` 增加稳定 props 下的渲染隔离。
- [ ] 将 `DesktopApp.jsx` 从 1171 行继续收敛到 600–900 行。
- [ ] 在修改 Hook dependencies 前，先对拖拽状态机做性能分析与回归保护。
- [ ] 拆分剩余 500 行以上组件及 5074 行 Desktop 样式表。

当前验收基线：126 个逻辑测试、生产构建、ESLint 0 Error、生产依赖 0 漏洞，以及 Desktop 手动交互回归。当前主入口为 989.38 kB（gzip 278.73 kB）。

# DesktopApp 重构执行清单

下一阶段采用 Feature-Based Architecture；完整目录规划和迁移路线见 `docs/desktop_feature_architecture_handoff.md`。

## Phase 0 — 基线

- [x] 建立重构核验文档。
- [x] 建立执行清单。
- [x] 记录 DesktopApp 行数与已知差异。
- [x] 登录环境下补充画布、Pack、Search、AddPanel 截图与手动回归。

## Phase 1 — 清理与常量

- [x] 删除桌面 Timeline、日历和日期拖动残余。
- [x] 删除多 workspace 菜单、状态和处理函数。
- [x] 统一桌面常量，以当前运行行为为准。

## Phase 2–4 — 共享纯逻辑

- [x] 使用共享 `normalizeTask` 并增加 `collectionState`。
- [x] 统一任务数组驱动的 Group 高度接口。
- [x] 统一无日期、无 workspace 感知的 Canvas 逻辑。
- [x] 添加 Inbox 状态转换纯逻辑单元测试。
- [ ] 为 Canvas 几何和碰撞纯函数补充单元测试。

## Phase 5–7 — Inbox

- [x] 为 `useSyncedTodos` 增加 `commitTodos`。
- [x] 实现 Inbox selectors 与状态转换函数。
- [x] 接入 `VITE_INBOX_ENABLED`，默认关闭。
- [x] 功能关闭时保持现有新增、Canvas 和 Search 行为。

## Phase 8–10 — 组件与 Hooks

- [x] 抽离低风险 Icons、Prompt、Modal。
- [x] 抽离 AddPanel、TaskCard、GroupedTaskCard。
- [x] 抽离 DesktopCanvas。
- [x] 抽离 Pack Full View。
- [x] 抽离 viewport、drag、task actions、uploads Hooks；selection 保留在 viewport/task actions 边界内。
- [ ] 将 DesktopApp 收敛到 600–900 行页面装配层（当前 1429 行）。

## 验收

- [x] 逻辑测试通过（127/127）。
- [x] 生产构建通过。
- [x] 新增与共享模块 changed-file lint 通过；DesktopApp 仍有已记录的历史 lint。
- [x] 登录环境手动回归通过：主画布、卡片、Pack Full View、Pack Search、AddPanel。

## Feature-Based Architecture Migration
- [x] Phase 0  基线
- [x] Phase 1  清理与常量
- [x] Phase 2  Inbox
- [x] Phase 3  Capture
- [x] Phase 4  Pack
- [x] Phase 5  Canvas
- [ ] Phase 5.5 Cleanup & Regression（自动回归与拆分修复已完成；仅待人工确认按住 Space 拖动画布的 Pan）
- [x] Phase 6  Search/Session

## Next step — Inbox UI（严格分三次提交）

- [x] Step 1：只读 InboxPanel（数量、打开/关闭、列表、搜索、空状态）。
- [x] Step 2：使用 `commitTodos` 实现确认式 Move to Pack（代码、纯逻辑测试与空 Inbox UI 回归已完成；未在正式账号制造测试资料）。
- [x] Step 3：接入 Inbox → Canvas / Pack 拖动（代码、129/129 逻辑测试、构建与空 Inbox 开关回归已完成；未在正式账号制造测试资料）。

详细执行和防误改规则见 `docs/next_step_safe_inbox_ui_plan.md`。
