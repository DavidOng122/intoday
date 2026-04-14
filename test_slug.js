const GENERIC_TITLE_WORDS = new Set([
  'link','video','music','podcast','document','doc','docs','meeting','map',
  'maps','google map','google maps','place','location','task','item',
  'open this','open','chatgpt','claude','gemini','perplexity','openai',
  'ai tool','conversation','chat','shared link','chatgpt conversation',
  'claude conversation','gemini conversation','perplexity conversation',
]);

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

const parseReadableSlugFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const parts = pathname.split('/').filter(Boolean);

    if (!parts.length) return null;

    const last = parts[parts.length - 1];
    const cleaned = cleanDisplayText(last);

    if (!isMeaningfulText(cleaned)) return null;
    if (/^[a-z0-9]{6,}$/i.test(cleaned.replace(/\s+/g, ''))) return null;

    return toTitleCase(cleaned);
  } catch {
    return null;
  }
};

console.log(parseReadableSlugFromUrl('https://github.com/NicholasTanJH/Browser-based-Weather-App'));
