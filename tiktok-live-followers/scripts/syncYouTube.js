require("dotenv").config();

const mongoose = require("mongoose");
const axios = require("axios");
const Video = require("../models/Video");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "AIzaSyBtqSE00ra7_NoRg3EGuipaq75VIBDsecg";
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "UChwXC2xSe5hAhIwDV8suK-w";

const YOUTUBE_SHORTS_MAX_DURATION = 60;

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected for YouTube sync");
}

function parseISO8601Duration(iso) {
    if (!iso) return null;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return null;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

function isShort(duration) {
    return duration !== null && duration <= YOUTUBE_SHORTS_MAX_DURATION;
}

async function fetchChannelVideos(pageToken = "", allVideos = []) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&maxResults=50&order=date&type=video&key=${YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
        
        const response = await axios.get(url);
        const data = response.data;
        
        const videoIds = data.items.map(item => item.id.videoId).join(",");
        
        if (videoIds) {
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
            const detailsResponse = await axios.get(detailsUrl);
            
            for (const item of detailsResponse.data.items) {
                const videoId = item.id;
                const snippet = item.snippet;
                const contentDetails = item.contentDetails;
                const statistics = item.statistics;
                
                const duration = parseISO8601Duration(contentDetails.duration);
                const isShortVideo = isShort(duration);
                
                const videoObj = {
                    videoId: String(videoId),
                    platform: "youtube",
                    creator: "Omar",
                    username: "Omari.to",
                    title: snippet.title,
                    description: snippet.description,
                    thumbnail: snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url || "",
                    playUrl: `https://www.youtube.com/watch?v=${videoId}`,
                    webVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                    musicName: "",
                    musicAuthor: "",
                    duration: duration || 0,
                    views: Number(statistics.viewCount || 0),
                    likes: Number(statistics.likeCount || 0),
                    comments: Number(statistics.commentCount || 0),
                    shares: 0,
                    saves: 0,
                    hashtags: snippet.tags || [],
                    avatar: "",
                    verified: true,
                    videoLanguage: snippet.defaultAudioLanguage || "",
                    country: "",
                    source: "YouTube API",
                    isTrending: false,
                    isActive: true,
                    isShort: isShortVideo,
                    playlistIds: [],
                    createTime: new Date(snippet.publishedAt)
                };
                // Explicitly do NOT set tiktok_id for YouTube videos
                // to avoid duplicate key error on the sparse unique index
                allVideos.push(videoObj);
            }
        }
        
        if (data.nextPageToken && allVideos.length < 200) {
            await new Promise(r => setTimeout(r, 100));
            return fetchChannelVideos(data.nextPageToken, allVideos);
        }
        
        return allVideos;
    } catch (err) {
        console.error("[YouTube] Fetch error:", err.message);
        if (err.response) {
            console.error("[YouTube] Status:", err.response.status);
            console.error("[YouTube] Data:", err.response.data);
        }
        return allVideos;
    }
}

async function syncYouTubeCore(options = {}) {
    const { disconnectAfter = true } = options;
    
    await connectDB();
    
    // Get native MongoDB client from Mongoose connection
    const client = mongoose.connection.getClient();
    const db = client.db();
    const collection = db.collection("videos");

    try {
        console.log(`[YouTube] Fetching videos from channel ${YOUTUBE_CHANNEL_ID}...`);
        const allVideos = await fetchChannelVideos();
        
        if (!allVideos.length) {
            console.log("❌ No YouTube videos found.");
            return { inserted: 0, updated: 0, skipped: 0, total: 0 };
        }

        console.log("");
        console.log(`🚀 Syncing ${allVideos.length} YouTube videos...`);
        console.log("");

        // First, delete all existing YouTube videos
        await collection.deleteMany({ platform: "youtube" });
        console.log("Cleared existing YouTube videos");

        let inserted = 0;
        let skipped = 0;

        // Prepare documents for bulk insert - explicitly exclude tikok_id
        const docsToInsert = [];
        for (const video of allVideos) {
            if (!video.videoId || video.videoId === "undefined") {
                skipped++;
                continue;
            }
            // Create a copy without tikok_id
            const { tikok_id, ...doc } = video;
            docsToInsert.push(doc);
        }

        if (docsToInsert.length > 0) {
            // Use insertMany with ordered: false
            const result = await collection.insertMany(docsToInsert, { ordered: false });
            inserted = result.insertedCount;
            console.log(`Inserted ${inserted} YouTube videos`);
        }

        console.log("\n");
        console.log("=================================");
        console.log("✅ YouTube Sync Completed");
        console.log("=================================");
        console.log("Inserted :", inserted);
        console.log("Updated  : 0 (full replace)");
        console.log("Skipped  :", skipped);
        console.log("Total    :", allVideos.length);
        console.log("=================================");

        return { inserted, updated: 0, skipped, total: allVideos.length };

    } catch (err) {
        console.log("");
        console.error("❌ YouTube Sync Error:");
        console.error(err);
        throw err;
    } finally {
        if (disconnectAfter) {
            await mongoose.disconnect();
            console.log("");
            console.log("🔒 MongoDB Disconnected");
        }
    }
}

async function syncYouTube() {
    try {
        await syncYouTubeCore({ disconnectAfter: true });
        process.exit(0);
    } catch (err) {
        console.error("YouTube sync failed:", err);
        process.exit(1);
    }
}

module.exports = { syncYouTubeCore };

if (require.main === module) {
    syncYouTube();
}