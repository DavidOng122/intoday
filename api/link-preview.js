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
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data && data.title) {
          return res.status(200).json({ title: data.title, resolvedUrl: url });
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

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}`, title: null, resolvedUrl });
    }

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

    const html = await response.text();

    // 1. Prioritize og:title
    let title = null;
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i);

    if (ogTitleMatch && ogTitleMatch[1]) {
      title = ogTitleMatch[1];
    } else {
      // 2. Fallback to <title>
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1];
      }
    }

    // Clean up title
    if (title) {
        title = title.replace(/&#x27;/g, "'")
                     .replace(/&quot;/g, '"')
                     .replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .trim();
    }

    return res.status(200).json({ title: title || null, resolvedUrl });

  } catch (error) {
    console.error('Error fetching link preview:', error);
    return res.status(500).json({ error: 'Failed to fetch link preview', details: error.message, title: null });
  }
}
