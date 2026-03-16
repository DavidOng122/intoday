export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow', // Automatically follow redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(5000), // Prevent hanging
    });

    // We only care about the final URL after redirect
    return res.status(200).json({ resolvedUrl: response.url });
  } catch (error) {
    console.error('Error resolving map short URL:', error);
    return res.status(500).json({ error: 'Failed to resolve map URL', details: error.message, resolvedUrl: null });
  }
}
