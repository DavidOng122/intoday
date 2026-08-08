let posthogClientPromise = null;

const loadPostHog = () => {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!apiKey) return Promise.resolve(null);

  if (!posthogClientPromise) {
    posthogClientPromise = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(apiKey, {
          api_host: import.meta.env.VITE_POSTHOG_HOST,
          person_profiles: 'identified_only',
        });
        return posthog;
      })
      .catch((error) => {
        console.warn('PostHog failed to load:', error);
        posthogClientPromise = null;
        return null;
      });
  }

  return posthogClientPromise;
};

export const initializePostHogWhenIdle = () => {
  if (typeof window === 'undefined' || !import.meta.env.VITE_POSTHOG_KEY) {
    return () => {};
  }

  const initialize = () => {
    void loadPostHog();
  };

  if ('requestIdleCallback' in window) {
    const callbackId = window.requestIdleCallback(initialize, { timeout: 2000 });
    return () => window.cancelIdleCallback(callbackId);
  }

  const timeoutId = window.setTimeout(initialize, 0);
  return () => window.clearTimeout(timeoutId);
};

export const identifyPostHogUser = async (user) => {
  if (!user?.id) return;
  const posthog = await loadPostHog();
  posthog?.identify(user.id, { email: user.email });
};

export const resetPostHogUser = async () => {
  const posthog = await loadPostHog();
  posthog?.reset();
};
