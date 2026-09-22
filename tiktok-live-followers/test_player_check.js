const axios = require('axios');

async function test() {
    // Test TikTok player
    const tiktokRes = await axios.get('http://localhost:3000/Codes/player.html?type=tiktok&id=7686180633764171028', { validateStatus: () => true });
    const tiktokHtml = tiktokRes.data;
    console.log('TikTok player:');
    console.log('  Status:', tiktokRes.status);
    console.log('  Has videoElement:', tiktokHtml.includes('id="videoElement"'));
    console.log('  Has playOverlay:', tiktokHtml.includes('id="playOverlay"'));
    console.log('  Has loadTikTokVideo:', tiktokHtml.includes('loadTikTokVideo'));
    
    // Test YouTube player
    const ytRes = await axios.get('http://localhost:3000/Codes/player.html?type=youtube&id=G1nGiQZuP5w', { validateStatus: () => true });
    const ytHtml = ytRes.data;
    console.log('\nYouTube player:');
    console.log('  Status:', ytRes.status);
    console.log('  Has youtubeIframe:', ytHtml.includes('id="youtubeIframe"'));
    console.log('  Has loadYouTubeVideo:', ytHtml.includes('loadYouTubeVideo'));
    console.log('  Has onYouTubeIframeAPIReady:', ytHtml.includes('onYouTubeIframeAPIReady'));
    console.log('  Has initYouTubePlayer:', ytHtml.includes('initYouTubePlayer'));
}
test();