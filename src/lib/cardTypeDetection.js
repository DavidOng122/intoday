export const CARD_TYPES = Object.freeze({
  PHOTO: 'photo',
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
  AI_TOOL: 'ai_tool',
});

export const LEGACY_CARD_TYPE_ALIASES = Object.freeze({
  map: CARD_TYPES.PLACE,
  plain: CARD_TYPES.TEXT,
});

const URL_EXTRACT_REGEX =
  /(?:https?:\/\/|[a-z][a-z\d+.-]*:\/\/|mailto:|tel:|sms:|geo:|maps:|spotify:|www\.)[^\s<>"']+/gi;

const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/;
const TRAILING_BRACKETS_QUOTES_REGEX = /[\]\}"'”’）】]+$/;

const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'rtf', 'pages', 'key', 'numbers'];
const PHOTO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
const MUSIC_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'];

const FILE_EXTENSION_RULES = [
  { type: CARD_TYPES.PHOTO, extensions: PHOTO_EXTENSIONS },
  { type: CARD_TYPES.DOCUMENT, extensions: DOCUMENT_EXTENSIONS },
  { type: CARD_TYPES.VIDEO, extensions: VIDEO_EXTENSIONS },
  { type: CARD_TYPES.MUSIC, extensions: MUSIC_EXTENSIONS },
];

const URL_RULES = [
  {
    type: CARD_TYPES.AI_TOOL,
    hosts: [
      'chatgpt.com',
      'openai.com',
      'gemini.google.com',
      'bard.google.com',
      'claude.ai',
      'perplexity.ai',
      'deepseek.com',
      'groq.com',
      'mistral.ai',
      'cohere.com',
    ],
  },
  {
    type: CARD_TYPES.MEETING,
    protocols: ['zoommtg'],
    hosts: [
      'meet.google.com',
      'zoom.us',
      'teams.microsoft.com',
      'teams.live.com',
      'whereby.com',
      'webex.com',
      'gotomeeting.com',
      'meet.jit.si',
      'calendar.google.com',
      'calendly.com',
    ],
    pathPatterns: [/^\/(?:j|join|wc|meeting)\b/],
    hostPathPatterns: [
      { host: 'zoom.us', pattern: /^\/(?:j|w|wc|my)\// },
      { host: 'calendar.google.com', pattern: /^\/calendar\/u\/\d+\/r\/eventedit/ },
      { host: 'calendly.com', pattern: /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/i },
    ],
  },
  {
    type: CARD_TYPES.PLACE,
    protocols: ['geo', 'maps'],
    hosts: [
      'maps.google.com',
      'maps.app.goo.gl',
      'maps.apple.com',
      'openstreetmap.org',
      'waze.com',
    ],
    hostPathPatterns: [
      { host: 'google.com', pattern: /^\/maps(?:\/|$)/ },
      { host: 'google.com', pattern: /^\/travel\// },
      { host: 'bing.com', pattern: /^\/maps(?:\/|$)/ },
      { host: 'apple.com', pattern: /^\/maps/ },
      { host: 'waze.com', pattern: /^\/ul/ },
    ],
  },
  {
    type: CARD_TYPES.DOCUMENT,
    hosts: [
      'docs.google.com',
      'drive.google.com',
      'notion.so',
      'notion.site',
      'dropbox.com',
      'paper.dropbox.com',
      'figma.com',
      'canva.com',
      'miro.com',
      'airtable.com',
    ],
    hostPathPatterns: [
      { host: 'docs.google.com', pattern: /^\/(?:document|spreadsheets|presentation|forms|drawings)\// },
      { host: 'drive.google.com', pattern: /^\/file\// },
      { host: 'drive.google.com', pattern: /^\/drive\/folders\// },
      { host: 'figma.com', pattern: /^\/(?:file|proto|board|design)\// },
      { host: 'canva.com', pattern: /^\/design\// },
      { host: 'miro.com', pattern: /^\/app\/board\// },
      { host: 'airtable.com', pattern: /^\/(?:app|tbl|shr)/ },
    ],
  },
  {
    type: CARD_TYPES.PODCAST,
    hosts: [
      'podcasts.apple.com',
      'pca.st',
      'pocketcasts.com',
      'overcast.fm',
      'castbox.fm',
      'podbean.com',
      'anchor.fm',
    ],
    hostPathPatterns: [
      { host: 'spotify.com', pattern: /^\/(?:show|episode)\// },
    ],
    rawPatterns: [/^spotify:(?:show|episode):/],
  },
  {
    type: CARD_TYPES.MUSIC,
    hosts: [
      'music.apple.com',
      'music.youtube.com',
      'soundcloud.com',
      'bandcamp.com',
      'deezer.com',
      'tidal.com',
    ],
    hostPathPatterns: [
      { host: 'spotify.com', pattern: /^\/(?:track|album|artist|playlist)\// },
    ],
    rawPatterns: [/^spotify:(?:track|album|artist|playlist):/],
  },
  {
    type: CARD_TYPES.VIDEO,
    hosts: [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'dailymotion.com',
      'bilibili.com',
      'loom.com',
      'tiktok.com',
      'twitch.tv',
      'vidyard.com',
      'wistia.com',
    ],
    hostPathPatterns: [
      { host: 'instagram.com', pattern: /^\/(?:reel|reels|tv)\// },
      { host: 'facebook.com', pattern: /^\/watch/ },
      { host: 'youtube.com', pattern: /^\/(?:watch|shorts|live|embed)\b/ },
      { host: 'twitch.tv', pattern: /^\/(?:videos|[^/]+\/clip)\b/ },
      { host: 'loom.com', pattern: /^\/share\// },
    ],
  },
  {
    type: CARD_TYPES.SOCIAL,
    hosts: [
      'instagram.com',
      'x.com',
      'twitter.com',
      'facebook.com',
      'linkedin.com',
      'threads.net',
      'reddit.com',
      'xiaohongshu.com',
      'weibo.com',
      'discord.com',
      'discord.gg',
      'telegram.me',
      't.me',
    ],
  },
  {
    type: CARD_TYPES.SHOPPING,
    hosts: [
      'amazon.com',
      'amzn.to',
      'ebay.com',
      'walmart.com',
      'etsy.com',
      'aliexpress.com',
      'taobao.com',
      'tmall.com',
      'jd.com',
      'shop.app',
      'temu.com',
      'shopee.com',
      'lazada.com',
    ],
  },
  {
    type: CARD_TYPES.FINANCIAL,
    hosts: [
      'paypal.com',
      'paypal.me',
      'wise.com',
      'stripe.com',
      'venmo.com',
      'cash.app',
      'robinhood.com',
      'coinbase.com',
      'binance.com',
      'tradingview.com',
      'kraken.com',
    ],
  },
];

const TYPE_PRIORITY = [
  CARD_TYPES.AI_TOOL,
  CARD_TYPES.MEETING,
  CARD_TYPES.PLACE,
  CARD_TYPES.DOCUMENT,
  CARD_TYPES.PHOTO,
  CARD_TYPES.VIDEO,
  CARD_TYPES.PODCAST,
  CARD_TYPES.MUSIC,
  CARD_TYPES.SHOPPING,
  CARD_TYPES.FINANCIAL,
  CARD_TYPES.SOCIAL,
  CARD_TYPES.LINK,
  CARD_TYPES.TEXT,
];

const KEYWORD_RULES = [
  {
    type: CARD_TYPES.MEETING,
    patterns: [
      /\bzoom\b/i,
      /\bgoogle meet\b/i,
      /\bmeet(?:ing)?\b/i,
      /\bteams\b/i,
      /\bcall\b/i,
      /\binterview\b/i,
      /\bsync\b/i,
      /\bstandup\b/i,
      /\b1:1\b/i,
    ],
  },
  {
    type: CARD_TYPES.DOCUMENT,
    patterns: [
      /\bpdf\b/i,
      /\bdoc\b/i,
      /\bdocs\b/i,
      /\bdocument\b/i,
      /\bslides\b/i,
      /\bpresentation\b/i,
      /\breport\b/i,
      /\bproposal\b/i,
      /\bdeck\b/i,
      /\bspreadsheet\b/i,
      /\bexcel\b/i,
      /\bnotion\b/i,
      /\bfigma\b/i,
      /\bmiro\b/i,
      /\bcanva\b/i,
      /\bsubmit\b/i,
      /\bdraft\b/i,
      /\breview\b/i,
    ],
  },
  {
    type: CARD_TYPES.PLACE,
    patterns: [
      /\baddress\b/i,
      /\blocation\b/i,
      /\bmap\b/i,
      /\bmaps\b/i,
      /\bcafe\b/i,
      /\brestaurant\b/i,
      /\bstation\b/i,
      /\broad\b/i,
      /\bstreet\b/i,
      /\bavenue\b/i,
      /\bmall\b/i,
      /\bhotel\b/i,
      /\bairport\b/i,
    ],
  },
  {
    type: CARD_TYPES.VIDEO,
    patterns: [
      /\byoutube\b/i,
      /\bvideo\b/i,
      /\breel\b/i,
      /\bwatch\b/i,
      /\bstream\b/i,
      /\bshorts\b/i,
      /\bloom\b/i,
      /\btiktok\b/i,
    ],
  },
  {
    type: CARD_TYPES.PODCAST,
    patterns: [
      /\bpodcast\b/i,
      /\bepisode\b/i,
      /\bshow\b/i,
    ],
  },
  {
    type: CARD_TYPES.MUSIC,
    patterns: [
      /\bmusic\b/i,
      /\bsong\b/i,
      /\balbum\b/i,
      /\bplaylist\b/i,
      /\bspotify\b/i,
      /\bsoundcloud\b/i,
    ],
  },
  {
    type: CARD_TYPES.SHOPPING,
    patterns: [
      /\bbuy\b/i,
      /\border\b/i,
      /\bshop\b/i,
      /\bshopping\b/i,
      /\bprice\b/i,
      /\bcheckout\b/i,
      /\bcart\b/i,
      /\bamazon\b/i,
      /\btaobao\b/i,
      /\bshopee\b/i,
    ],
  },
  {
    type: CARD_TYPES.FINANCIAL,
    patterns: [
      /\bpayment\b/i,
      /\bpay\b/i,
      /\binvoice\b/i,
      /\bbank\b/i,
      /\btransfer\b/i,
      /\bfinance\b/i,
      /\bstock\b/i,
      /\bcrypto\b/i,
      /\btrading\b/i,
    ],
  },
  {
    type: CARD_TYPES.SOCIAL,
    patterns: [
      /\binstagram\b/i,
      /\bx\.com\b/i,
      /\btwitter\b/i,
      /\bfacebook\b/i,
      /\blinkedin\b/i,
      /\breddit\b/i,
      /\bthreads\b/i,
      /\bdiscord\b/i,
      /\btelegram\b/i,
    ],
  },
];

const stripTrailingPunctuation = (value = '') =>
  value
    .replace(TRAILING_PUNCTUATION_REGEX, '')
    .replace(TRAILING_BRACKETS_QUOTES_REGEX, '');

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
      search: parsed.search.toLowerCase(),
      href: parsed.href,
    };
  } catch {
    return {
      raw: cleanedUrl,
      lower: cleanedUrl.toLowerCase(),
      protocol: '',
      hostname: '',
      pathname: '',
      search: '',
      href: cleanedUrl,
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

const rankTypes = (types = []) =>
  TYPE_PRIORITY.find((type) => types.includes(type)) || CARD_TYPES.TEXT;

const detectKeywordType = (text = '') => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return CARD_TYPES.TEXT;

  const matchedTypes = KEYWORD_RULES
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(normalizedText)))
    .map((rule) => rule.type);

  return rankTypes(matchedTypes);
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

export const detectCardTypeFromUrls = (urls = []) => {
  if (!urls.length) return CARD_TYPES.TEXT;

  const detectedTypes = urls.map(detectUrlType);
  return rankTypes(detectedTypes);
};

export const detectCardType = (text = '') => {
  const urls = extractUrls(text);

  if (urls.length > 0) {
    const urlDrivenType = detectCardTypeFromUrls(urls);
    if (urlDrivenType !== CARD_TYPES.TEXT) {
      return urlDrivenType;
    }
  }

  const keywordType = detectKeywordType(text);
  return keywordType || CARD_TYPES.TEXT;
};

export const extractUrlForType = (text = '', cardType) => {
  const normalizedType = normalizeCardType(cardType);
  const urls = extractUrls(text);

  if (!urls.length) return null;
  if (normalizedType === CARD_TYPES.LINK) return urls[0];

  return urls.find((url) => detectUrlType(url) === normalizedType) || null;
};

export const extractMeetingUrl = (text = '') => extractUrlForType(text, CARD_TYPES.MEETING);
export const extractVideoUrl = (text = '') => extractUrlForType(text, CARD_TYPES.VIDEO);
export const extractMapUrl = (text = '') => extractUrlForType(text, CARD_TYPES.PLACE);
export const extractDocumentUrl = (text = '') => extractUrlForType(text, CARD_TYPES.DOCUMENT);
export const extractMusicUrl = (text = '') => extractUrlForType(text, CARD_TYPES.MUSIC);
export const extractPodcastUrl = (text = '') => extractUrlForType(text, CARD_TYPES.PODCAST);
export const extractSocialUrl = (text = '') => extractUrlForType(text, CARD_TYPES.SOCIAL);
export const extractShoppingUrl = (text = '') => extractUrlForType(text, CARD_TYPES.SHOPPING);
export const extractFinancialUrl = (text = '') => extractUrlForType(text, CARD_TYPES.FINANCIAL);

export const getDerivedTaskFields = (text = '') => {
  const cardType = detectCardType(text);
  const urls = extractUrls(text);
  const primaryUrl = urls[0] || null;

  return {
    cardType,
    primaryUrl,
    videoUrl: extractVideoUrl(text),
    mapUrl: extractMapUrl(text),
    meetingUrl: extractMeetingUrl(text),
    documentUrl: extractDocumentUrl(text),
    musicUrl: extractMusicUrl(text),
    podcastUrl: extractPodcastUrl(text),
    socialUrl: extractSocialUrl(text),
    shoppingUrl: extractShoppingUrl(text),
    financialUrl: extractFinancialUrl(text),
    videoTitle: null,
    videoPlatform: null,
    mapTitle: null,
    mapSubtitle: null,
    redirectUrl: primaryUrl,
  };
};

export const isTextCardType = (cardType) => normalizeCardType(cardType) === CARD_TYPES.TEXT;
