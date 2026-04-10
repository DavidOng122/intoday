const GOOGLE_FALLBACK_AVATAR = 'https://lh3.googleusercontent.com/a/default-user=s64-c';

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const firstIdentityData = (user) => {
  if (!Array.isArray(user?.identities)) return {};
  const googleIdentity = user.identities.find((identity) => identity?.provider === 'google');
  return googleIdentity?.identity_data || user.identities[0]?.identity_data || {};
};

export const getUserProfile = (user) => {
  const metadata = user?.user_metadata || {};
  const identityData = firstIdentityData(user);
  const email = firstText(user?.email, metadata.email, identityData.email);
  const fullName = firstText(
    metadata.full_name,
    metadata.name,
    identityData.full_name,
    identityData.name,
    email.split('@')[0],
    'User'
  );
  const avatarUrl = firstText(
    metadata.avatar_url,
    metadata.picture,
    identityData.avatar_url,
    identityData.picture,
    GOOGLE_FALLBACK_AVATAR
  );

  return {
    avatarUrl,
    fullName,
    email,
    initial: (fullName || email || 'U').trim().charAt(0).toUpperCase(),
  };
};
