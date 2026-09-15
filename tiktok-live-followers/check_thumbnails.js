require('dotenv').config();
const mongoose = require('mongoose');
const Video = require('./models/Video');

async function checkThumbnails() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected');
  
  const videos = await Video.find({ 
    webVideoUrl: /tiktok\.com\/@omari\.to\/video\//i, 
    isActive: true 
  }).limit(5).lean();
  
  console.log('Sample videos:');
  videos.forEach((v, i) => {
    console.log(`\nVideo ${i+1}:`);
    console.log('ID:', v.videoId);
    console.log('Thumbnail:', v.thumbnail ? v.thumbnail.substring(0, 80) + '...' : 'EMPTY');
    console.log('Has thumbnail:', !!v.thumbnail);
    
    if (v.thumbnail) {
      const exp = v.thumbnail.match(/x-expires=(\d+)/);
      if (exp) {
        const expiryTime = +exp[1] * 1000;
        const isExpired = expiryTime < Date.now();
        console.log('Expiry timestamp:', exp[1]);
        console.log('Is expired:', isExpired);
        console.log('Time until expiry:', Math.floor((expiryTime - Date.now()) / 1000 / 60) + ' minutes');
      } else {
        console.log('No expiry timestamp found');
      }
    }
  });
  
  await mongoose.disconnect();
  console.log('MongoDB Disconnected');
  process.exit(0);
}

checkThumbnails().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});