# Phase 6 Search / Session 交接记录

更新时间：2026-08-06

## 当前结论

Phase 6 已按“最小迁移、保持行为”的原则完成。没有重写 Search、Profile、Canvas 或 Pack 的设计。

`DesktopApp.jsx` 已从 Phase 6 前的 1430 行降至约 1330 行。它仍未达到最终 600–900 行目标，后续应继续渐进拆分，禁止整体重写。

## 本阶段完成内容

- `src/features/session/`
  - `useDesktopSession` 负责登录会话、Profile 开关、用户资料、语言、外观偏好和退出登录。
  - `DesktopProfilePage` 保留原 DOM、className 和 UI 行为。
  - `index.js` 是 Session 的公开入口。
- `src/features/search/`
  - `useDesktopSearch` 负责 Search 开关和 Search → Canvas 拖动桥接。
  - `DesktopSearchModal` 保留原搜索、Pack 结果和任务结果行为。
  - `index.js` 是 Search 的公开入口。
- `useDesktopTaskActions`
  - 已移除退出登录和 Search 长按拖动职责。
  - 已删除迁移后不再使用的参数。
- 旧组件路径保留为兼容代理，避免 Mobile 或后续未迁移调用突然断裂。

## 恢复与稳定性修复

朋友之前执行的自动 AST 清理曾把 `DesktopApp.jsx` 扩大到约 5954 行，并重新带回已删除逻辑。本次已恢复到 Phase 6 前的 1430 行可靠版本，再重新做最小迁移。

浏览器回归另外发现并修复以下 Phase 4/5 遗留运行时问题：

- `groupMetadata.js` 缺少 `normalizeCardType`。
- `packItemSource.js` 缺少 `normalizeCardType` 和 `extractPrimaryUrl`。
- `TaskCards.jsx` 缺少 `OpenFullViewIcon`。
- `PackFullView.jsx` 缺少 `CARD_TYPES` 和 `normalizeCardType`。
- `packExport.js` 缺少 `normalizeCardType`。

这些错误不会被 Vite 构建发现，但在用户已有 Pack/卡片数据时会导致页面白屏。

## 验收结果

- `npm run test:logic`：127/127 通过。
- `npm run build`：通过；只保留现有的大 chunk 警告。
- Phase 6 及本次修复文件定向 ESLint：0 error。
- 登录环境手动回归：
  - 主画布和已有 Pack 正常渲染。
  - Profile 正常打开、关闭，语言和外观入口正常显示。
  - Search 正常打开、关闭并搜索任务/Pack。
  - Search 关闭后重新打开，查询内容正确清空。
  - 退出登录按钮存在，但为了保留交接用登录会话，没有实际点击退出。

## 下一步给朋友

1. 不要再运行 `scripts/clean_desktopapp.cjs`；该临时脚本已删除。
2. 先提交/备份当前稳定状态，再做任何下一阶段工作。
3. 下一阶段只做 Inbox UI 或继续缩小 Composition Root，二选一，不要混在同一次提交。
4. 如果继续缩小 `DesktopApp.jsx`，优先抽离 workspace header、edit modal 和页面级 selection 装配；不要修改 Canvas 拖动时序和 `flushSync`。
5. `VITE_INBOX_ENABLED` 继续保持 `false`，直到 InboxPanel、Move to 和 Inbox 拖动全部接线并通过端到端回归。

## 每次提交的最低验收

```text
npm run test:logic
npm run build
npx eslint <本次修改文件>
```

还需要登录环境检查主画布、Pack 打开、Search、Profile、AddPanel、卡片拖动以及刷新后位置保持。
