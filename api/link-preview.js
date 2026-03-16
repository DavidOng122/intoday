export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // Short timeout to avoid holding up the serverless function too long
      signal: AbortSignal.timeout(5000) 
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}`, title: null });
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

    // Clean up title (decode HTML entities basically, though we'll keep it simple and just trim)
    if (title) {
        title = title.replace(/&#x27;/g, "'")
                     .replace(/&quot;/g, '"')
                     .replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .trim();
    }

    return res.status(200).json({ title: title || null });

  } catch (error) {
    console.error('Error fetching link preview:', error);
    return res.status(500).json({ error: 'Failed to fetch link preview', details: error.message, title: null });
  }
}
