# Desktop Feature-Based Architecture 完整交接文档

更新时间：2026-08-05  
适用范围：DesktopApp、Canvas、Pack、Inbox、Capture/AddPanel、Search

## 1. 交接摘要

后续架构正式采用：

> Feature-Based Architecture（按业务功能组织） + Composition Root（页面总装）

两者分工如下：

- Feature-Based Architecture 决定文件放在哪里、业务边界在哪里。
- Composition Root 决定 `DesktopApp.jsx` 只装配状态、功能和页面区域，不实现功能内部细节。

这不是一次重写。迁移必须逐个 feature 进行，每一步都能构建、回归和单独回退。

当前代码可运行，`DesktopApp.jsx` 已从 7246 行降到 1411 行。下一阶段是在保持行为不变的情况下，把已经拆出的散落组件、Hooks 和逻辑归档到业务模块，并继续完成 Inbox UI。

## 2. 当前 Inbox 的真实状态

### 已完成

- 已加入 `collectionState: 'inbox' | 'library'`。
- 旧资料缺少或带有无效状态时默认归入 `library`。
- 已完成 Inbox/Library selectors。
- 已完成以下纯状态转换：
  - 创建 Inbox 项目。
  - Inbox 放到空白 Canvas。
  - Inbox 放到现有 Pack。
  - 从 Pack 移出成为独立 Library 卡片。
- 已有 6 个 Inbox 单元测试，当前全部通过。
- `useSyncedTodos` 已实现串行确认式 `commitTodos`。
- Capture/上传逻辑在功能开关开启时可以创建 Inbox 项目。
- Canvas 在功能开关开启时只读取 Library 项目。

### 未完成

- Inbox 按钮、数量、浮层、列表和搜索 UI 尚未实现。
- “Move to…” 尚未实现。
- Inbox → Canvas、Inbox → Pack 拖动尚未接线。
- `DesktopApp` 尚未取出并使用 `commitTodos`；目前只使用 `[tasks, setTasks]`。
- 开关开启后的完整端到端回归尚未完成。

因此当前必须保持：

```env
VITE_INBOX_ENABLED=false
```

现在直接开启会导致新增项目进入 Inbox，但用户没有 UI 可以查看它们，看起来会像资料消失。

## 3. 架构原则

### 3.1 依赖方向

统一依赖方向：

```text
pages
  ↓
features
  ↓
entities
  ↓
shared
```

- `pages`：页面总装，只组合功能。
- `features`：用户能够感知的业务能力，例如 Inbox、Pack、Capture、Canvas。
- `entities`：跨 feature 使用的稳定业务实体，例如 Task、Pack 数据模型。
- `shared`：无业务归属的 UI、基础工具、i18n、analytics、日期等。

禁止反向依赖：

- `shared` 不得 import `entities`、`features` 或 `pages`。
- `entities` 不得 import `features` 或 `pages`。
- feature 不得 import `pages`。
- feature 之间不得穿透引用对方的 `components/`、`hooks/`、`model/` 内部文件。

### 3.2 Feature 公共出口

每个 feature 使用 `index.js` 暴露稳定 API：

```js
// src/features/inbox/index.js
export { InboxPanel } from './components/InboxPanel';
export { useInboxActions } from './hooks/useInboxActions';
export { getInboxItems, getInboxCount } from './model/inboxLogic';
```

外部只能这样引用：

```js
import { InboxPanel, getInboxItems } from '../features/inbox';
```

禁止：

```js
import InboxPanel from '../features/inbox/components/InboxPanel';
```

feature 自己内部可以使用相对路径访问自己的模块。

### 3.3 UI、Hook、Model 分层

一个 feature 内部按责任继续分层：

```text
feature-name/
├── components/   React UI
├── hooks/        React 状态和交互编排
├── model/        纯业务逻辑、selectors、状态转换
├── services/     存储、网络、浏览器能力
├── tests/        该 feature 的测试
└── index.js      公共出口
```

不是所有 feature 都必须创建全部文件夹。没有内容时不要创建空目录。

### 3.4 跨 Feature 协作

跨 feature 操作由页面总装或明确的 adapter 完成，不让两个 feature 相互控制内部状态。

例如 Inbox 拖到 Pack：

```text
InboxPanel
  → 发出 itemId + targetPackId
DesktopApp / desktop orchestrator
  → commitTodos(...)
Inbox domain action
  → moveInboxItemToPack(...)
Pack/Canvas
  → 从新的 tasks 自动重新渲染
```

Pack 不需要知道 Inbox 面板如何工作，Inbox 也不直接调用 Pack 内部 Hook。

## 4. 最终目标目录

```text
src/
├── app/
│   ├── providers/
│   └── config/
│       └── featureFlags.js
│
├── pages/
│   └── DesktopApp.jsx
│
├── features/
│   ├── inbox/
│   │   ├── components/
│   │   │   ├── InboxButton.jsx
│   │   │   ├── InboxPanel.jsx
│   │   │   └── InboxItemRow.jsx
│   │   ├── hooks/
│   │   │   ├── useInboxActions.js
│   │   │   └── useInboxDrag.js
│   │   ├── model/
│   │   │   ├── collectionState.js
│   │   │   └── inboxLogic.js
│   │   ├── tests/
│   │   │   └── inboxLogic.test.js
│   │   └── index.js
│   │
│   ├── capture/
│   │   ├── components/
│   │   │   └── AddPanel.jsx
│   │   ├── hooks/
│   │   │   └── useDesktopCapture.js
│   │   ├── services/
│   │   │   ├── uploadUtils.js
│   │   │   └── uploadedFileStorage.js
│   │   └── index.js
│   │
│   ├── canvas/
│   │   ├── components/
│   │   │   ├── DesktopCanvas.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   └── GroupedTaskCard.jsx
│   │   ├── hooks/
│   │   │   ├── useDesktopViewport.js
│   │   │   ├── useDesktopSelection.js
│   │   │   └── useDesktopTaskDrag.js
│   │   ├── model/
│   │   │   ├── canvasEntries.js
│   │   │   ├── canvasGeometry.js
│   │   │   └── canvasConstants.js
│   │   ├── tests/
│   │   │   ├── canvasEntries.test.js
│   │   │   └── canvasGeometry.test.js
│   │   └── index.js
│   │
│   ├── pack/
│   │   ├── components/
│   │   │   ├── PackFullView.jsx
│   │   │   ├── PackPrompt.jsx
│   │   │   └── PackHeader.jsx
│   │   ├── hooks/
│   │   │   └── usePackActions.js
│   │   ├── model/
│   │   │   ├── groupMetadata.js
│   │   │   ├── packMetadata.js
│   │   │   ├── packPageUtils.js
│   │   │   └── packItemSource.js
│   │   ├── services/
│   │   │   └── packExport.js
│   │   └── index.js
│   │
│   ├── search/
│   │   ├── components/
│   │   │   └── DesktopSearch.jsx
│   │   ├── hooks/
│   │   │   └── useDesktopSearch.js
│   │   └── index.js
│   │
│   └── session/
│       ├── hooks/
│       │   └── useDesktopSession.js
│       └── index.js
│
├── entities/
│   └── task/
│       ├── model/
│       │   ├── taskNormalize.js
│       │   ├── taskCardPresentation.js
│       │   └── taskParsers.js
│       ├── data/
│       │   └── useSyncedTodos.js
│       └── index.js
│
└── shared/
    ├── ui/
    │   ├── icons/
    │   ├── DeleteConfirmModal.jsx
    │   └── IntoDayLogo.jsx
    ├── lib/
    │   ├── analytics.js
    │   ├── dateUtils.js
    │   ├── domUtils.js
    │   └── language.js
    └── i18n/
        └── translations.js
```

说明：这是目标结构，不是要求一次创建并移动所有文件。最终目录可以根据实际依赖略作调整，但依赖方向不能破坏。

## 5. 当前文件迁移映射

| 当前文件 | 目标位置 | 处理方式 |
|---|---|---|
| `src/lib/collectionState.js` | `features/inbox/model/collectionState.js` | 原样迁移，保持唯一实现 |
| `src/lib/inboxLogic.js` | `features/inbox/model/inboxLogic.js` | 原样迁移，更新相对 import |
| `src/lib/inboxLogic.test.js` | `features/inbox/tests/inboxLogic.test.js` | 迁移后更新 test script glob |
| `src/components/desktop/AddPanel.jsx` | `features/capture/components/AddPanel.jsx` | 保持 DOM/className |
| `src/hooks/useDesktopUploads.js` | `features/capture/hooks/useDesktopCapture.js` | 迁移时可重命名，不改变行为 |
| `src/lib/uploadUtils.js` | `features/capture/services/uploadUtils.js` | 与上传行为一起迁移 |
| `src/lib/uploadedFileStorage.js` | `features/capture/services/uploadedFileStorage.js` | 与 Capture 服务一起迁移 |
| `src/components/desktop/DesktopCanvas.jsx` | `features/canvas/components/DesktopCanvas.jsx` | 保持 DOM/className |
| `src/components/desktop/TaskCards.jsx` | `features/canvas/components/TaskCard.jsx`、`GroupedTaskCard.jsx` | 第二步再拆文件，第一次只迁移 |
| `src/hooks/useDesktopViewport.js` | `features/canvas/hooks/useDesktopViewport.js` | 原有交互时序不变 |
| `src/hooks/useDesktopTaskDrag.js` | `features/canvas/hooks/useDesktopTaskDrag.js` | 必须保留 `flushSync` |
| `src/lib/canvasEntries.js` | `features/canvas/model/canvasEntries.js` | 纯函数，不感知 Inbox/日期/Workspace |
| `src/lib/canvasGeometry.js` | `features/canvas/model/canvasGeometry.js` | 先补测试再迁移 |
| `src/components/desktop/PackFullView.jsx` | `features/pack/components/PackFullView.jsx` | 不改现有设计 |
| `src/components/desktop/DesktopGroupPrompt.jsx` | `features/pack/components/PackPrompt.jsx` | 可重命名但保持 props 行为 |
| `src/lib/groupMetadata.js` | `features/pack/model/groupMetadata.js` | Pack 和 Canvas 通过 Pack 公共 API 使用 |
| `src/lib/packMetadata.js` | `features/pack/model/packMetadata.js` | 保持唯一实现 |
| `src/lib/packPageUtils.js` | `features/pack/model/packPageUtils.js` | 原样迁移优先 |
| `src/lib/packItemSource.js` | `features/pack/model/packItemSource.js` | 原样迁移优先 |
| `src/lib/packExport.js` | `features/pack/services/packExport.js` | 导出属于 Pack 外部能力 |
| `src/lib/taskNormalize.js` | `entities/task/model/taskNormalize.js` | 跨 feature 的 Task 实体逻辑 |
| `src/todoSync.js` | `entities/task/data/useSyncedTodos.js` | 保留 `setTasks`/`commitTodos` 双接口 |
| `src/taskCardUtils.js` | `entities/task/model/taskCardPresentation.js` | 先核对调用方，再拆 detection/presentation |
| `src/components/icons/DesktopIcons.jsx` | `shared/ui/icons/DesktopIcons.jsx` | 无业务状态，归 shared |
| `src/components/desktop/DesktopDeleteConfirmModal.jsx` | `shared/ui/DeleteConfirmModal.jsx` | 若仅 Desktop 使用，也可暂留原位 |
| `src/lib/translations.js` | `shared/i18n/translations.js` | 全局共享，不放 feature |
| `src/lib/analytics.js` | `shared/lib/analytics.js` | 全局共享 |

### 不应直接搬运的文件

`src/hooks/useDesktopTaskActions.js` 当前包含多个责任，不能整文件放进某一个 feature。应先拆成：

- `features/pack/hooks/usePackActions.js`
  - Pack metadata 更新。
  - Pack 打开/关闭。
  - Pack 项目操作。
- `features/canvas/hooks/useCanvasTaskActions.js`
  - 独立卡片选择、编辑、删除和打开。
- `features/session/hooks/useDesktopSession.js`
  - 登出、Profile/History 页面调度。
- 页面本地 orchestration
  - Workspace 名称装配。
  - feature 之间的回调连接。

拆分完成后再删除 `useDesktopTaskActions.js`，不要保留第二套实现。

## 6. DesktopApp 最终职责

`DesktopApp.jsx` 最终只允许包含：

- 用户、主题、语言和功能开关。
- `useSyncedTodos` 初始化。
- 顶层 Inbox/Library selectors。
- Feature Hooks 装配。
- Header、Canvas、Inbox、Search、Pack 和弹窗组合。
- 跨 feature 回调连接。

示意：

```jsx
const DesktopApp = () => {
  const session = useDesktopSession();
  const [tasks, setTasks, commitTodos] = useSyncedTodos(...);

  const inboxItems = inboxEnabled ? getInboxItems(tasks) : [];
  const libraryItems = inboxEnabled ? getLibraryItems(tasks) : tasks;

  const canvas = useDesktopCanvas({ tasks: libraryItems, setTasks });
  const inbox = useInboxActions({ tasks, commitTodos, canvas });
  const pack = usePackActions({ tasks: libraryItems, setTasks });

  return (
    <DesktopShell>
      <DesktopHeader />
      {inboxEnabled && <InboxPanel items={inboxItems} {...inbox.panelProps} />}
      <DesktopCanvas tasks={libraryItems} {...canvas.canvasProps} />
      <DesktopSearch tasks={libraryItems} />
      <PackFullView {...pack.fullViewProps} />
    </DesktopShell>
  );
};
```

这是边界示意，不要求照抄 Hook 返回结构。目标是让页面可以从上到下快速看懂，而不是把所有 props 隐藏进一个无边界的大对象。

目标行数：600–900 行。不要为了达到行数，把 JSX 整块搬进一个没有业务含义的 `DesktopAppContent.jsx`。

## 7. 迁移执行路线

### Phase 0：迁移前安全网

1. 保持 `VITE_INBOX_ENABLED=false`。
2. 补 Canvas entries/geometry 测试。
3. 补 `commitTodos` 串行、失败和 localStorage 测试。
4. 保存当前登录回归截图。
5. 确认 `npm run test:logic` 和 `npm run build` 通过。

完成条件：移动文件前已有足够测试判断 import 重排是否改变行为。

### Phase 1：建立骨架和规则

1. 建立 `features/`、`entities/`、`shared/`。
2. 只为准备迁移的第一个 feature 创建目录。
3. 添加该 feature 的 `index.js`。
4. 不一次创建完整空目录树。
5. 可在 ESLint 中增加 restricted imports，禁止 feature 穿透引用。

完成条件：骨架存在但运行行为不变。

### Phase 2：迁移 Inbox

Inbox 是最适合先迁移的 feature，因为逻辑集中且尚未发布 UI。

1. 移动 `collectionState`、`inboxLogic` 和测试。
2. 建立 `features/inbox/index.js`。
3. 更新 `taskNormalize`、DesktopApp 和 Capture 的 imports。
4. 更新 `test:logic`，确保新测试目录会运行。
5. 在新 feature 内实现只读 Inbox UI。
6. 接入 `commitTodos` 的 Move 操作。
7. 最后实现 `useInboxDrag`。

完成条件：Inbox 的 UI、Hook、model 均位于同一 feature，外部只通过公共出口使用。

### Phase 3：迁移 Capture

1. 移动 AddPanel、Capture Hook、upload utils 和 storage。
2. 重命名 `useDesktopUploads` 为 `useDesktopCapture` 时，只改名称，不同时改变行为。
3. Capture 通过回调或 Inbox 公共 action 创建资料。
4. Capture 不直接 import Inbox 内部 model 路径。

完成条件：文字、链接、图片、文档新增与转换行为不变。

### Phase 4：迁移 Pack

1. 先移动 Pack 纯逻辑和 export service。
2. 再移动 Prompt 和 Full View。
3. 从 `useDesktopTaskActions` 抽出 Pack actions。
4. Canvas 如果需要 Pack metadata，只从 `features/pack` 公共出口读取。
5. 不修改 Pack Full View、Pack Search、分享和导出设计。

完成条件：Pack 打开、编辑、Search、导出、分享以及组合/移出行为不变。

### Phase 5：迁移 Canvas

Canvas 风险最高，放在 Inbox、Capture、Pack 之后。

1. 移动 geometry/entries/constants。
2. 移动 DesktopCanvas 和 TaskCards。
3. 移动 viewport/selection/drag Hooks。
4. 保留 `flushSync` 和 overlay snapshot 时序。
5. 不在移动过程中重写拖拽算法。
6. 文件迁移稳定后，才把 `TaskCards.jsx` 拆为两个组件文件。

完成条件：Zoom、Pan、框选、独立卡片拖动、Pack 组合和移出均通过。

### Phase 6：Search、Session 与页面收口

1. 将 Search/History 中真正属于搜索的部分放入 `features/search`。
2. Profile、登录和退出放入 session/app 层，避免归入 Canvas。
3. 完成 `useDesktopTaskActions` 责任拆分并删除原文件。
4. 将 DesktopApp 降到 600–900 行。
5. 清理旧 `components/desktop`、`hooks` 和业务型 `lib` 残余。

完成条件：旧目录不再保留重复业务实现，DesktopApp 成为可读的总装页面。

## 8. 每次移动文件的标准操作

每个小批次只迁移一个内聚单元：

1. 用 `git status` 确认当前变更范围。
2. 移动文件，不改行为。
3. 更新模块内部相对 imports。
4. 添加/更新 feature `index.js`。
5. 更新外部 imports，使其只经过公共出口。
6. 使用 `rg` 搜索旧路径，确保无残余引用。
7. 运行 changed-file ESLint。
8. 运行逻辑测试和生产构建。
9. 手动验证相关 feature。
10. 独立提交。

禁止在同一个提交同时进行：

- 大量文件移动。
- Hook 行为重写。
- UI 改版。
- 数据模型迁移。

## 9. 测试策略

### Model 测试

- 不使用 React。
- 输入 tasks，断言完整输出和原数组未被修改。
- Inbox、Canvas、Pack 的纯函数测试跟随各自 feature。

### Hook 测试

- 重点验证状态时序、失败行为和重复提交。
- `commitTodos` 必须验证云端失败不更新本地状态。
- Drag Hook 必须验证 cleanup，不应只测 happy path。

### UI 回归

- DOM、className 和现有 CSS 保持不变。
- 对照 `docs/screenshots/`。
- Inbox 开关关闭和开启必须分别回归。

### 每阶段门禁

```bash
npm run test:logic
npm run build
```

并针对改动文件执行 ESLint。不要把全仓库历史 Lint 当成本轮文件移动失败，但不得引入新的 changed-file errors。

## 10. Inbox 下一步在新架构中的实现

### 第一步：只读 Panel

- `features/inbox/components/InboxButton.jsx`
- `features/inbox/components/InboxPanel.jsx`
- `features/inbox/components/InboxItemRow.jsx`
- 使用 `getInboxItems`、`getInboxCount`。
- 搜索只过滤 Inbox。
- 不修改现有全局 Search。

### 第二步：Move 按钮

DesktopApp 取出：

```js
const [tasks, setTasks, commitTodos] = useSyncedTodos(...);
```

新增 `useInboxActions`：

- Move to Canvas → `placeInboxItem`。
- Move to Pack → `moveInboxItemToPack`。
- 必须使用 `commitTodos`。
- 成功后才从 Inbox 消失。
- 失败时保留项目并显示 toast。

### 第三步：拖放

- 新增 `useInboxDrag`，不要塞入 Canvas 的 `useDesktopTaskDrag`。
- 拖动 payload 只保存 item ID。
- Drop adapter 负责把屏幕坐标转换为 Canvas 坐标。
- 最终仍调用与 Move 按钮相同的 `useInboxActions`。
- 不建立第二套 Inbox 状态转换。

## 11. 不可破坏的约束

- 不重写 DesktopApp。
- 不修改 Pack Full View、现有 Search 和卡片设计。
- 不恢复 Timeline 或多 Workspace 过滤。
- `resolveDesktopCanvasEntries` 不感知日期、Workspace、Inbox 或 feature flag。
- `normalizeTask` 只能有一个业务实现。
- 旧数据默认 Library。
- Inbox 移动必须使用 `commitTodos`。
- 普通编辑继续使用 `setTasks`。
- 不删除或延后拖拽 `flushSync`。
- feature 之间不穿透目录引用。
- 不为了缩短 DesktopApp 创建另一个无边界巨型组件。
- Inbox UI 完成前不启用生产开关。

## 12. 推荐提交顺序

1. `test: cover desktop geometry and confirmed commits`
2. `refactor: add feature architecture boundaries`
3. `refactor: move inbox domain behind public api`
4. `feat: add read-only inbox panel`
5. `feat: add confirmed inbox move actions`
6. `feat: add inbox drag adapters`
7. `refactor: move capture feature`
8. `refactor: move pack feature`
9. `refactor: move desktop canvas feature`
10. `refactor: split desktop task actions by feature`
11. `refactor: finish desktop composition root`

每个提交必须能独立构建。不要一次提交整棵目录迁移。

## 13. 交接启动步骤

朋友接手后先执行：

```bash
npm install
npm run test:logic
npm run build
npm run dev
```

然后：

1. 阅读本文档。
2. 阅读 `docs/inbox_refactor_review.md`。
3. 阅读 `docs/desktop_next_handoff_plan.md`。
4. 查看 `task.md` 当前勾选状态。
5. 保持 Inbox 功能开关关闭，先完成 Phase 0 测试安全网。
6. 从 Inbox feature 迁移开始，不要先移动 Canvas。

## 14. 完成定义

架构迁移只有同时满足以下条件才算完成：

- Inbox、Capture、Pack、Canvas、Search 各自拥有清晰 feature 边界。
- 外部只通过 feature `index.js` 使用公共 API。
- 没有同一业务逻辑的重复实现。
- DesktopApp 只做装配，保持 600–900 行。
- Inbox 开关开启和关闭均通过回归。
- Inbox 所有移动使用确认式提交。
- Pack、Search 和卡片视觉未发生非预期变化。
- `npm run test:logic` 和 `npm run build` 成功。
- 新增或移动文件没有 ESLint errors。
