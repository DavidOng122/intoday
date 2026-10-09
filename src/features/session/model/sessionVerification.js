export const notifySessionVerificationRequired = (error) => {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent('intoday:session-verification-required', {
    detail: {
      status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      message: error?.message || 'The account session could not be verified.',
    },
  }));
};
