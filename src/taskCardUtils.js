import { cardTypeConfig, cardTypeLabels } from './lib/cardTypeConfig';
import {
  CARD_TYPES,
  detectCardType,
  extractMapUrl,
  extractMeetingUrl,
  extractPrimaryUrl,
  extractVideoUrl,
  getDerivedTaskFields,
  isTextCardType,
  normalizeCardType,
} from './lib/cardTypeDetection';

export {
  CARD_TYPES,
  detectCardType,
  extractMapUrl,
  extractMeetingUrl,
  extractPrimaryUrl,
  extractVideoUrl,
  getDerivedTaskFields,
  isTextCardType,
  normalizeCardType,
};

const DEFAULT_TASK_CARD_LABELS = {
  actionItem: 'Action Item',
  music: 'Music',
  link: 'Link',
  video: 'Video',
  podcast: 'Podcast',
  place: 'Place',
  text: 'Text',
  document: 'Document',
  meeting: 'Meeting',
  social: 'Social',
  shopping: 'Shopping',
  financial: 'Financial',
  savedVideo: 'Saved Video',
  savedFromYouTube: 'Saved from YouTube',
  savedFromVimeo: 'Saved from Vimeo',
  savedFromTikTok: 'Saved from TikTok',
  googleMaps: 'Google Maps',
  location: 'Location',
  meetingLink: 'Meeting Link',
};

const normalizeTaskCardLabels = (labels) => {
  if (!labels) return DEFAULT_TASK_CARD_LABELS;
  if (typeof labels === 'string') {
    return {
      ...DEFAULT_TASK_CARD_LABELS,
      actionItem: labels,
    };
  }

  return {
    ...DEFAULT_TASK_CARD_LABELS,
    ...labels,
  };
};

const resolveLocalizedTaskCardSubLabel = (value, labels) => {
  if (!value) return value;

  switch (value) {
    case 'Saved Video':
      return labels.savedVideo;
    case 'Saved from YouTube':
      return labels.savedFromYouTube;
    case 'Saved from Vimeo':
      return labels.savedFromVimeo;
    case 'Saved from TikTok':
      return labels.savedFromTikTok;
    case 'Google Maps':
      return labels.googleMaps;
    case 'Location':
      return labels.location;
    case 'Meeting Link':
      return labels.meetingLink;
    default:
      return value;
  }
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
  } catch {
    // Ignore metadata fetch failures and keep the base card.
  }

  return {
    videoTitle: null,
    videoPlatform: 'Saved Video',
    videoUrl: url,
  };
};

const parsePlaceFromUrl = (url) => {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/maps\/place\/([^/@?#]+)/);
    if (match && match[1]) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  } catch {
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
  } catch {
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
  labelsInput = DEFAULT_TASK_CARD_LABELS
) => {
  const labels = normalizeTaskCardLabels(labelsInput);
  const cType = normalizeCardType(task.cardType);
  const cfg = cardTypeConfig[cType] || cardTypeConfig[CARD_TYPES.TEXT];

  const isVideo = cType === CARD_TYPES.VIDEO;
  const isPlace = cType === CARD_TYPES.PLACE;
  const isMeeting = cType === CARD_TYPES.MEETING;
  const isText = isTextCardType(cType);

  let displayTitle = task.text || '';
  let displaySub = isText ? labels.actionItem : (labels[cType] || cardTypeLabels[cType] || labels.link);
  let redirectUrl =
    task.redirectUrl ||
    task.videoUrl ||
    task.mapUrl ||
    extractPrimaryUrl(task.text || '') ||
    null;

  if (isVideo && task.videoTitle) {
    displayTitle = task.videoTitle;
    displaySub = resolveLocalizedTaskCardSubLabel(task.videoPlatform, labels) || labels.savedVideo;
    redirectUrl = task.videoUrl || redirectUrl;
  } else if (isPlace && task.mapTitle) {
    displayTitle = task.mapTitle;
    displaySub = resolveLocalizedTaskCardSubLabel(task.mapSubtitle, labels) || labels.location;
    redirectUrl = task.mapUrl || redirectUrl;
  } else if (isMeeting) {
    const timeMatch = (task.text || '').match(
      /\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?|\d{1,2}\s*[APap][Mm])\b/
    );

    displaySub = timeMatch ? timeMatch[1].trim() : labels.meetingLink;
    redirectUrl = task.redirectUrl || extractMeetingUrl(task.text || '') || redirectUrl;

    displayTitle =
      (task.text || '')
        .split(/\n|\u3000/)
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
  }

  return {
    cfg,
    cType,
    displayTitle,
    displaySub,
    redirectUrl,
    isText,
    isPlain: isText,
  };
};
