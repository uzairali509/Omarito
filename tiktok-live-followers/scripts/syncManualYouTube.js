require("dotenv").config();

const mongoose = require("mongoose");
const axios = require("axios");
const Video = require("../models/Video");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "AIzaSyBtqSE00ra7_NoRg3EGuipaq75VIBDsecg";

const MANUAL_VIDEO_IDS = [
    "NonjJz3Itm0", "97PvHHgo78k", "Gx0Gu9MoLUE", "aJuZJ8IGVr8", "uPCH8abY5UI",
    "rWg2q3dFD08", "fqPCgZxxTYo", "qJDYOVGmLs4", "vHyAsLKjdX4", "NdbTxmYPIZs",
    "7o_i_kGq5RM", "vw1zpys_zHM", "kMnvsihmzK0", "ez68g8AMMfE", "rkYNlgVchmk",
    "_e1y0l_ckow", "b0J63AAl8Bg", "XWmpoRUiVN0", "JDEgQ2fJKN0", "zHX8MFvSodQ",
    "igcjkzZML3w", "mYH2PJqolzw", "Bf2dK2Xmjbk", "qaBURJoADms", "bpevDcof9Bs",
    "KUGpsa2GLl0", "biZr5G97Jkg", "LZ94lFQhzAU", "gFoXE0d-M84", "ddTeh2C6cQI",
    "FhATNJMKkhU", "fUwUtnd3RR4", "onKLR8d6KDs", "dChJCHjyF5k", "G1nGiQZuP5w"
];

function parseISO8601Duration(iso) {
    if (!iso) return null;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return null;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

function isShort(duration) {
    return duration !== null && duration <= 60;
}

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected for Manual YouTube sync");
}

async function fetchVideoDetails(videoIds) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`;
        const response = await axios.get(url);
        return response.data.items || [];
    } catch (err) {
        console.error("[Manual YouTube] Fetch error:", err.message);
        if (err.response) {
            console.error("[Manual YouTube] Status:", err.response.status);
            console.error("[Manual YouTube] Data:", err.response.data);
        }
        return [];
    }
}

async function syncManualYouTube() {
    await connectDB();

    const client = mongoose.connection.getClient();
    const db = client.db();
    const collection = db.collection("videos");

    try {
        console.log(`[Manual YouTube] Fetching details for ${MANUAL_VIDEO_IDS.length} videos...`);
        const items = await fetchVideoDetails(MANUAL_VIDEO_IDS);

        if (!items.length) {
            console.log("❌ No video details fetched.");
            return { inserted: 0, updated: 0, skipped: 0, total: 0 };
        }

        console.log(`🚀 Syncing ${items.length} manual YouTube videos...`);

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const item of items) {
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
                source: "YouTube API (manual sync)",
                isTrending: false,
                isActive: true,
                isShort: isShortVideo,
                playlistIds: [],
                createTime: new Date(snippet.publishedAt)
            };

            // Upsert by videoId (unique index)
            const result = await collection.updateOne(
                { videoId: String(videoId) },
                { $set: videoObj },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                inserted++;
            } else if (result.modifiedCount > 0) {
                updated++;
            } else {
                skipped++;
            }
        }

        console.log("\n");
        console.log("=================================");
        console.log("✅ Manual YouTube Sync Completed");
        console.log("=================================");
        console.log("Inserted :", inserted);
        console.log("Updated  :", updated);
        console.log("Skipped  :", skipped);
        console.log("Total    :", items.length);
        console.log("=================================");

        return { inserted, updated, skipped, total: items.length };

    } catch (err) {
        console.error("❌ Manual YouTube Sync Error:", err);
        throw err;
    } finally {
        await mongoose.disconnect();
        console.log("🔒 MongoDB Disconnected");
    }
}

if (require.main === module) {
    syncManualYouTube()
        .then(() => process.exit(0))
        .catch(err => {
            console.error("Manual YouTube sync failed:", err);
            process.exit(1);
        });
}

module.exports = { syncManualYouTube };