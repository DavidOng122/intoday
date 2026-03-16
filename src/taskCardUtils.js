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
import { resolveTaskUrl } from './task-interactions/taskUrlResolver';
import { 
  deriveTaskDisplayTitle, 
  deriveTaskDisplaySubtitle,
  parsePlaceFromUrl 
} from './lib/taskDisplayUtils';

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
  const isText = isTextCardType(cType);

  // Use unified derivation logic
  let displayTitle = deriveTaskDisplayTitle(task);
  let displaySub = deriveTaskDisplaySubtitle(task, labels);
  
  // Handle specific text labels for standard types if no specific platform derived
  if (isText) {
    displaySub = labels.actionItem;
  }

  // Preserve specifically fetched video/map platforms if derivedSub is generic
  if (cType === CARD_TYPES.VIDEO && task.videoPlatform && displaySub === (labels.video || 'Video')) {
    displaySub = resolveLocalizedTaskCardSubLabel(task.videoPlatform, labels) || labels.savedVideo;
  } else if (cType === CARD_TYPES.PLACE && task.mapSubtitle && displaySub === (labels.place || 'Place')) {
    displaySub = resolveLocalizedTaskCardSubLabel(task.mapSubtitle, labels) || labels.location;
  }

  const redirectUrl = resolveTaskUrl(task);

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
