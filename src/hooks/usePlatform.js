import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const DESKTOP_BREAKPOINT_PX = 900;

export const getPlatformInfo = () => {
  const platform = Capacitor.getPlatform?.() || 'web';
  const isNativePlatform = Capacitor.isNativePlatform?.() || false;
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';
  const isDesktop = typeof window === 'undefined'
    ? true
    : window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`).matches;

  return {
    platform,
    isNativePlatform,
    isIOS,
    isAndroid,
    isDesktop,
  };
};

export const applyPlatformClass = (platform = getPlatformInfo().platform) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  Array.from(root.classList)
    .filter((className) => className.startsWith('platform-'))
    .forEach((className) => root.classList.remove(className));

  root.classList.add(`platform-${platform}`);
};

export default function usePlatform() {
  const [platformInfo, setPlatformInfo] = useState(() => getPlatformInfo());

  useEffect(() => {
    applyPlatformClass(platformInfo.platform);
  }, [platformInfo.platform]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const handleChange = () => {
      setPlatformInfo(getPlatformInfo());
    };

    handleChange();

    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  return platformInfo;
}
