const firstMatchingValue = (tasks, selector, predicate = Boolean) => {
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const value = selector(task);
    if (predicate(value)) return value;
  }
  return null;
};

export const getPackDisplayName = (tasks = []) => (
  firstMatchingValue(tasks, (task) => task?.desktopGroupName?.trim?.())
  || firstMatchingValue(tasks, (task) => task?.text?.trim?.())
  || 'Untitled group'
);

export const resolvePackMetadata = (tasks = []) => ({
  desktopGroupName: getPackDisplayName(tasks),
  desktopGroupIcon: firstMatchingValue(tasks, (task) => task?.desktopGroupIcon) || null,
  desktopGroupCover: firstMatchingValue(tasks, (task) => task?.desktopGroupCover) || null,
  desktopGroupTags: firstMatchingValue(
    tasks,
    (task) => task?.desktopGroupTags,
    (tags) => Array.isArray(tags) && tags.length > 0,
  ) || [],
  desktopGroupActiveDurationType: firstMatchingValue(tasks, (task) => task?.desktopGroupActiveDurationType) || null,
  desktopGroupActiveFrom: firstMatchingValue(tasks, (task) => task?.desktopGroupActiveFrom) || null,
  desktopGroupActiveUntil: firstMatchingValue(tasks, (task) => task?.desktopGroupActiveUntil) || null,
  dateString: firstMatchingValue(tasks, (task) => task?.dateString?.trim?.()) || null,
});
