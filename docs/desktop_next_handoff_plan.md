# Desktop / Inbox 下一阶段交接计划

架构目录迁移、模块边界和现有文件映射请以 `docs/desktop_feature_architecture_handoff.md` 为主；本文继续负责 Inbox 产品功能的执行顺序。

更新时间：2026-08-05

## 1. 当前结论

这轮已经完成 Desktop 架构的主体拆分，以及 Inbox 的领域逻辑重构；但 Inbox 还不是一个可以交付给用户使用的完整功能。

当前必须保持：

```env
VITE_INBOX_ENABLED=false
```

关闭时，新增资料、Canvas、Search 和 Pack 继续维持原来的用户体验。

如果现在直接开启，新增资料会被标记为 Inbox，Canvas 会只显示 Library；由于 Inbox UI 尚未接入，用户会感觉新增资料“消失”。因此，在下文 Phase A–D 完成之前禁止在生产环境开启。

## 2. 已完成内容

### Desktop 架构

- `DesktopApp.jsx` 已从 7246 行降到 1411 行。
- Timeline、日期导航、日期拖动切换和 Timeline overlays 已删除。
- 隐藏的多 Workspace 增删、切换菜单已删除；当前使用单一 Workspace Canvas。
- Pack、Search、卡片现有视觉和 DOM 行为没有主动改版。
- 已拆分 AddPanel、TaskCard、GroupedTaskCard、DesktopCanvas、Pack Full View、Icons、Prompt 和删除弹窗。
- 已拆分 Viewport、Task Drag、Task Actions 和 Uploads Hooks。
- 拖拽 overlay 的 `flushSync` 调用和同步时机保留在 `useDesktopTaskDrag`。

### Inbox 数据层

- `collectionState: 'inbox' | 'library'` 已加入统一 `normalizeTask`。
- 旧资料缺少该字段时默认归为 `library`，不会意外进入 Inbox。
- 已实现 selectors：
  - `isInboxItem`
  - `isLibraryItem`
  - `getInboxItems`
  - `getLibraryItems`
  - `getInboxCount`
- 已实现状态转换：
  - `createInboxTask`
  - `placeInboxItem`
  - `moveInboxItemToPack`
  - `removeItemFromPack`
- 已有 6 个 Inbox 状态转换测试并全部通过。
- `useSyncedTodos` 已提供串行、确认式的 `commitTodos` API。
- 功能开关开启时，AddPanel 和文件新增逻辑已经可以创建 Inbox 项目。
- 功能开关开启时，Canvas 使用 Library selector；旧数据兼容规则已经就位。

## 3. 尚未完成内容

### Inbox 产品功能

- 尚未实现截图中的 Inbox 按钮、数量和浮层 UI。
- 尚未把 Inbox 列表接到 `getInboxItems` / `getInboxCount`。
- 尚未实现 Inbox 搜索。
- 尚未实现 “Move to…” Pack 选择器。
- 尚未接入 Inbox → 空白 Canvas 拖动。
- 尚未接入 Inbox → Pack 拖动。
- 尚未实现操作失败后在 UI 中保留 Inbox 项目并显示错误。
- `DesktopApp` 当前只读取 `[tasks, setTasks]`；虽然 `commitTodos` 已实现，但 Inbox 移动操作还没有实际调用它。
- 尚未做开启 `VITE_INBOX_ENABLED=true` 后的完整端到端回归。

### 架构和测试

- `DesktopApp.jsx` 仍有 1411 行，尚未达到 600–900 行目标。
- Canvas geometry、碰撞和 group height 仍需补充更多单元测试。
- 未对真实云端数据执行 Pack 组合、移出 Pack、导出、分享等会改变数据或触发外部动作的完整自动化测试。
- Vite 仍有 bundle 大于 500 kB 的警告，可在功能稳定后处理，当前不是 Inbox 阻塞项。

## 4. 下一步推荐执行顺序

### Phase A：先补安全网

目标：在接 Inbox UI 前锁定现有行为。

1. 为 `canvasEntries.js`、`canvasGeometry.js` 和 `groupMetadata.js` 增加纯函数测试。
2. 为 `commitTodos` 增加测试：
   - 连续两个 mutation 必须串行执行。
   - 云端失败时 React state 和 localStorage 不变化。
   - 未登录时 localStorage 成功才算提交完成。
   - 失败后下一次提交仍能继续执行。
3. 补 Inbox selector 边界测试：空数组、旧数据、无效 `collectionState`、相同时间 ID。
4. 每次改动执行：

```bash
npm run test:logic
npm run build
```

完成条件：共享纯逻辑和确认式提交有稳定测试，现有 Canvas/Pack 没有视觉变化。

### Phase B：实现只读 Inbox UI

目标：先让用户能看见 Inbox，不立即加入拖拽复杂度。

1. 新建 `src/components/desktop/InboxPanel.jsx`。
2. 保持用户给出的 Inbox 浮层结构：顶部 Inbox 按钮、数量、搜索框、项目列表和 “Move to…” 按钮。
3. 不修改 Pack Full View 和现有 Search 设计。
4. 在 Desktop 装配层计算：

```js
const inboxItems = getInboxItems(tasks);
const inboxCount = getInboxCount(tasks);
```

5. Inbox item 卡片尽量复用现有 presentation/source helpers，但不要直接复用带 Canvas 拖拽语义的 TaskCard。
6. Inbox 搜索只过滤 Inbox，不影响全局 Search。
7. UI 仍置于 `VITE_INBOX_ENABLED` 后面；关闭时不渲染任何 Inbox DOM。

完成条件：开启开发开关后，新增文字/链接/图片/文档能出现在 Inbox；关闭开关时页面与当前基线一致。

### Phase C：接入确认式 Move 操作

目标：先实现按钮操作，再做拖动。

1. 将 Desktop 同步初始化改为：

```js
const [tasks, setTasks, commitTodos] = useSyncedTodos(...);
```

2. “Move to…” 提供两类目标：
   - 放到 Canvas，调用 `placeInboxItem`。
   - 放到现有 Pack，调用 `moveInboxItemToPack`。
3. 所有 Inbox → Library 状态转换必须通过 `commitTodos`，不能只调用普通 `setTasks`。
4. 提交期间禁用当前项目按钮，防止重复操作。
5. 成功后项目才从 Inbox 消失。
6. 失败时项目继续留在 Inbox，并显示明确 toast；不要乐观删除后再回滚。
7. 目标 Pack 在提交前消失时，显示错误，不得自动创建新 Pack。

完成条件：刷新页面后项目状态、Pack 归属和 Canvas 坐标保持一致；模拟云端失败时 UI 和持久化数据不变化。

### Phase D：实现 Inbox 拖放

目标：在按钮流程稳定后复用同一组 domain actions。

1. Inbox drag payload 只保存 item ID，不复制完整 task 对象作为事实来源。
2. 拖到 Canvas 空白区域：计算 Canvas 坐标后调用 `placeInboxItem`。
3. 拖到 Pack：只传目标 Pack ID，调用 `moveInboxItemToPack`。
4. 拖放提交仍必须使用 `commitTodos`。
5. 保留现有 Canvas task drag 状态机，不要把 Inbox drag 强行塞进 `useDesktopTaskDrag`；建议新增 `useInboxDrag`，最后在 drop adapter 层会合。
6. 拖动失败时清理 overlay，但不修改 Inbox 项目。
7. 验证缩放、平移后的坐标转换；不要直接使用屏幕坐标保存 Canvas 位置。

完成条件：在不同 Zoom/Pan 下拖到 Canvas 位置正确，拖到 Pack 后 Pack 元数据继承正确，没有闪烁或重复卡片。

### Phase E：开启前回归

依次验证：

1. `VITE_INBOX_ENABLED=false`：现有行为完全不变。
2. `VITE_INBOX_ENABLED=true`：
   - 文字、链接、图片、文档进入 Inbox。
   - Inbox 数量和搜索正确。
   - Move to Canvas 正常。
   - Move to Pack 正常。
   - Inbox 拖到 Canvas/Pack 正常。
   - Canvas 和全局 Search 不显示仍在 Inbox 的项目。
   - 刷新后状态保持。
   - 云端失败时项目留在 Inbox。
3. 回归独立卡片拖动、Pack 组合/移出、Pack Search、全局 Search、导出和分享。
4. 完成后才考虑在测试环境开启功能开关；生产环境另行决定。

### Phase F：后续架构收尾

Inbox 稳定后再进行：

1. 把 Header、编辑弹窗、图片预览和页面级 overlays 继续拆成组件。
2. 将剩余 selection 装配整理为 `useDesktopSelection`，但不要重复实现 viewport 内已有框选逻辑。
3. 将 `DesktopApp.jsx` 降到 600–900 行。
4. 评估 PackFullView 和 Desktop hooks 是否需要 Context；除非 props 已明显失控，否则不要为了行数引入全局 Context。
5. 最后处理 bundle code splitting 和全仓库历史 Lint。

## 5. 关键文件地图

- `src/pages/DesktopApp.jsx`：页面装配、功能开关、顶层状态。
- `src/lib/collectionState.js`：Inbox/Library 枚举和旧数据默认规则。
- `src/lib/inboxLogic.js`：Inbox selectors 和状态转换的唯一业务来源。
- `src/lib/inboxLogic.test.js`：当前 Inbox 领域测试。
- `src/lib/taskNormalize.js`：统一任务标准化入口。
- `src/todoSync.js`：`setTasks` 和确认式 `commitTodos`。
- `src/hooks/useDesktopUploads.js`：新增文字和上传资料的 Inbox 路由。
- `src/hooks/useDesktopTaskDrag.js`：现有 Canvas 拖拽状态机，不要随意改同步时序。
- `src/hooks/useDesktopViewport.js`：Zoom、Pan、框选和坐标转换。
- `src/components/desktop/PackFullView.jsx`：Pack 打开后的完整页面，当前视觉不要改。
- `src/components/desktop/DesktopCanvas.jsx`：Canvas 容器组合。
- `.env.example`：Inbox 功能开关默认值。
- `task.md`：本轮完成情况。
- `docs/inbox_refactor_review.md`：本轮基线、核验和兼容规则。

## 6. 不可破坏的约束

- 不重写 `DesktopApp.jsx`。
- 不修改 Pack Full View、全局 Search 和现有卡片设计。
- 不把日期或 Workspace 过滤重新塞回 `resolveDesktopCanvasEntries`。
- 不建立第二份 `normalizeTask` 或 Inbox 状态转换实现。
- Inbox 移动必须使用 `commitTodos`；普通编辑继续使用 `setTasks`。
- 不删除 `flushSync`，除非有等价的拖拽视觉回归证据。
- 不把旧数据默认成 Inbox。
- Inbox UI 完成前不启用生产功能开关。
- 每个阶段独立构建、独立回归、可以单独回退。

## 7. 建议提交顺序

1. `test: cover desktop geometry and confirmed commits`
2. `feat: add read-only desktop inbox panel`
3. `feat: move inbox items with confirmed commits`
4. `feat: add inbox drag adapters`
5. `test: cover inbox enabled end-to-end flows`
6. `refactor: finish desktop composition split`

不要把以上六个阶段压成一个提交。

## 8. 交接验收命令

```bash
npm install
npm run test:logic
npm run build
npm run dev
```

打开 `http://127.0.0.1:5173/`，先使用关闭开关的默认配置对照 `docs/screenshots/`，再只在本地开启 Inbox 进行开发。
