const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Video = require('./models/Video');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  // Check video with playUrl
  const videos = await Video.find({ isActive: true, playUrl: { $exists: true, $ne: '' } }).sort({ createTime: -1 }).limit(5).lean();
  console.log('Videos with playUrl:');
  videos.forEach(v => console.log('ID:', v.videoId, '| playUrl:', v.playUrl?.substring(0,80)));
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });