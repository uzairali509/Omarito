const axios = require('axios');

async function test() {
  try {
    const r = await axios.get('http://localhost:3000/Codes/player.html?type=tiktok&id=7456079591405260037');
    const html = r.data;
    const hasIframe = html.includes('embed/v2/7456079591405260037');
    const hasVideo = html.includes('id="video"');
    const hasFallback = html.includes('tiktokFallback');
    console.log('Has embed iframe:', hasIframe);
    console.log('Has video element:', hasVideo);
    console.log('Has fallback:', hasFallback);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();