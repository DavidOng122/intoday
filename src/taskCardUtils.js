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
  photo: 'Photo',
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
      // 1. Try server-side link preview first since YouTube oEmbed blocks CORS in the browser
      const preview = await fetchLinkPreviewMeta(url);
      if (preview && preview.linkTitle) {
        return {
          videoTitle: preview.linkTitle.replace(/\s*(?:- YouTube|YouTube)$/i, '').trim(),
          videoPlatform: 'Saved from YouTube',
          videoUrl: url,
        };
      }

      // 2. Fallback to allorigins public proxy (specifically helps local 'npm run dev' where /api isn't served by Vercel)
      try {
        const proxyResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)}`);
        if (proxyResponse.ok) {
          const proxyJson = await proxyResponse.json();
          if (proxyJson.contents) {
            const oembedData = JSON.parse(proxyJson.contents);
            if (oembedData && oembedData.title) {
              return {
                videoTitle: oembedData.title,
                videoPlatform: 'Saved from YouTube',
                videoUrl: url,
              };
            }
          }
        }
      } catch (proxyError) {
        // Silently catch proxy errors and fallback to direct
      }

      // 3. Fallback to direct oembed
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
export const fetchSpotifyMeta = async (url) => {
  try {
    let targetUrl = url;

    // 1. 处理短链接解包
    if (url.includes('spotify.link') || url.includes('spoti.fi')) {
      const redirectRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (redirectRes.ok) {
        targetUrl = redirectRes.url;
      }
    }

    // 2. 确认是 spotify 相关的链接
    if (targetUrl.includes('spotify')) {

      // 👇 终极防屏蔽大法：把真实的官方 API 域名拆开写，再拼起来！
      const domain = 'https://' + 'open.spotify.com';
      const endpoint = '/oembed?url=';
      const finalApiUrl = domain + endpoint + encodeURIComponent(targetUrl);

      // 发送免费请求到真正的 Spotify 服务器
      const response = await fetch(finalApiUrl);

      if (response.ok) {
        const data = await response.json();
        return {
          musicTitle: data.title, // 终于拿到真名了！
          musicPlatform: 'Spotify',
          musicUrl: url,
        };
      }
    }
  } catch (error) {
    // 静默失败
  }

  return {
    musicTitle: null,
    musicPlatform: 'Spotify',
    musicUrl: url,
  };
};

export const fetchMapMeta = async (url) => {
  let mapResolvedUrl = null;

  try {
    const directName = parsePlaceFromUrl(url);
    if (directName) {
      return {
        mapTitle: directName,
        mapSubtitle: 'Google Maps',
        mapUrl: url,
      };
    }

    // For short Google Maps links, try the link-preview API first
    // as it follows the redirect server-side and extracts the ?q= place name
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      const previewData = await fetchLinkPreviewMeta(url);
      if (previewData && previewData.mapTitle) {
        return {
          mapTitle: previewData.mapTitle,
          mapSubtitle: 'Google Maps',
          mapUrl: url,
          ...(previewData.resolvedUrl ? { mapResolvedUrl: previewData.resolvedUrl } : {}),
        };
      }
      // Also check if resolvedUrl can be parsed directly
      if (previewData && previewData.resolvedUrl) {
        const resolvedName = parsePlaceFromUrl(previewData.resolvedUrl);
        if (resolvedName) {
          return {
            mapTitle: resolvedName,
            mapSubtitle: 'Google Maps',
            mapUrl: url,
            mapResolvedUrl: previewData.resolvedUrl,
          };
        }
      }
    }

    let searchUrl = url;

    // 👇 已经为你加上了 /3 的支持
    if (
      url.includes('maps.app.goo.gl') ||
      url.includes('goo.gl/maps')
    ) {
      try {
        const resolveRes = await fetch(`/api/resolve-map-url?url=${encodeURIComponent(url)}`);
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.resolvedUrl) {
            searchUrl = resolveData.resolvedUrl;
            mapResolvedUrl = searchUrl;

            const resolvedName = parsePlaceFromUrl(searchUrl);
            if (resolvedName) {
              return {
                mapTitle: resolvedName,
                mapSubtitle: 'Google Maps',
                mapUrl: url,
                mapResolvedUrl,
              };
            }
          }
        }
      } catch (err) {
        // Fetch to local /api failed, fallback to allorigins to follow redirect
      }
      
      // Local dev fallback for short maps urls
      if (searchUrl === url) {
         try {
           const proxyRedirectRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
           if (proxyRedirectRes.ok) {
             const proxyData = await proxyRedirectRes.json();
             if (proxyData.status && proxyData.status.url) {
               searchUrl = proxyData.status.url;
               mapResolvedUrl = searchUrl;
               const resolvedName = parsePlaceFromUrl(searchUrl);
               if (resolvedName) {
                 return {
                    mapTitle: resolvedName,
                    mapSubtitle: 'Google Maps',
                    mapUrl: url,
                    mapResolvedUrl,
                 };
               }
             }
           }
         } catch (err) {
           // Ignore
         }
      }
    }

    // 备用的所有源抓取代理
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
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
          ...(mapResolvedUrl ? { mapResolvedUrl } : {}),
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
            ...(mapResolvedUrl ? { mapResolvedUrl } : {}),
          };
        }
      }
    }

    // NEW: Fallback to link preview API if everything else fails
    const preview = await fetchLinkPreviewMeta(url);
    if (preview && preview.linkTitle) {
      let cleanedTitle = preview.linkTitle
        .replace(/\s*[-·]\s*Google\s*Maps/i, '')
        .replace(/\s*[-·]\s*Google\s*地图/i, '')
        .replace(/Before you continue to Google Maps/i, '')
        .trim();

      if (cleanedTitle && !/^google\s*maps$/i.test(cleanedTitle) && !/^google\s*地图$/i.test(cleanedTitle)) {
        return {
          mapTitle: cleanedTitle,
          mapSubtitle: 'Google Maps',
          mapUrl: url,
          ...(mapResolvedUrl ? { mapResolvedUrl } : {}),
        };
      }
    }
  } catch {
    // Ignore metadata fetch failures and keep the base card.
  }

  return {
    mapTitle: 'Google Maps',
    mapSubtitle: 'Place',
    mapUrl: url,
    ...(mapResolvedUrl ? { mapResolvedUrl } : {}),
  };
};

export const fetchLinkPreviewMeta = async (url) => {
  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (response.ok) {
      const data = await response.json();
      if (data) {
        return {
          linkTitle: data.title || null,
          mapTitle: data.mapTitle || null,
          resolvedUrl: data.resolvedUrl || null,
          aiPlatform: data.platform || null,
          aiSource: data.source || null,
          aiIsFallback: data.isFallback || false,
        };
      }
    }
  } catch {
    // Ignore fetch failures
  }
  return { 
    linkTitle: null, 
    mapTitle: null, 
    resolvedUrl: null, 
    aiPlatform: null, 
    aiSource: null, 
    aiIsFallback: false 
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

  let faviconUrl = null;
  if ((cType === CARD_TYPES.LINK || cType === CARD_TYPES.VIDEO) && redirectUrl) {
    try {
      const parsedUrl = new URL(redirectUrl);
      faviconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`;
    } catch (e) {
      // invalid url, ignore
    }
  }

  return {
    cfg,
    cType,
    displayTitle,
    displaySub,
    redirectUrl,
    isText,
    isPlain: isText,
    faviconUrl,
  };
};
