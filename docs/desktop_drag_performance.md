# Canvas Drag Performance Baseline & Optimization Report

## Baseline Performance Metrics & Bottlenecks

### Recorded Hotspots & Issues
1. **O(n) DOM Layout Thrashing on PointerMove**:
   During canvas dragging (`pointermove`), `getDesktopCanvasOverlapEntryFromDom` iterated over all canvas entries and called `document.getElementById('desktop-canvas-entry-...')` followed by `getBoundingClientRect()` on every candidate item per frame.
   - **Scripting & Layout Cost**: High layout recalculation overhead scaling with the number of canvas items ($O(n)$ per frame).
   - **Forced Reflows**: Interleaved DOM reads (`getBoundingClientRect`) during drag calculations forced synchronous layout passes.

2. **Redundant DOM Lookups**:
   - Re-fetching `getBoundingClientRect` for `bestMatch` after candidate iteration.
   - Calling `getDesktopCanvasOverlapEntryFromDom` twice during anti-flicker threshold comparisons.

---

## Optimization Strategy

1. **Extract Pure Collision Function (`findDesktopDragOverlap`)**:
   - Pure function taking `{ movingRect, candidates, movingTaskIds, threshold }` where `candidates` is an array of `{ entry, rect }`.
   - Free of DOM access, React state, and Ref dependencies.
   - Fully unit-tested.

2. **Target Card Rect Caching**:
   - Build target candidate rect cache once on drag start.
   - Invalidate cache on tasks change, viewport resize, or scroll events.
   - Pointer movement only measures the active moving item's position per frame; candidate rects are read from cache ($O(1)$ per candidate lookup).

3. **Preserve Compatibility & Safety**:
   - Keep existing `flushSync`, overlay snapshots, Pack threshold rules, flicker prevention, and CSS class names intact.
