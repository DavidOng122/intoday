# Phase 7 Step 2：Inbox Move to Pack 交接记录

更新时间：2026-08-06

## 已完成

- Inbox 项目的 `Move to...` 按钮已启用。
- 点击按钮会列出当前所有 Library Pack。
- Pack 列表由纯 selector `getInboxTargetPacks(tasks)` 生成，DesktopApp 不包含分组算法。
- 选择 Pack 后通过 `commitTodos` 调用 `moveInboxItemToPack`。
- 云端或本地确认成功后才更新 React state。
- 提交失败会抛出错误、显示提示，并保持项目仍在 Inbox。
- 成功后项目继承目标 Pack 的名称、图标、封面、标签、激活范围和画布位置。
- 未接入 Inbox 拖拽；Step 3 仍未开始。

## 修改范围

- `src/features/inbox/components/InboxPanel.jsx`
- `src/features/inbox/model/inboxLogic.js`
- `src/features/inbox/tests/inboxLogic.test.js`
- `src/features/inbox/index.js`
- `src/pages/DesktopApp.jsx`
- `src/styles/desktop.css`
- `task.md`

未修改 Canvas、Pack、Search、Capture 或同步层内部实现。DesktopApp 只取出已有的 `commitTodos` 并装配 Inbox 操作。

## 验收结果

- 定向 ESLint：0 error。
- `npm run test:logic`：129/129 通过。
- `npm run build:web`：成功。
- `VITE_INBOX_ENABLED=true`：登录环境中 Inbox 按钮与空状态 Panel 正常，无新增 ReferenceError。
- `VITE_INBOX_ENABLED=false`：已恢复默认开发服务器，Inbox 按钮隐藏，主画布正常。
- 当前正式账号 Inbox 数量为 0；为了不制造真实资料，没有执行一次真实的云端 Move to Pack。

## 后续限制

- 不要因为 Step 2 完成而开启生产 feature flag。
- Step 3 拖拽必须单独实现和提交。
- Step 3 必须复用现有 Canvas 坐标与命中逻辑，不复制拖拽 Hook，不移动 `flushSync`。
