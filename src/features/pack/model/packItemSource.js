import { extractPrimaryUrl, normalizeCardType } from '../../../entities/task/model/taskCardPresentation';
import { deriveTaskDisplaySubtitle } from '../../../lib/taskDisplayUtils';

export const getPackItemPrimaryUrl = (task) => (
  task?.primaryUrl || task?.videoUrl || task?.mapUrl || task?.redirectUrl || extractPrimaryUrl(task?.text || '') || ''
);

export const getPackItemSourceMeta = (task, labels = {}) => {
  const cardType = normalizeCardType(task?.cardType);
  const primaryUrl = getPackItemPrimaryUrl(task);
  const subtitle = deriveTaskDisplaySubtitle(task, labels) || 'Item';
  let host = '';
  let domain = '';
  try {
    if (primaryUrl) {
      const parsed = new URL(primaryUrl.startsWith('http') ? primaryUrl : `https://${primaryUrl}`);
      host = parsed.hostname.toLowerCase();
      domain = host.replace(/^www\./, '');
    }
  } catch {
    host = '';
    domain = '';
  }

  if (host.includes('youtube.com') || host.includes('youtu.be')) return { key: 'youtube', label: 'YouTube', domain: 'youtube.com' };
  if (host.includes('chatgpt.com') || host.includes('openai.com')) return { key: 'gpt', label: 'ChatGPT', domain: 'chatgpt.com' };
  if (host.includes('notion.so') || host.includes('notion.site')) return { key: 'notion', label: 'Notion', domain: 'notion.so' };
  if (host.includes('github.com')) return { key: 'github', label: 'GitHub', domain: 'github.com' };
  if (host.includes('spotify.com') || host.includes('spoti.fi')) return { key: 'spotify', label: 'Spotify', domain: 'spotify.com' };
  if (host.includes('instagram.com')) return { key: 'link', label: 'Instagram', domain: 'instagram.com' };
  if (host.includes('twitter.com') || host.includes('x.com')) return { key: 'link', label: 'X (Twitter)', domain: 'x.com' };
  if (host.includes('tiktok.com')) return { key: 'video', label: 'TikTok', domain: 'tiktok.com' };
  if (host.includes('reddit.com')) return { key: 'link', label: 'Reddit', domain: 'reddit.com' };
  if (domain) return { key: 'link', label: domain, domain };

  const fallback = {
    photo: { key: 'photo', label: labels.photo || 'Photo', domain: null },
    video: { key: 'video', label: subtitle, domain: null },
    document: { key: 'document', label: subtitle, domain: null },
    ai_tool: { key: 'gpt', label: subtitle, domain: null },
    text: { key: 'text', label: subtitle, domain: null },
  };
  return fallback[cardType] || { key: 'link', label: subtitle, domain: null };
};
