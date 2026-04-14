const isAiConversationUrl = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('chatgpt.com') || host.includes('openai.com')) {
      return { platform: 'chatgpt', isAiConversation: true };
    }
    if (host.includes('claude.ai')) {
      return { platform: 'claude', isAiConversation: true };
    }
    if (host.includes('gemini.google.com') || host.includes('bard.google.com') || 
        (host.includes('g.co') && path.startsWith('/gemini/share/'))) {
      return { platform: 'gemini', isAiConversation: true };
    }
    return { platform: null, isAiConversation: false };
  } catch {
    return { platform: null, isAiConversation: false };
  }
};

const INVALID_AI_TITLES = new Set([
  'chatgpt', 'claude', 'gemini', 'new chat', 'conversation', 'shared link',
  'chatgpt conversation', 'claude chat', 'gemini conversation', 'ai tool', 'openai',
  'gemini - direct access to google ai'
]);

const cleanDisplayText = (value = '') => {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`([{<]+|[\s"'`)\]}>]+$/g, '')
    .trim();
};

const resolveAiConversationTitle = (html, metadataTitle, platform) => {
  let title = metadataTitle ? metadataTitle.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "").trim() : null;
  
  // 1. Try Metadata explicitly
  if (title) {
    title = title.replace(/^(ChatGPT|Claude|Gemini)\s*[-–|:]\s*/i, '').trim();
    if (!INVALID_AI_TITLES.has(title.toLowerCase())) {
      return { title, source: 'metadata', isFallback: false };
    }
  }

  // 2. Content Summary Scraping
  if (html) {
    let stripped = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    stripped = stripped.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    stripped = stripped.replace(/<[^>]+>/g, ' ');
    
    const lines = stripped.split(/\s*(?:[.!?]\s+|\r?\n+|[|•·]\s+)\s*/).map(l => cleanDisplayText(l)).filter(Boolean);
    
    for (const line of lines) {
      if (line.length > 3 && !/^[\W_]+$/.test(line) && !INVALID_AI_TITLES.has(line.toLowerCase())) {
         return { title: line.length > 96 ? line.slice(0, 96).trimEnd() + '…' : line, source: 'content_summary', isFallback: false };
      }
    }
  }

  // 3. Fallback
  let fallback = 'AI Conversation';
  if (platform === 'chatgpt') fallback = 'ChatGPT Conversation';
  if (platform === 'claude') fallback = 'Claude Chat';
  if (platform === 'gemini') fallback = 'Gemini Conversation';
  
  return { title: fallback, source: 'fallback', isFallback: true };
};

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (/youtube\.com|youtu\.be/i.test(url)) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedRes = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'PostmanRuntime/7.28.4' },
        signal: AbortSignal.timeout(5000),
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data && data.title) {
          return res.status(200).json({ title: data.title, resolvedUrl: url });
        }
      } else {
        const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(oembedUrl)}`);
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson.contents) {
            const data = JSON.parse(proxyJson.contents);
            if (data && data.title) return res.status(200).json({ title: data.title, resolvedUrl: url });
          }
        }
      }
    } catch (_) {
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(5000)
    });

    const resolvedUrl = response.url || url;

    if (resolvedUrl.includes('google.com/maps') || resolvedUrl.includes('maps.app.goo.gl')) {
      try {
        const parsed = new URL(resolvedUrl);
        const q = parsed.searchParams.get('q');
        if (q) {
          const decodedQ = decodeURIComponent(q).replace(/\+/g, ' ');
          const cleanPlace = decodedQ.split(',')[0].trim();
          if (cleanPlace && cleanPlace.length > 2) {
            return res.status(200).json({ title: null, mapTitle: cleanPlace, resolvedUrl });
          }
        }
      } catch (e) {
      }
    }

    let titleLabel = null;
    let html = null;

    if (response.ok) {
      html = await response.text();
      const ogTitleMatch = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      const twitterTitleMatch = html.match(/name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
                                html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:title["']/i);

      if (ogTitleMatch && ogTitleMatch[1]) {
        titleLabel = ogTitleMatch[1];
      } else if (twitterTitleMatch && twitterTitleMatch[1]) {
        titleLabel = twitterTitleMatch[1];
      } else {
        const titleStart = html.toLowerCase().indexOf('<title');
        if (titleStart !== -1) {
          const titleTagEnd = html.indexOf('>', titleStart);
          if (titleTagEnd !== -1) {
            const titleEnd = html.toLowerCase().indexOf('</title>', titleTagEnd);
            if (titleEnd !== -1) {
              titleLabel = html.substring(titleTagEnd + 1, titleEnd);
            }
          }
        }
      }
    }

    if (titleLabel) {
      titleLabel = titleLabel.replace(/&#x27;/g, "'")
                   .replace(/&quot;/g, '"')
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/\s+/g, ' ')
                   .trim();
    }

    const { platform, isAiConversation } = isAiConversationUrl(resolvedUrl);
    if (isAiConversation) {
      const resolvedTarget = resolveAiConversationTitle(html, titleLabel, platform);
      return res.status(200).json({
        title: resolvedTarget.title,
        resolvedUrl,
        platform,
        source: resolvedTarget.source,
        isFallback: resolvedTarget.isFallback
      });
    }

    let title = titleLabel;

    const isGitHub = /github\.com/i.test(resolvedUrl);
    if (isGitHub) {
      if (!title || /^github$/i.test(title) || /^page not found/i.test(title)) {
        try {
          const parsedUrl = new URL(resolvedUrl);
          const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
          if (pathParts.length >= 2) {
              title = `${pathParts[0]}/${pathParts[1]}`;
          } else {
              title = 'GitHub Repository';
          }
        } catch (e) {
        }
      } else {
        if (title.startsWith('GitHub - ')) {
            title = title.substring(9).trim();
            const repoMatch = title.match(/^([^:]+)/);
            if (repoMatch && repoMatch[1]) {
                title = repoMatch[1].trim();
            }
        }
      }
    }

    if (!response.ok && !title) {
      return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}`, title: null, resolvedUrl });
    }

    return res.status(200).json({ title: title || null, resolvedUrl });

  } catch (error) {
    console.error('Error fetching link preview:', error);
    return res.status(500).json({ error: 'Failed to fetch link preview', details: error.message, title: null });
  }
}
