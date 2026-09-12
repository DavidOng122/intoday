import React, { useMemo, useState } from 'react';
import { getLinkFaviconHostname } from '../lib/linkFavicon';

// Shared website favicon with an explicit caller-provided fallback. This keeps
// every link surface consistent while retaining each view's current link icon.
const LinkFavicon = ({ url, fallback = null, size = 20, alt = '', className, style }) => {
  const hostname = useMemo(() => getLinkFaviconHostname(url), [url]);
  const faviconUrl = hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
    : null;
  const [failedUrl, setFailedUrl] = useState(null);

  if (!faviconUrl || failedUrl === faviconUrl) return fallback;

  return (
    <img
      src={faviconUrl}
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
      onError={() => setFailedUrl(faviconUrl)}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
};

export default LinkFavicon;
