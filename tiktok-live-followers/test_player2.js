const axios = require('axios');

async function test() {
  try {
    const r = await axios.get('http://localhost:3000/Codes/player.html?type=tiktok&id=7456079591405260037');
    const html = r.data;
    const hasTiktokJs = html.includes('loadTikTok');
    const hasSetMode = html.includes('setMode');
    const hasLoader = html.includes('id="loader"');
    console.log('Has loadTikTok:', hasTiktokJs);
    console.log('Has setMode:', hasSetMode);
    console.log('Has loader:', hasLoader);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();