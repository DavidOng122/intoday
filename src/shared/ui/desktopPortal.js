export const getDesktopPortalContainer = () => {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector('.desktop-app') || undefined;
};
