# 下一步安全执行计划：Inbox UI

更新时间：2026-08-06
交接对象：下一位开发者 / AI 开发助手

## 0. 先读结论

当前稳定基线是 Phase 6 完成后的版本：

- `DesktopApp.jsx` 约 1330 行。
- Search、Session、Canvas、Capture、Pack 已按 feature 分流。
- Inbox 数据模型、selectors、状态转换和 feature flag 已存在。
- Inbox UI、Move to、Inbox 拖动尚未实现。
- `VITE_INBOX_ENABLED` 必须继续默认为 `false`。

下一步不要继续拆架构，也不要重写 `DesktopApp.jsx`。下一步只实现 **InboxPanel 的只读版本**：能够打开、关闭、显示数量、搜索和列出 Inbox 项目，但暂时不能移动或拖动。

## 1. 开工前必须完成的安全检查点

### 1.1 禁止直接开始改代码

先执行：

```powershell
git status --short
npm run test:logic
npm run build
```

预期结果：

- 逻辑测试为 127/127。
- 生产构建成功。
- 可以看到当前工作区有很多重构文件；不要假设这些文件都可以丢弃。

### 1.2 禁止使用的命令和方式

未经项目所有者明确许可，禁止：

```text
git reset --hard
git checkout -- <file>
git restore <file>
git clean -fd
Remove-Item -Recurse
整文件 AST 自动重写
正则脚本批量搬移 import
一次性覆盖 DesktopApp.jsx
```

不要重新创建 `scripts/clean_desktopapp.cjs`，不要使用自动脚本“清理”几千行 JSX。

### 1.3 建立可恢复检查点

先让项目所有者确认当前改动属于本次重构，再由项目所有者决定如何提交。不要擅自 `git add .`。

如果允许提交，推荐先创建一个只包含当前已核验重构的 checkpoint：

```text
chore: checkpoint stable desktop features through phase 6
```

如果不允许提交，至少先保存以下信息：

- `git status --short`
- `git diff --stat`
- `DesktopApp.jsx` 行数
- `npm run test:logic` 结果
- `npm run build` 结果

## 2. 第一项工作：只读 InboxPanel

### 2.1 本次允许实现的功能

只做以下内容：

1. Header 显示 Inbox 按钮和 Inbox 数量。
2. 点击按钮打开 InboxPanel。
3. Panel 支持关闭。
4. Panel 显示 `getInboxItems(tasks)` 的结果。
5. Panel 内搜索只过滤 Inbox 项目。
6. 空状态显示没有待整理内容。
7. Escape 和点击外层可以关闭 Panel。

本次明确不做：

- Move to Pack。
- 拖到 Canvas。
- 拖到 Pack。
- 从 Pack 移出。
- 新同步协议。
- 修改 Search、Pack、TaskCard 或 AddPanel 设计。
- 修改 InboxPanel 之外的视觉系统。

这样可以先确认数据确实进入 Inbox，而且不会在同一次修改中碰触高风险拖拽状态机。

### 2.2 建议新增文件

```text
src/features/inbox/
├── components/
│   └── InboxPanel.jsx
├── hooks/
│   └── useInboxPanel.js
└── index.js
```

职责必须清楚：

- `InboxPanel.jsx`：只负责渲染、搜索框和用户点击事件。
- `useInboxPanel.js`：只负责 `inboxOpen`、打开和关闭状态。
- `model/inboxLogic.js`：继续负责 selectors 和状态转换，不放 React 状态。
- `index.js`：对外公开 API；外部禁止穿透引用 `components/`、`hooks/` 或 `model/`。

公开入口应类似：

```js
export { default as InboxPanel } from './components/InboxPanel';
export { useInboxPanel } from './hooks/useInboxPanel';
export {
  getInboxCount,
  getInboxItems,
  getLibraryItems,
} from './model/inboxLogic';
```

### 2.3 DesktopApp 允许修改的范围

`DesktopApp.jsx` 只允许增加装配代码：

```js
import {
  getInboxCount,
  getInboxItems,
  InboxPanel,
  useInboxPanel,
} from '../features/inbox';
```

以及类似下面的 selector 和组合：

```js
const inboxItems = useMemo(() => getInboxItems(tasks), [tasks]);
const inboxCount = inboxItems.length;
const { inboxOpen, openInbox, closeInbox } = useInboxPanel();
```

最后把 Inbox 按钮和 Panel 组合到原有 Header / modal 区域。

禁止在 `DesktopApp.jsx` 内实现：

- Inbox 搜索算法。
- Inbox 行组件内部 JSX。
- Move to Pack 算法。
- 拖拽状态机。
- 新的数据标准化函数。

本小步完成后，`DesktopApp.jsx` 的净增加应尽量控制在 20–40 行。如果增加超过约 80 行，应停止并重新检查职责是否放错。

### 2.4 UI 约束

以用户提供的 Inbox 参考图为方向，但第一版优先保证结构和逻辑：

- 不改现有 Header、Search、Pack 和卡片 className。
- Panel 使用独立的 `desktop-inbox-*` className。
- 不复制 Search modal 的几百行 inline style。
- 不将 Panel 写进 `DesktopApp.jsx`。
- 不引入新的大型 UI 库。
- Inbox 项目显示标题、类型/来源和未来 `Move to...` 的预留位置即可。
- 本阶段的 `Move to...` 必须 disabled，或暂时不渲染。

## 3. Feature flag 的正确测试方法

仓库中的默认值必须保持：

```env
VITE_INBOX_ENABLED=false
```

本地测试 Inbox 时，在不提交的本地环境文件中临时设置：

```env
VITE_INBOX_ENABLED=true
```

测试结束后确认：

- `.env.example` 仍然是 `false`。
- 生产配置没有被打开。
- 功能关闭时 Header 不显示 Inbox，新增内容、Canvas 和 Search 行为与当前版本一致。

不要为了测试而把生产默认值改成 `true`。

## 4. 第一项工作的验收标准

### 4.1 自动验收

每次只改一个小点，然后执行：

```powershell
npx eslint src/features/inbox/components/InboxPanel.jsx src/features/inbox/hooks/useInboxPanel.js src/features/inbox/index.js src/pages/DesktopApp.jsx
npm run test:logic
npm run build
```

通过条件：

- changed-file ESLint 0 error。
- 逻辑测试继续 127/127，或增加 Inbox UI 测试后通过数量更高。
- 构建成功。
- 不新增 `ReferenceError`。

### 4.2 功能关闭回归

`VITE_INBOX_ENABLED=false`：

- Header 和当前体验不变。
- 新增文字、链接、图片和文件仍按当前方式显示。
- Canvas、Pack、Search 正常。
- 刷新后任务和位置保持。

### 4.3 功能开启回归

`VITE_INBOX_ENABLED=true`：

- 新增一条文字后，Canvas 不显示该条内容。
- Inbox 数量增加。
- 打开 Inbox 能看到该条内容。
- Inbox 搜索可以找到它。
- 关闭再打开 Panel 不报错。
- Search 只显示 Library，不显示 Inbox 内容。
- 刷新后 Inbox 内容仍存在。

### 4.4 立即停止条件

出现以下任一情况，停止继续开发并回到本小步起点检查：

- `DesktopApp.jsx` 突然增加数百行。
- Timeline 或多 workspace 代码重新出现。
- Search、Pack 或卡片视觉改变。
- 构建通过但浏览器白屏。
- 控制台出现新的 `ReferenceError`。
- Inbox 开关关闭时行为发生变化。
- 为了修一个 import 开始批量改几十个文件。

## 5. 第二项工作：Move to Pack（第一项验收后才能开始）

不要和只读 InboxPanel 放在同一个提交中。

开始前先确认 `useSyncedTodos` 的第三个返回值：

```js
const [tasks, setTasks, commitTodos] = useSyncedTodos(...);
```

Inbox 移动必须使用 `commitTodos`，不能先乐观地调用普通 `setTasks`：

```js
await commitTodos((currentTasks) => (
  moveInboxItemToPack(currentTasks, inboxTaskId, targetGroupId)
));
```

要求：

- 目标 Pack 不存在时显示失败提示。
- 提交失败时项目继续留在 Inbox。
- 成功后 Inbox 数量减少，目标 Pack 内容增加。
- 不在 UI 组件中复制 `moveInboxItemToPack` 逻辑。
- 单独提交，推荐信息：`feat: add confirmed inbox move to pack`。

## 6. 第三项工作：Inbox 拖动（最后做）

只有只读 Panel 和 Move to Pack 都通过后，才接 Inbox → Canvas / Pack 拖动。

这一步属于高风险交互：

- 复用现有 Canvas 坐标转换和 Pack 命中逻辑。
- 不复制 `useDesktopTaskDrag`。
- 不删除或移动 `flushSync`。
- 放到空白 Canvas 使用 `placeInboxItem`。
- 放到 Pack 使用 `moveInboxItemToPack`。
- 失败时保持 Inbox 原状态。
- 必须验证没有闪烁、重复卡片、跳位和幽灵 overlay。

推荐单独提交：

```text
feat: connect confirmed inbox drag placement
```

## 7. 给开发助手的可直接复制提示词

```text
请先阅读：
1. docs/phase6_search_session_handoff.md
2. docs/next_step_safe_inbox_ui_plan.md
3. task.md

本次只实现“只读 InboxPanel”，不要实现 Move to Pack 或任何拖拽。

硬性限制：
- 不重写 DesktopApp.jsx。
- 不运行 AST/正则批量重构脚本。
- 不使用 git reset、git restore、git checkout 覆盖工作区文件。
- 不修改 Pack、Search、TaskCard、AddPanel 的设计和 DOM。
- VITE_INBOX_ENABLED 默认保持 false。
- 新代码放在 src/features/inbox，通过 index.js 对外导出。
- DesktopApp 只能加入 feature 装配，净增加尽量不超过 40 行。

执行顺序：
1. 只读检查 git status、现有 Inbox API 和 DesktopApp 接线。
2. 写出将修改的精确文件清单，确认没有越界。
3. 新增 useInboxPanel。
4. 新增 InboxPanel。
5. 更新 inbox/index.js。
6. 最后才在 DesktopApp 接入按钮和 Panel。
7. 运行定向 ESLint、npm run test:logic、npm run build。
8. 分别在 feature flag false 和 true 下做浏览器回归。

如果发现必须修改任务同步、Canvas 拖动或 Pack 内部逻辑，请停止并报告原因，不要自行扩大范围。
```

## 8. 下一位开发者完成后必须汇报

汇报必须包含：

1. 实际修改文件清单。
2. `DesktopApp.jsx` 修改前后行数。
3. 是否修改任何 Search、Pack、Canvas 或 Capture 文件。
4. ESLint、测试、构建结果。
5. feature flag false / true 的手动回归结果。
6. 未完成项和已知风险。
7. 不得只回复“已完成”或“构建成功”。
