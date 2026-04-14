import handler from './api/link-preview.js';

async function test() {
  const req = {
    query: {
      url: 'https://github.com/NicholasTanJH/Browser-based-Weather-App'
    }
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
test();
