export const getLinkFaviconHostname = (url) => {
  if (typeof url !== 'string' || !url.trim()) return null;

  try {
    const value = url.trim();
    const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) return null;
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
};
