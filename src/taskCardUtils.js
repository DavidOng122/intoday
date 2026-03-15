export const cardTypeConfig = {
  meeting: {
    icon: '/video.png',
    bg: '#DCEAFB',
    darkBg: '#276F94B3',
    darkStroke: '#7698C2',
  },
  map: {
    icon: '/map.png',
    bg: '#A9F1A2',
    darkBg: '#437A3FB3',
    darkStroke: '#64C15E',
  },
  document: {
    icon: '/document01.png',
    bg: '#E7CFFF',
    darkBg: '#57307EB3',
    darkStroke: '#715A87',
  },
  video: {
    icon: '/play.png',
    bg: '#FFD9D9',
    darkBg: '#5C2727B3',
    darkStroke: '#4D2727',
  },
  plain: {
    icon: '/text.png',
    bg: '#FFE5B9',
    darkBg: '#8B622AB3',
    darkStroke: '#BF8A30',
  },
};

const MEETING_URL_REGEX =
  /https?:\/\/([\w-]+\.)*(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|webex\.com|gotomeeting\.com|meet\.jit\.si)\S*/i;

const VIDEO_URL_REGEX =
  /https?:\/\/([\w-]+\.)*(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)\S*/i;

const MAP_URL_REGEX =
  /https?:\/\/([\w-]+\.)*(google\.com\/maps|maps\.app\.goo\.gl)\S*/i;

const TIME_REGEX =
  /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/i;

const MEETING_WORD_REGEX =
  /\b(meeting|interview|call|sync|standup|stand-up|catch up|catchup|briefing|session|zoom|teams|google meet|webinar|オンライン)\b/i;

const MAP_WORD_REGEX =
  /\b(address|jalan|street|avenue|blvd|road|mall|plaza|restaurant|café|cafe|mcdonald|kfc|starbucks|sunway|pavilion|mid valley)\b/i;

const DOCUMENT_WORD_REGEX =
  /\b(pdf|slides?|document|doc|submit|submission|export|report|file|spreadsheet|excel|powerpoint|proposal|revise|revision|review|draft|send|finale?)\b/i;

export const detectCardType = (text = '') => {
  const normalizedText = text.toLowerCase();

  if (MEETING_URL_REGEX.test(normalizedText)) return 'meeting';
  if (VIDEO_URL_REGEX.test(normalizedText)) return 'video';
  if (MAP_URL_REGEX.test(normalizedText)) return 'map';
  if (MAP_WORD_REGEX.test(normalizedText)) return 'map';
  if (DOCUMENT_WORD_REGEX.test(normalizedText)) return 'document';

  const hasTime = TIME_REGEX.test(normalizedText);
  const hasMeetingWord = MEETING_WORD_REGEX.test(normalizedText);

  if (hasTime && hasMeetingWord) return 'meeting';

  return 'plain';
};

export const extractMeetingUrl = (text = '') => {
  const match = text.match(MEETING_URL_REGEX);
  return match ? match[0] : null;
};

export const extractVideoUrl = (text = '') => {
  const match = text.match(VIDEO_URL_REGEX);
  return match ? match[0] : null;
};

export const fetchVideoMeta = async (url) => {
  try {
    if (/youtube\.com|youtu\.be/i.test(url)) {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      );
      if (response.ok) {
        const data = await response.json();
        return {
          videoTitle: data.title,
          videoPlatform: 'Saved from YouTube',
          videoUrl: url,
        };
      }
    }

    if (/vimeo\.com/i.test(url)) {
      const response = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
      );
      if (response.ok) {
        const data = await response.json();
        return {
          videoTitle: data.title,
          videoPlatform: 'Saved from Vimeo',
          videoUrl: url,
        };
      }
    }

    if (/tiktok\.com/i.test(url)) {
      return {
        videoTitle: 'TikTok Video',
        videoPlatform: 'Saved from TikTok',
        videoUrl: url,
      };
    }
  } catch (_) {
    // Ignore metadata fetch failures and keep the base card.
  }

  return {
    videoTitle: null,
    videoPlatform: 'Saved Video',
    videoUrl: url,
  };
};

export const extractMapUrl = (text = '') => {
  const match = text.match(MAP_URL_REGEX);
  return match ? match[0] : null;
};

const parsePlaceFromUrl = (url) => {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/maps\/place\/([^/@?#]+)/);
    if (match && match[1]) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  } catch (_) {
    // Ignore malformed URLs and keep the fallback label.
  }

  return null;
};

export const fetchMapMeta = async (url) => {
  try {
    const directName = parsePlaceFromUrl(url);
    if (directName) {
      return {
        mapTitle: directName,
        mapSubtitle: 'Google Maps',
        mapUrl: url,
      };
    }

    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxy);

    if (response.ok) {
      const json = await response.json();
      const finalUrl = json?.status?.url || '';
      const resolved = parsePlaceFromUrl(finalUrl);

      if (resolved) {
        return {
          mapTitle: resolved,
          mapSubtitle: 'Google Maps',
          mapUrl: url,
        };
      }

      const html = json?.contents || '';
      const urlMatch =
        html.match(/URL=([^"']+google\.com\/maps\/place\/[^"']+)/i) ||
        html.match(/href="(https?:\/\/[^"]*\/maps\/place\/[^"]+)"/i);

      if (urlMatch) {
        const name = parsePlaceFromUrl(decodeURIComponent(urlMatch[1]));
        if (name) {
          return {
            mapTitle: name,
            mapSubtitle: 'Google Maps',
            mapUrl: url,
          };
        }
      }
    }
  } catch (_) {
    // Ignore metadata fetch failures and keep the base card.
  }

  return {
    mapTitle: null,
    mapSubtitle: 'Google Maps',
    mapUrl: url,
  };
};

export const getTaskCardPresentation = (
  task,
  actionItemLabel = 'Action Item'
) => {
  const cType = task.cardType || 'plain';
  const cfg = cardTypeConfig[cType] || cardTypeConfig.plain;

  const isVideo = cType === 'video';
  const isMap = cType === 'map';
  const isMeeting = cType === 'meeting';
  const isPlain = cType === 'plain';

  let displayTitle = task.text || '';
  let displaySub = actionItemLabel;
  let redirectUrl = null;

  if (isVideo && task.videoTitle) {
    displayTitle = task.videoTitle;
    displaySub = task.videoPlatform || 'Saved Video';
    redirectUrl = task.videoUrl || null;
  } else if (isMap && task.mapTitle) {
    displayTitle = task.mapTitle;
    displaySub = task.mapSubtitle || 'Location';
    redirectUrl = task.mapUrl || null;
  } else if (isMeeting) {
    const timeMatch = (task.text || '').match(
      /\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?|\d{1,2}\s*[APap][Mm])\b/
    );

    displaySub = timeMatch ? timeMatch[1].trim() : 'Video Call';
    redirectUrl = task.redirectUrl || extractMeetingUrl(task.text || '') || null;

    displayTitle =
      (task.text || '')
        .split(/\n|　/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !/https?:\/\//i.test(line) &&
            !/^開催日時|^開催方法|^date:|^time:|^method:/i.test(line) &&
            !/^meeting id:/i.test(line) &&
            !/^passcode:/i.test(line) &&
            !/^one tap mobile/i.test(line) &&
            !/^join by sip/i.test(line) &&
            !/^join instructions/i.test(line)
        )
        .join(' ')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\d{4}\/\d{2}\/\d{2}\s*\d{1,2}:\d{2}～?/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim() || task.text || '';
  } else if (isVideo && task.videoUrl) {
    redirectUrl = task.videoUrl;
  } else if (isMap && task.mapUrl) {
    redirectUrl = task.mapUrl;
  }

  return {
    cfg,
    cType,
    displayTitle,
    displaySub,
    redirectUrl,
    isPlain,
  };
};