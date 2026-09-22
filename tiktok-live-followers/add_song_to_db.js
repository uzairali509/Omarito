require('dotenv').config();
const mongoose = require('mongoose');
const Video = require('./models/Video');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Check if song already exists
    const existing = await Video.findOne({ videoId: 'G1nGiQZuP5w' }).lean();
    if (existing) {
        console.log('Song already in DB:', existing.videoId);
        process.exit(0);
    }
    
    // Add the song to the database
    const song = await Video.create({
        videoId: 'G1nGiQZuP5w',
        platform: 'youtube',
        isActive: true,
        isShort: false,
        title: 'Omari.to - Song',
        description: 'Official song by Omari.to',
        creator: 'Omar',
        username: 'omari.to',
        webVideoUrl: 'https://www.youtube.com/watch?v=G1nGiQZuP5w',
        thumbnail: 'https://img.youtube.com/vi/G1nGiQZuP5w/maxresdefault.jpg',
        duration: 210, // placeholder, will be updated by YouTube API
        views: 0,
        likes: 0,
        comments: 0,
        createTime: new Date()
    });
    
    console.log('Song added to DB:', song.videoId);
    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });