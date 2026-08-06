# Phase 7 Step 3 — Inbox drag handoff

## Completed behavior

- Dragging an Inbox item onto blank Canvas space calls `placeInboxItem`.
- Dragging an Inbox item onto an existing Pack calls `moveInboxItemToPack`.
- Both paths commit through `commitTodos`; React state and local storage update only after the confirmed write succeeds.
- A failed write leaves the item in Inbox and shows an error toast.
- Dropping outside the Canvas does not commit a change.
- The Inbox panel closes only after the pointer crosses the existing drag threshold.

## Architecture boundary

`useDesktopTaskDrag` exposes generic external-source callbacks:

```js
closeExternalDragSource
isExternalDragTask
onExternalDrop
```

The Canvas feature does not import Inbox logic. `DesktopApp.jsx` composes the two features and routes the confirmed transition.

The existing Canvas/Search drag state machine and its `flushSync` timing remain unchanged. External Inbox drops use their own branch before the existing Canvas mutation branch.

## Verification

- Changed-file ESLint: 0 errors. The drag hook still reports 18 previously recorded `react-hooks/exhaustive-deps` warnings.
- Logic tests: 129 passed, 0 failed.
- Production web build: passed.
- `VITE_INBOX_ENABLED=true`: Inbox button and empty panel verified in the signed-in local app; Canvas remained visible.
- `VITE_INBOX_ENABLED=false`: Inbox button hidden and Canvas remained visible.
- The local dev server was restored with the feature flag disabled.

## Remaining manual check

The signed-in account currently has zero Inbox items. No cloud test item was created, so a real pointer drag into blank Canvas and a real pointer drag into a Pack still need one disposable Inbox item when the owner is ready to test data mutation.
