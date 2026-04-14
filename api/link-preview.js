export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // --- YouTube: use oEmbed API server-side to bypass bot-detection ---
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
      // Fall through to generic scraping
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

    // Special handling for Google Maps: extract place name from ?q= parameter in the resolved URL
    if (resolvedUrl.includes('google.com/maps') || resolvedUrl.includes('maps.app.goo.gl')) {
      try {
        const parsed = new URL(resolvedUrl);
        const q = parsed.searchParams.get('q');
        if (q) {
          // Return just the first part (the place name) before the street address
          const cleanPlace = decodeURIComponent(q).split(/[+,]/)[0].trim();
          if (cleanPlace && cleanPlace.length > 2) {
            return res.status(200).json({ title: null, mapTitle: cleanPlace, resolvedUrl });
          }
        }
      } catch (e) {
        // ignore parse errors, fall through to html parsing
      }
    }

    let title = null;

    if (response.ok) {
      const html = await response.text();

      // 1. Prioritize og:title or twitter:title usingsafer regex to avoid catastrophic backtracking
      const ogTitleMatch = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      const twitterTitleMatch = html.match(/name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
                                html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:title["']/i);

      if (ogTitleMatch && ogTitleMatch[1]) {
        title = ogTitleMatch[1];
      } else if (twitterTitleMatch && twitterTitleMatch[1]) {
        title = twitterTitleMatch[1];
      } else {
        // 2. Fallback to <title> using fast substring search
        const titleStart = html.toLowerCase().indexOf('<title');
        if (titleStart !== -1) {
          const titleTagEnd = html.indexOf('>', titleStart);
          if (titleTagEnd !== -1) {
            const titleEnd = html.toLowerCase().indexOf('</title>', titleTagEnd);
            if (titleEnd !== -1) {
              title = html.substring(titleTagEnd + 1, titleEnd);
            }
          }
        }
      }
    }



    // Clean up title
    if (title) {
        title = title.replace(/&#x27;/g, "'")
                     .replace(/&quot;/g, '"')
                     .replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/\s+/g, ' ') // Collapse multiple newlines and spaces into a single space
                     .trim();
    }

    // Special handling for ChatGPT
    const isChatGPT = resolvedUrl.includes('chatgpt.com') || resolvedUrl.includes('openai.com');
    if (isChatGPT && title) {
        if (title.toLowerCase().startsWith('chatgpt - ')) {
            title = title.substring(10).trim();
        } else if (title === 'ChatGPT') {
            title = null;
        }
    }
    if (isChatGPT && !title) {
        title = 'ChatGPT Conversation';
    }

    // Special handling for GitHub
    const isGitHub = /github\.com/i.test(resolvedUrl);
    if (isGitHub) {
        if (!title || /^github$/i.test(title) || /^page not found/i.test(title)) {
            // Extract from URL: github.com/user/repo
            try {
                const parsedUrl = new URL(resolvedUrl);
                const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
                if (pathParts.length >= 2) {
                    title = `${pathParts[0]}/${pathParts[1]}`;
                } else {
                    title = 'GitHub Repository';
                }
            } catch (e) {
                // Ignore parse errors
            }
        } else {
            // Clean up "GitHub - user/repo: description..."
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
