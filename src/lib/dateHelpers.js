export const DAY_BOUNDARY_HOUR = 6;

export const getLogicalToday = (referenceDate = new Date()) => {
  const logicalDate = new Date(referenceDate);
  logicalDate.setHours(logicalDate.getHours() - DAY_BOUNDARY_HOUR);
  logicalDate.setHours(0, 0, 0, 0);
  return logicalDate;
};

export const getCurrentTimeBlock = (referenceDate = new Date()) => {
  const hour = referenceDate.getHours();

  if (hour >= 0 && hour < 6) return 'Midnight';
  if (hour >= 6 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  if (hour >= 18 && hour < 22) return 'Evening';
  return 'Night';
};
