export const getCanvasDeletionSummary = (labels, tasks, selectedTaskIds) => {
  const selectedTaskIdSet = new Set(selectedTaskIds);
  const selectedTasks = tasks.filter((task) => selectedTaskIdSet.has(task.id));
  if (!selectedTasks.length) return null;

  const groupMembership = tasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());
  const selectedGroupCounts = selectedTasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());

  let packCount = 0;
  let looseItemCount = 0;
  selectedTasks.forEach((task) => {
    if (!task.desktopGroupId) {
      looseItemCount += 1;
      return;
    }
    if (selectedGroupCounts.get(task.desktopGroupId) === groupMembership.get(task.desktopGroupId)) {
      if (task.id === selectedTasks.find((item) => item.desktopGroupId === task.desktopGroupId)?.id) {
        packCount += 1;
      }
      return;
    }
    looseItemCount += 1;
  });

  let title = labels.deleteObjectQuestion || 'Delete selected objects?';
  if (packCount === 0) {
    title = looseItemCount === 1
      ? labels.deleteItemQuestion
      : labels.deleteMultipleItemsQuestion.replace('{count}', looseItemCount);
  } else if (looseItemCount === 0) {
    title = packCount === 1
      ? labels.deletePackQuestion
      : labels.deleteMultiplePacksQuestion.replace('{count}', packCount);
  } else {
    const itemLabel = (looseItemCount === 1 ? labels.itemLabel : labels.itemsLabel).replace('{count}', looseItemCount);
    const packLabel = (packCount === 1 ? labels.packLabel : labels.packsLabel).replace('{count}', packCount);
    title = labels.deleteItemsAndPacksQuestion.replace('{itemLabel}', itemLabel).replace('{packLabel}', packLabel);
  }

  return {
    title,
    packCount,
    looseItemCount,
    taskIds: selectedTasks.map((task) => task.id),
  };
};
