export const detectCardType = (text) => {
  const normalizedText = text.toLowerCase();

  if (/https?:\/\/(www\.)?(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|us\d+web\.zoom\.us|whereby\.com|webex\.com|gotomeeting\.com|meet\.jit\.si)/.test(normalizedText)) return 'meeting';
  if (/https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)/.test(normalizedText)) return 'video';
  if (/google\.com\/maps|maps\.app\.goo\.gl/.test(normalizedText)) return 'map';
  if (/\b(address|jalan|street|avenue|blvd|road|mall|plaza|restaurant|cafe|mcdonald|kfc|starbucks|sunway|pavilion|mid valley)\b/.test(normalizedText)) return 'map';
  if (/\b(pdf|slides?|document|doc|submit|submission|export|report|file|spreadsheet|excel|powerpoint|proposal|revise|revision|review|draft|send|finale?)\b/.test(normalizedText)) return 'document';

  const hasTime = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/.test(normalizedText);
  const hasMeetingWord = /\b(meeting|interview|call|sync|standup|stand-up|catch up|catchup|briefing|session|zoom|teams|google meet|webinar|オンライン)\b/.test(normalizedText);
  if (hasTime && hasMeetingWord) return 'meeting';

  return 'plain';
};

export const extractVideoUrl = (text) => {
  const match = text.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)\S*/i);
  return match ? match[0] : null;
};

export const fetchVideoMeta = async (url) => {
  try {
    if (/youtube\.com|youtu\.be/.test(url)) {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return { videoTitle: data.title, videoPlatform: 'Saved from YouTube', videoUrl: url };
      }
    }
    if (/vimeo\.com/.test(url)) {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return { videoTitle: data.title, videoPlatform: 'Saved from Vimeo', videoUrl: url };
      }
    }
    if (/tiktok\.com/.test(url)) {
      return { videoTitle: 'TikTok Video', videoPlatform: 'Saved from TikTok', videoUrl: url };
    }
  } catch (_) {
  }

  return { videoTitle: null, videoPlatform: 'Saved Video', videoUrl: url };
};

export const extractMapUrl = (text) => {
  const match = text.match(/https?:\/\/(www\.)?(google\.com\/maps|maps\.app\.goo\.gl)\S*/i);
  return match ? match[0] : null;
};

export const parsePlaceFromUrl = (url) => {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/maps\/place\/([^/@?#]+)/);
    if (match && match[1]) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  } catch (_) {
  }

  return null;
};

export const fetchMapMeta = async (url) => {
  try {
    const directName = parsePlaceFromUrl(url);
    if (directName) {
      return { mapTitle: directName, mapSubtitle: 'Google Maps', mapUrl: url };
    }

    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxy);
    if (response.ok) {
      const json = await response.json();
      const finalUrl = json?.status?.url || '';
      const resolved = parsePlaceFromUrl(finalUrl);
      if (resolved) {
        return { mapTitle: resolved, mapSubtitle: 'Google Maps', mapUrl: url };
      }

      const html = json?.contents || '';
      const urlMatch = html.match(/URL=([^"']+google\.com\/maps\/place\/[^"']+)/i)
        || html.match(/href="(https?:\/\/[^\"]*\/maps\/place\/[^\"]+)"/i);
      if (urlMatch) {
        const name = parsePlaceFromUrl(decodeURIComponent(urlMatch[1]));
        if (name) {
          return { mapTitle: name, mapSubtitle: 'Google Maps', mapUrl: url };
        }
      }
    }
  } catch (error) {
    console.error('Map meta error:', error);
  }

  return { mapTitle: null, mapSubtitle: 'Google Maps', mapUrl: url };
};
