export const restoreCancelledPackMerge = (tasks, prompt, timestamp = Date.now()) => {
  if (
    prompt?.mode !== 'merge-packs'
    || !Array.isArray(prompt.movingTaskIds)
    || prompt.movingTaskIds.length === 0
    || !Number.isFinite(prompt.fallbackPosition?.x)
    || !Number.isFinite(prompt.fallbackPosition?.y)
  ) {
    return tasks;
  }

  const movingTaskIds = new Set(prompt.movingTaskIds);
  return tasks.map((task) => (
    movingTaskIds.has(task.id)
      ? {
        ...task,
        desktopCanvasX: Number(prompt.fallbackPosition.x.toFixed(1)),
        desktopCanvasY: Number(prompt.fallbackPosition.y.toFixed(1)),
        desktopZ: timestamp,
      }
      : task
  ));
};
