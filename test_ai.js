import handler from './api/link-preview.js';

async function test(url) {
  const req = {
    query: { url }
  };
  const res = {
    status: (code) => ({
      json: (data) => {
        console.log(`Status: ${code}`, data);
      }
    })
  };
  await handler(req, res);
}
const urls = [
  'https://chatgpt.com/share/67a3f8b1-1234',
  'https://claude.ai/chat/foo',
  'https://gemini.google.com/share/bar'
];
(async () => {
    for (const url of urls) {
        console.log(`Testing ${url}`);
        await test(url);
    }
})();
