const axios = require('axios');

async function test() {
    // Test videos page rendering
    const res = await axios.get('http://localhost:3000/Codes/videos.html', { validateStatus: () => true });
    const html = res.data;
    console.log('Videos page:');
    console.log('  Has videoGrid:', html.includes('id="videoGrid"'));
    console.log('  Has shortsGrid:', html.includes('id="shortsGrid"'));
    console.log('  Has buildShortsCard:', html.includes('buildShortsCard'));
    console.log('  Has showShorts:', html.includes('showShorts'));
    
    // Check TikTok videos API
    const tiktokRes = await axios.get('http://localhost:3000/tiktok-grid-videos?username=omari.to&limit=5', { validateStatus: () => true });
    console.log('\nTikTok grid videos:');
    console.log('  Success:', tiktokRes.data.success);
    console.log('  Total:', tiktokRes.data.total);
    console.log('  Videos:', tiktokRes.data.videos.length);
    if (tiktokRes.data.videos.length > 0) {
        console.log('  First:', tiktokRes.data.videos[0].id, tiktokRes.data.videos[0].title);
    }
}
test();