export const getPackDisplayName = (tasks) => (
  tasks?.find((task) => typeof task.desktopGroupName === 'string' && task.desktopGroupName.trim())?.desktopGroupName.trim()
  || tasks?.find((task) => typeof task.text === 'string' && task.text.trim())?.text.trim()
  || 'Untitled group'
);

export const getDesktopGroupDisplayName = getPackDisplayName;

export const resolvePackMetadata = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      desktopGroupName: 'Untitled group',
      desktopGroupIcon: null,
      desktopGroupCover: null,
      desktopGroupTags: [],
      desktopGroupActiveDurationType: null,
      desktopGroupActiveFrom: null,
      desktopGroupActiveUntil: null,
      dateString: null,
    };
  }

  const desktopGroupName = getPackDisplayName(tasks);

  const desktopGroupIcon = tasks.find(
    (t) => t.desktopGroupIcon !== undefined && t.desktopGroupIcon !== null && t.desktopGroupIcon !== '',
  )?.desktopGroupIcon || null;

  const desktopGroupCover = tasks.find(
    (t) => t.desktopGroupCover !== undefined && t.desktopGroupCover !== null && t.desktopGroupCover !== '',
  )?.desktopGroupCover || null;

  const desktopGroupTags = tasks.find(
    (t) => Array.isArray(t.desktopGroupTags) && t.desktopGroupTags.length > 0,
  )?.desktopGroupTags || [];

  const desktopGroupActiveDurationType = tasks.find(
    (t) => t.desktopGroupActiveDurationType !== undefined && t.desktopGroupActiveDurationType !== null,
  )?.desktopGroupActiveDurationType || null;

  const desktopGroupActiveFrom = tasks.find(
    (t) => t.desktopGroupActiveFrom !== undefined && t.desktopGroupActiveFrom !== null,
  )?.desktopGroupActiveFrom || null;

  const desktopGroupActiveUntil = tasks.find(
    (t) => t.desktopGroupActiveUntil !== undefined && t.desktopGroupActiveUntil !== null,
  )?.desktopGroupActiveUntil || null;

  const dateString = tasks.find(
    (t) => typeof t.dateString === 'string' && t.dateString.trim(),
  )?.dateString || null;

  return {
    desktopGroupName,
    desktopGroupIcon,
    desktopGroupCover,
    desktopGroupTags,
    desktopGroupActiveDurationType,
    desktopGroupActiveFrom,
    desktopGroupActiveUntil,
    dateString,
  };
};
