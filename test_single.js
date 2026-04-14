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

test('https://chatgpt.com/s/t_69ddbe85fb588191a402a8e29547777e');
