export const getUserScopedStorageKey = (baseKey, userId) => (
  userId ? `${baseKey}:${encodeURIComponent(userId)}` : baseKey
);
