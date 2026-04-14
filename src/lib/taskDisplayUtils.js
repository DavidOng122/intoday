import {
  CARD_TYPES,
  extractPrimaryUrl,
  extractUrls,
  normalizeCardType,
  detectUrlType,
} from './cardTypeDetection.js';

const GENERIC_TITLE_WORDS = new Set([
  'link',
  'video',
  'music',
  'podcast',
  'document',
  'doc',
  'docs',
  'meeting',
  'map',
  'maps',
  'google map',
  'google maps',
  'place',
  'location',
  'task',
  'item',
  'open this',
  'open',
  'chatgpt',
  'claude',
  'gemini',
  'perplexity',
  'openai',
  'ai tool',
  'conversation',
  'chat',
  'shared link',
  'chatgpt conversation',
  'claude conversation',
  'gemini conversation',
  'perplexity conversation',
]);

const MAX_DERIVED_TITLE_LENGTH = 96;

const cleanDisplayText = (value = '') => {
  return String(value || '')
    .replace(/\.(pdf|docx?|pptx?|xlsx?|txt|md|rtf)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`([{<]+|[\s"'`)\]}>]+$/g, '')
    .trim();
};

const toTitleCase = (value = '') =>
  cleanDisplayText(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

const isMeaningfulText = (value = '') => {
  const text = cleanDisplayText(value).toLowerCase();
  if (!text) return false;
  if (text.length < 2) return false;
  if (/^[\W_]+$/.test(text)) return false;
  if (GENERIC_TITLE_WORDS.has(text)) return false;
  return true;
};

const truncateDisplayTitle = (value = '') => {
  const text = cleanDisplayText(value);
  if (text.length <= MAX_DERIVED_TITLE_LENGTH) return text;
  return `${text.slice(0, MAX_DERIVED_TITLE_LENGTH - 1).trimEnd()}…`;
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripPlatformTitleNoise = (value = '', platformLabel = '') => {
  let text = cleanDisplayText(value);
  const platformCandidates = [
    platformLabel,
    'ChatGPT',
    'Claude',
    'Gemini',
    'Perplexity',
    'OpenAI',
    'AI Tool',
  ].filter(Boolean);

  platformCandidates.forEach((label) => {
    const escaped = escapeRegExp(label);
    text = text.replace(new RegExp(`^${escaped}\\s*[:\\-–|]\\s*`, 'i'), '');
    text = text.replace(new RegExp(`\\s*[:\\-–|]\\s*${escaped}$`, 'i'), '');
    text = text.replace(new RegExp(`^${escaped}\\s+(conversation|chat|shared link)\\s*[:\\-–|]?\\s*`, 'i'), '');
    text = text.replace(new RegExp(`^(conversation|chat|shared link)\\s+with\\s+${escaped}\\s*[:\\-–|]?\\s*`, 'i'), '');
  });

  return cleanDisplayText(text);
};

const getMeaningfulTitleFromContent = (value = '', platformLabel = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const lineCandidates = raw
    .split(/\r?\n+/)
    .map((line) => stripPlatformTitleNoise(stripUrls(line), platformLabel))
    .filter(Boolean);

  for (const line of lineCandidates) {
    if (isMeaningfulText(line)) {
      return truncateDisplayTitle(line);
    }
  }

  const sentenceCandidates = stripPlatformTitleNoise(stripUrls(raw), platformLabel)
    .split(/\s*(?:[.!?]\s+|[|•·]\s+)\s*/)
    .map((chunk) => cleanDisplayText(chunk))
    .filter(Boolean);

  for (const sentence of sentenceCandidates) {
    if (isMeaningfulText(sentence)) {
      return truncateDisplayTitle(sentence);
    }
  }

  const fallback = stripPlatformTitleNoise(stripUrls(raw), platformLabel);
  return isMeaningfulText(fallback) ? truncateDisplayTitle(fallback) : '';
};

const getTaskText = (task) => String(task?.text || task?.title || '');

const getPrimaryUrlForTask = (task) => {
  if (!task) return null;

  const cardType = normalizeCardType(task.cardType);
  const candidates = [];

  switch (cardType) {
    case CARD_TYPES.MEETING:
      candidates.push(task.meetingUrl, task.redirectUrl);
      break;
    case CARD_TYPES.VIDEO:
      candidates.push(task.videoUrl, task.redirectUrl);
      break;
    case CARD_TYPES.PLACE:
      candidates.push(task.mapUrl, task.redirectUrl);
      break;
    case CARD_TYPES.DOCUMENT:
      candidates.push(task.documentUrl, task.redirectUrl);
      break;
    case CARD_TYPES.PHOTO:
      candidates.push(task.photoUrl, task.redirectUrl);
      break;
    case CARD_TYPES.MUSIC:
      candidates.push(task.musicUrl, task.redirectUrl);
      break;
    case CARD_TYPES.PODCAST:
      candidates.push(task.podcastUrl, task.redirectUrl);
      break;
    case CARD_TYPES.SOCIAL:
      candidates.push(task.socialUrl, task.redirectUrl);
      break;
    case CARD_TYPES.SHOPPING:
      candidates.push(task.shoppingUrl, task.redirectUrl);
      break;
    case CARD_TYPES.FINANCIAL:
      candidates.push(task.financialUrl, task.redirectUrl);
      break;
    case CARD_TYPES.LINK:
      candidates.push(task.redirectUrl);
      break;
    default:
      break;
  }

  candidates.push(task.primaryUrl, extractPrimaryUrl(getTaskText(task)));

  return candidates.find(Boolean) || null;
};

const stripUrls = (text = '') => {
  let result = String(text || '');
  const urls = extractUrls(result);

  urls.forEach((url) => {
    result = result.split(url).join(' ');
  });

  return result.replace(/\s+/g, ' ').trim();
};

const stripMeetingNoise = (text = '') => {
  return String(text || '')
    .split(/\n|\u3000/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !extractUrls(line).length &&
        !/^開催日時/i.test(line) &&
        !/^開催方法/i.test(line) &&
        !/^date:/i.test(line) &&
        !/^time:/i.test(line) &&
        !/^method:/i.test(line) &&
        !/^meeting id:/i.test(line) &&
        !/^passcode:/i.test(line) &&
        !/^one tap mobile/i.test(line) &&
        !/^join by sip/i.test(line) &&
        !/^join instructions/i.test(line)
    )
    .join(' ')
    .replace(/\d{4}[/-]\d{1,2}[/-]\d{1,2}\s*\d{1,2}:\d{2}(?:\s*[APap][Mm])?\s*[~～-]?\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const parseReadableSlugFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const parts = pathname.split('/').filter(Boolean);

    if (!parts.length) return null;

    const last = parts[parts.length - 1];
    const cleaned = cleanDisplayText(last);

    if (!isMeaningfulText(cleaned)) return null;
    
    // Check if the original slug is just a long alphanumeric hash without dividers
    if (!/[-_\s]/.test(last) && /^[a-f0-9]{12,}$|^[a-z0-9]{20,}$/i.test(last)) return null;

    return toTitleCase(cleaned);
  } catch {
    return null;
  }
};

const parseFileNameFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const parts = pathname.split('/').filter(Boolean);

    if (!parts.length) return null;

    const fileName = cleanDisplayText(parts[parts.length - 1]);
    if (!isMeaningfulText(fileName)) return null;

    return toTitleCase(fileName);
  } catch {
    return null;
  }
};

const parseDocumentTitleFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname);

    if (host.includes('figma.com')) {
      const match = pathname.match(/\/(?:file|proto|board|design)\/[^/]+\/([^/?#]+)/i);
      if (match?.[1]) return toTitleCase(match[1]);
      return 'Figma File';
    }

    if (host.includes('notion.site') || host.includes('notion.so')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length) {
        const last = parts[parts.length - 1].replace(/[-]?[a-f0-9]{32}$/i, '');
        const cleaned = cleanDisplayText(last);
        if (isMeaningfulText(cleaned)) return toTitleCase(cleaned);
      }
      return 'Notion Page';
    }

    if (host.includes('docs.google.com')) {
      if (/\/document\//i.test(pathname)) return 'Google Doc';
      if (/\/spreadsheets\//i.test(pathname)) return 'Google Sheet';
      if (/\/presentation\//i.test(pathname)) return 'Google Slides';
      if (/\/forms\//i.test(pathname)) return 'Google Form';
      if (/\/drawings\//i.test(pathname)) return 'Google Drawing';
    }

    if (host.includes('drive.google.com')) {
      if (/\/file\//i.test(pathname)) return 'Google Drive File';
      if (/\/drive\/folders\//i.test(pathname)) return 'Google Drive Folder';
    }

    const fileName = parseFileNameFromUrl(url);
    if (fileName) return fileName;
  } catch {
    // ignore
  }

  return null;
};

export const parsePlaceFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const pathname = decodeURIComponent(parsed.pathname);

    const paramCandidates = [
      params.get('q'),
      params.get('query'),
      params.get('destination'),
      params.get('address'),
    ].filter(Boolean);

    for (const candidate of paramCandidates) {
      const cleaned = cleanDisplayText(candidate);
      if (isMeaningfulText(cleaned)) return toTitleCase(cleaned);
    }

    const placeMatch =
      pathname.match(/\/maps\/place\/([^/@?#]+)/i) ||
      pathname.match(/\/maps\/search\/([^/?#]+)/i) ||
      pathname.match(/\/place\/([^/@?#]+)/i);

    if (placeMatch?.[1]) {
      const cleaned = cleanDisplayText(placeMatch[1]);
      if (isMeaningfulText(cleaned)) return toTitleCase(cleaned);
    }
  } catch {
    // ignore malformed URLs
  }

  return null;
};

const getUrlPlatformLabel = (url, cardType) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'ChatGPT';
    if (host.includes('gemini.google.com') || host.includes('bard.google.com')) return 'Gemini';
    if (host.includes('claude.ai')) return 'Claude';
    if (host.includes('perplexity.ai')) return 'Perplexity';

    if (
      host.includes('maps.google.com') ||
      host === 'maps.app.goo.gl' ||
      (host.includes('google.com') && path.startsWith('/maps'))
    ) {
      return 'Google Maps';
    }

    if (host.includes('maps.apple.com')) return 'Apple Maps';
    if (host.includes('waze.com')) return 'Waze';

    if (host.includes('meet.google.com')) return 'Google Meet';
    if (host.includes('zoom.us')) return 'Zoom Meeting';
    if (host.includes('teams.microsoft.com') || host.includes('teams.live.com')) return 'Microsoft Teams';
    if (host.includes('whereby.com')) return 'Whereby';
    if (host.includes('webex.com')) return 'Webex';
    if (host.includes('calendly.com')) return 'Calendly';

    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube Video';
    if (host.includes('vimeo.com')) return 'Vimeo Video';
    if (host.includes('tiktok.com')) return 'TikTok Video';
    if (host.includes('loom.com')) return 'Loom Video';
    if (host.includes('twitch.tv')) return 'Twitch Video';

    if (host.includes('spotify.com')) {
      if (path.includes('/track/')) return 'Spotify Track';
      if (path.includes('/album/')) return 'Spotify Album';
      if (path.includes('/playlist/')) return 'Spotify Playlist';
      if (path.includes('/show/') || path.includes('/episode/')) return 'Podcast Episode';
      return 'Spotify';
    }

    if (host.includes('music.apple.com')) return 'Apple Music';
    if (host.includes('podcasts.apple.com')) return 'Apple Podcast';
    if (host.includes('soundcloud.com')) return 'SoundCloud Track';
    if (host.includes('bandcamp.com')) return 'Bandcamp Music';

    if (host.includes('docs.google.com')) {
      if (path.includes('/document/')) return 'Google Docs';
      if (path.includes('/spreadsheets/')) return 'Google Sheets';
      if (path.includes('/presentation/')) return 'Google Slides';
      if (path.includes('/forms/')) return 'Google Forms';
      return 'Google Document';
    }

    if (host.includes('drive.google.com')) return 'Google Drive';
    if (host.includes('figma.com')) return 'Figma File';
    if (host.includes('notion.site') || host.includes('notion.so')) return 'Notion Page';
    if (host.includes('miro.com')) return 'Miro Board';
    if (host.includes('canva.com')) return 'Canva Design';

    if (host.includes('instagram.com')) {
      if (/\/(?:reel|reels|tv)\//i.test(path)) return 'Instagram Reel';
      if (/\/p\//i.test(path)) return 'Instagram Post';
      return 'Instagram Profile';
    }

    if (host.includes('x.com') || host.includes('twitter.com')) {
      if (/\/status\//i.test(path)) return 'X Post';
      return 'X Profile';
    }

    if (host.includes('facebook.com')) {
      if (path.startsWith('/watch')) return 'Facebook Video';
      return 'Facebook Page';
    }

    if (host.includes('reddit.com')) return 'Reddit Thread';
    if (host.includes('linkedin.com')) return 'LinkedIn Post';
    if (host.includes('threads.net')) return 'Threads Post';
    if (host.includes('discord.gg') || host.includes('discord.com')) return 'Discord Invite';
    if (host.includes('t.me') || host.includes('telegram.me')) return 'Telegram Link';

    if (host.includes('amazon.')) return 'Amazon Item';
    if (host.includes('shopee.')) return 'Shopee Product';
    if (host.includes('lazada.')) return 'Lazada Product';
    if (host.includes('etsy.com')) return 'Etsy Item';
    if (host.includes('taobao.com')) return 'Taobao Item';
    if (host.includes('tmall.com')) return 'Tmall Product';

    if (host.includes('paypal.me') || host.includes('paypal.com')) return 'PayPal Link';
    if (host.includes('wise.com')) return 'Wise Transfer';
    if (host.includes('stripe.com')) return 'Stripe Payment';
    if (host.includes('tradingview.com')) return 'TradingView Chart';
    if (host.includes('coinbase.com')) return 'Coinbase';
    if (host.includes('binance.com')) return 'Binance';

    if (cardType === CARD_TYPES.DOCUMENT) return 'Document';
    if (cardType === CARD_TYPES.VIDEO) return 'Video';
    if (cardType === CARD_TYPES.MUSIC) return 'Music';
    if (cardType === CARD_TYPES.PODCAST) return 'Podcast';
    if (cardType === CARD_TYPES.PLACE) return 'Location';
    if (cardType === CARD_TYPES.MEETING) return 'Meeting';
    if (cardType === CARD_TYPES.SOCIAL) return 'Social Link';
    if (cardType === CARD_TYPES.SHOPPING) return 'Shopping Item';
    if (cardType === CARD_TYPES.FINANCIAL) return 'Financial Link';
    if (cardType === CARD_TYPES.LINK) return 'Link';
  } catch {
    // ignore malformed URL
  }

  return null;
};

const getTypeFallbackTitle = (cardType, primaryUrl) => {
  const platform = getUrlPlatformLabel(primaryUrl, cardType);
  if (platform && cardType === CARD_TYPES.AI_TOOL) return `Untitled ${platform} conversation`;
  if (platform) return platform;

  switch (cardType) {
    case CARD_TYPES.PLACE:
      return 'Location';
    case CARD_TYPES.MEETING:
      return 'Meeting';
    case CARD_TYPES.DOCUMENT:
      return 'Document';
    case CARD_TYPES.PHOTO:
      return 'Photo';
    case CARD_TYPES.VIDEO:
      return 'Video';
    case CARD_TYPES.MUSIC:
      return 'Music';
    case CARD_TYPES.PODCAST:
      return 'Podcast';
    case CARD_TYPES.SOCIAL:
      return 'Social Link';
    case CARD_TYPES.SHOPPING:
      return 'Shopping Item';
    case CARD_TYPES.FINANCIAL:
      return 'Financial Link';
    case CARD_TYPES.AI_TOOL:
      return 'AI Tool';
    case CARD_TYPES.LINK:
      return 'Link';
    default:
      return 'Task';
  }
};

const textAlreadyContainsTime = (title = '') =>
  /\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?|\d{1,2}\s*[APap][Mm])\b/.test(title);

const normalizeSubtitleLabel = (label = '') => {
  if (!label) return '';
  return cleanDisplayText(label);
};

const labelsForType = (cardType, labels = {}) => {
  return (
    labels[cardType] ||
    {
      [CARD_TYPES.TEXT]: 'Text',
      [CARD_TYPES.PHOTO]: 'Photo',
      [CARD_TYPES.MEETING]: 'Meeting',
      [CARD_TYPES.DOCUMENT]: 'Document',
      [CARD_TYPES.VIDEO]: 'Video',
      [CARD_TYPES.MUSIC]: 'Music',
      [CARD_TYPES.PODCAST]: 'Podcast',
      [CARD_TYPES.PLACE]: 'Place',
      [CARD_TYPES.SOCIAL]: 'Social',
      [CARD_TYPES.SHOPPING]: 'Shopping',
      [CARD_TYPES.FINANCIAL]: 'Financial',
      [CARD_TYPES.LINK]: 'Link',
      [CARD_TYPES.AI_TOOL]: 'AI Tool',
    }[cardType] ||
    'Task'
  );
};

export const deriveTaskDisplayTitle = (task) => {
  if (!task) return '';
  
  // Use backend resolution for AI conversation links directly to prevent re-guess logic
  if (task.aiPlatform && task.linkTitle) {
    return task.linkTitle;
  }

  const rawText = getTaskText(task);
  const cardType = normalizeCardType(task.cardType);
  const processedText = cardType === CARD_TYPES.MEETING ? stripMeetingNoise(rawText) : rawText;
  const primaryUrl = getPrimaryUrlForTask(task);
  const derivedCardType = normalizeCardType(task.cardType || (primaryUrl ? detectUrlType(primaryUrl) : CARD_TYPES.TEXT));
  const platformLabel = getUrlPlatformLabel(primaryUrl, derivedCardType);
  const explicitTitle = getMeaningfulTitleFromContent(task?.title, platformLabel);
  if (explicitTitle) {
    return explicitTitle;
  }

  if (isMeaningfulText(task.linkTitle)) {
    const linkTitle = stripPlatformTitleNoise(task.linkTitle, platformLabel);
    if (isMeaningfulText(linkTitle)) {
      return truncateDisplayTitle(linkTitle);
    }
  }

  const contentTitle = getMeaningfulTitleFromContent(processedText, platformLabel);
  if (contentTitle) {
    return contentTitle;
  }

  if (derivedCardType === CARD_TYPES.PLACE) {
    const placeTitle = task.mapTitle || parsePlaceFromUrl(primaryUrl);
    if (isMeaningfulText(placeTitle)) return placeTitle;
  }

  if (derivedCardType === CARD_TYPES.DOCUMENT) {
    const documentTitle = parseDocumentTitleFromUrl(primaryUrl);
    if (isMeaningfulText(documentTitle)) return documentTitle;
  }

  if (derivedCardType === CARD_TYPES.PHOTO) {
    const photoTitle = task.photoTitle || task.photoFileName || task.title;
    if (isMeaningfulText(photoTitle)) return cleanDisplayText(photoTitle);
  }

  if (derivedCardType === CARD_TYPES.VIDEO && isMeaningfulText(task.videoTitle)) {
    return cleanDisplayText(task.videoTitle);
  }
  if (
    (derivedCardType === CARD_TYPES.MUSIC || derivedCardType === CARD_TYPES.PODCAST) &&
    isMeaningfulText(task.musicTitle)
  ) {
    return cleanDisplayText(task.musicTitle);
  }
  if (derivedCardType === CARD_TYPES.MUSIC || derivedCardType === CARD_TYPES.PODCAST) {
    const slug = parseReadableSlugFromUrl(primaryUrl);
    if (isMeaningfulText(slug)) return slug;
  }

  if (
    derivedCardType === CARD_TYPES.SOCIAL ||
    derivedCardType === CARD_TYPES.SHOPPING ||
    derivedCardType === CARD_TYPES.FINANCIAL ||
    derivedCardType === CARD_TYPES.AI_TOOL ||
    derivedCardType === CARD_TYPES.LINK
  ) {
    const slug = parseReadableSlugFromUrl(primaryUrl);
    if (isMeaningfulText(slug)) return slug;
  }

  // Final fallback to the fetched linkTitle if one exists, even if we missed the types above
  if (isMeaningfulText(task.linkTitle)) {
    return truncateDisplayTitle(stripPlatformTitleNoise(task.linkTitle, platformLabel));
  }

  return getTypeFallbackTitle(derivedCardType, primaryUrl);
};

export const deriveTaskDisplaySubtitle = (task, labels = {}) => {
  if (!task) return '';

  const cardType = normalizeCardType(task.cardType);
  const primaryUrl = getPrimaryUrlForTask(task);
  const title = deriveTaskDisplayTitle(task);
  const uploadedSourceLabel = normalizeSubtitleLabel(task.uploadedSourceLabel);

  if (cardType === CARD_TYPES.TEXT) {
    return labels.actionItem || labelsForType(CARD_TYPES.TEXT, labels);
  }

  if (uploadedSourceLabel && uploadedSourceLabel.toLowerCase() !== title.toLowerCase()) {
    return uploadedSourceLabel;
  }

  if (cardType === CARD_TYPES.PHOTO) {
    return labelsForType(cardType, labels);
  }

  if (cardType === CARD_TYPES.MEETING) {
    const timeMatch = (task.text || '').match(
      /\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?|\d{1,2}\s*[APap][Mm])\b/
    );

    if (timeMatch && !textAlreadyContainsTime(title)) {
      return timeMatch[1].trim();
    }

    const platform = normalizeSubtitleLabel(task.meetingPlatform || getUrlPlatformLabel(primaryUrl, cardType));
    if (platform && platform.toLowerCase() !== title.toLowerCase()) return platform;

    return labelsForType(cardType, labels);
  }

  if (cardType === CARD_TYPES.VIDEO) {
    const platform = normalizeSubtitleLabel(task.videoPlatform || getUrlPlatformLabel(primaryUrl, cardType));
    if (platform && platform.toLowerCase() !== title.toLowerCase()) return platform;
    return labelsForType(cardType, labels);
  }

  if (cardType === CARD_TYPES.PLACE) {
    const platform = normalizeSubtitleLabel(task.mapSubtitle || getUrlPlatformLabel(primaryUrl, cardType));
    if (platform && platform.toLowerCase() !== title.toLowerCase()) return platform;
    return labelsForType(cardType, labels);
  }

  let platform = normalizeSubtitleLabel(getUrlPlatformLabel(primaryUrl, cardType));
  
  if (!platform && task.aiPlatform) {
    if (task.aiPlatform === 'chatgpt') platform = 'ChatGPT';
    else if (task.aiPlatform === 'claude') platform = 'Claude';
    else if (task.aiPlatform === 'gemini') platform = 'Gemini';
  }

  if (platform && platform.toLowerCase() !== title.toLowerCase()) {
    return platform;
  }

  return labelsForType(cardType, labels);
};
