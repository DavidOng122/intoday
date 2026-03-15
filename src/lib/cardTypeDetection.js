export const CARD_TYPES = Object.freeze({
  MUSIC: 'music',
  LINK: 'link',
  VIDEO: 'video',
  PODCAST: 'podcast',
  PLACE: 'place',
  TEXT: 'text',
  DOCUMENT: 'document',
  MEETING: 'meeting',
  SOCIAL: 'social',
  SHOPPING: 'shopping',
  FINANCIAL: 'financial',
});

export const LEGACY_CARD_TYPE_ALIASES = Object.freeze({
  map: CARD_TYPES.PLACE,
  plain: CARD_TYPES.TEXT,
});

const URL_EXTRACT_REGEX =
  /(?:https?:\/\/|[a-z][a-z\d+.-]*:\/\/|mailto:|tel:|sms:|geo:|maps:|spotify:|www\.)[^\s<>"']+/gi;

const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/;

const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'rtf', 'pages', 'key', 'numbers'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
const MUSIC_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'];

const FILE_EXTENSION_RULES = [
  { type: CARD_TYPES.DOCUMENT, extensions: DOCUMENT_EXTENSIONS },
  { type: CARD_TYPES.VIDEO, extensions: VIDEO_EXTENSIONS },
  { type: CARD_TYPES.MUSIC, extensions: MUSIC_EXTENSIONS },
];

const URL_RULES = [
  {
    type: CARD_TYPES.MEETING,
    protocols: ['zoommtg'],
    hosts: ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com', 'whereby.com', 'webex.com', 'gotomeeting.com', 'meet.jit.si'],
    pathPatterns: [/^\/(?:j|join|wc|meeting)\b/],
  },
  {
    type: CARD_TYPES.PLACE,
    protocols: ['geo', 'maps'],
    hosts: ['maps.google.com', 'maps.app.goo.gl', 'maps.apple.com', 'openstreetmap.org', 'bing.com'],
    hostPathPatterns: [
      { host: 'google.com', pattern: /^\/maps(?:\/|$)/ },
    ],
  },
  {
    type: CARD_TYPES.DOCUMENT,
    hosts: ['docs.google.com', 'drive.google.com', 'notion.so', 'dropbox.com', 'paper.dropbox.com'],
    hostPathPatterns: [
      { host: 'docs.google.com', pattern: /^\/(?:document|spreadsheets|presentation|forms|drawings)\// },
      { host: 'drive.google.com', pattern: /^\/file\// },
    ],
  },
  {
    type: CARD_TYPES.PODCAST,
    hosts: ['podcasts.apple.com', 'pca.st', 'pocketcasts.com', 'overcast.fm', 'castbox.fm'],
    hostPathPatterns: [
      { host: 'spotify.com', pattern: /^\/(?:show|episode)\// },
    ],
    rawPatterns: [/^spotify:(?:show|episode):/],
  },
  {
    type: CARD_TYPES.MUSIC,
    hosts: ['music.apple.com', 'music.youtube.com', 'soundcloud.com', 'bandcamp.com'],
    hostPathPatterns: [
      { host: 'spotify.com', pattern: /^\/(?:track|album|artist|playlist)\// },
    ],
    rawPatterns: [/^spotify:(?:track|album|artist|playlist):/],
  },
  {
    type: CARD_TYPES.VIDEO,
    hosts: ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'bilibili.com', 'loom.com', 'tiktok.com', 'twitch.tv'],
    hostPathPatterns: [
      { host: 'instagram.com', pattern: /^\/(?:reel|reels|tv)\// },
      { host: 'facebook.com', pattern: /^\/watch/ },
      { host: 'youtube.com', pattern: /^\/(?:watch|shorts|live)\b/ },
      { host: 'twitch.tv', pattern: /^\/(?:videos|[^/]+\/clip)\b/ },
    ],
  },
  {
    type: CARD_TYPES.SOCIAL,
    hosts: ['instagram.com', 'x.com', 'twitter.com', 'facebook.com', 'linkedin.com', 'threads.net', 'reddit.com', 'xiaohongshu.com', 'weibo.com'],
  },
  {
    type: CARD_TYPES.SHOPPING,
    hosts: ['amazon.com', 'amzn.to', 'ebay.com', 'walmart.com', 'etsy.com', 'aliexpress.com', 'taobao.com', 'tmall.com', 'jd.com', 'shop.app', 'temu.com'],
  },
  {
    type: CARD_TYPES.FINANCIAL,
    hosts: ['paypal.com', 'paypal.me', 'wise.com', 'stripe.com', 'venmo.com', 'cash.app', 'robinhood.com', 'coinbase.com', 'binance.com', 'tradingview.com'],
  },
];

const stripTrailingPunctuation = (value = '') => value.replace(TRAILING_PUNCTUATION_REGEX, '');

const normalizeUrlForParsing = (rawUrl = '') => {
  if (/^www\./i.test(rawUrl)) {
    return `https://${rawUrl}`;
  }
  return rawUrl;
};

const parseUrlCandidate = (rawUrl = '') => {
  const cleanedUrl = stripTrailingPunctuation(rawUrl.trim());
  const normalizedInput = normalizeUrlForParsing(cleanedUrl);

  try {
    const parsed = new URL(normalizedInput);
    return {
      raw: cleanedUrl,
      lower: cleanedUrl.toLowerCase(),
      protocol: parsed.protocol.replace(/:$/, '').toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
      pathname: parsed.pathname.toLowerCase(),
    };
  } catch {
    return {
      raw: cleanedUrl,
      lower: cleanedUrl.toLowerCase(),
      protocol: '',
      hostname: '',
      pathname: '',
    };
  }
};

const hostnameMatches = (hostname, expectedHost) =>
  hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);

const getUrlExtension = (pathname = '') => {
  const match = pathname.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : '';
};

const matchesFileExtensionRule = (candidate) => {
  const extension = getUrlExtension(candidate.pathname);

  if (!extension) return null;

  const matchedRule = FILE_EXTENSION_RULES.find((rule) => rule.extensions.includes(extension));
  return matchedRule ? matchedRule.type : null;
};

const matchesHostPathRule = (candidate, hostPathRules = []) =>
  hostPathRules.some(({ host, pattern }) =>
    hostnameMatches(candidate.hostname, host) && pattern.test(candidate.pathname));

const matchesUrlRule = (candidate, rule) => {
  if (rule.protocols?.includes(candidate.protocol)) {
    return true;
  }

  if (rule.hosts?.some((host) => hostnameMatches(candidate.hostname, host))) {
    return true;
  }

  if (matchesHostPathRule(candidate, rule.hostPathPatterns)) {
    return true;
  }

  if (rule.pathPatterns?.some((pattern) => pattern.test(candidate.pathname))) {
    return true;
  }

  if (rule.rawPatterns?.some((pattern) => pattern.test(candidate.lower))) {
    return true;
  }

  return false;
};

export const normalizeCardType = (cardType) => {
  const lowered = String(cardType || '').trim().toLowerCase();
  return LEGACY_CARD_TYPE_ALIASES[lowered] || lowered || CARD_TYPES.TEXT;
};

export const extractUrls = (text = '') =>
  Array.from(text.matchAll(URL_EXTRACT_REGEX), (match) => stripTrailingPunctuation(match[0])).filter(Boolean);

export const extractPrimaryUrl = (text = '') => extractUrls(text)[0] || null;

export const detectUrlType = (rawUrl = '') => {
  const candidate = parseUrlCandidate(rawUrl);

  if (!candidate.raw) {
    return CARD_TYPES.TEXT;
  }

  const extensionType = matchesFileExtensionRule(candidate);
  if (extensionType) {
    return extensionType;
  }

  const matchedRule = URL_RULES.find((rule) => matchesUrlRule(candidate, rule));
  return matchedRule ? matchedRule.type : CARD_TYPES.LINK;
};

export const detectCardType = (text = '') => {
  const primaryUrl = extractPrimaryUrl(text);
  if (!primaryUrl) {
    return CARD_TYPES.TEXT;
  }

  return detectUrlType(primaryUrl);
};

export const extractUrlForType = (text = '', cardType) => {
  const primaryUrl = extractPrimaryUrl(text);
  if (!primaryUrl) return null;

  const normalizedType = normalizeCardType(cardType);
  if (normalizedType === CARD_TYPES.LINK) {
    return primaryUrl;
  }

  return detectUrlType(primaryUrl) === normalizedType ? primaryUrl : null;
};

export const extractMeetingUrl = (text = '') => extractUrlForType(text, CARD_TYPES.MEETING);
export const extractVideoUrl = (text = '') => extractUrlForType(text, CARD_TYPES.VIDEO);
export const extractMapUrl = (text = '') => extractUrlForType(text, CARD_TYPES.PLACE);

export const getDerivedTaskFields = (text = '') => {
  const cardType = detectCardType(text);
  const primaryUrl = extractPrimaryUrl(text);

  return {
    cardType,
    videoUrl: cardType === CARD_TYPES.VIDEO ? primaryUrl : null,
    mapUrl: cardType === CARD_TYPES.PLACE ? primaryUrl : null,
    videoTitle: null,
    videoPlatform: null,
    mapTitle: null,
    mapSubtitle: null,
    redirectUrl: null,
  };
};

export const isTextCardType = (cardType) => normalizeCardType(cardType) === CARD_TYPES.TEXT;
