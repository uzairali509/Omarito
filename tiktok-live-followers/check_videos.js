const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Video = require('./models/Video');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const videos = await Video.find({ isActive: true }).sort({ createTime: -1 }).limit(10).lean();
  console.log('Latest videos:');
  videos.forEach(v => console.log('ID:', v.videoId, '| Title:', v.title?.substring(0,50), '| Username:', v.username, '| playUrl:', v.playUrl ? 'exists' : 'none', '| webVideoUrl:', v.webVideoUrl?.substring(0,60)));
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });