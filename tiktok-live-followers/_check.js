const mongoose = require("mongoose");
require("dotenv").config();
const Video = require("./models/Video.js");

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const stats = await Video.aggregate([
        { $match: { webVideoUrl: /tiktok\.com\/@omari\.to\/video\//i, isActive: true } },
        { $group: { _id: null, totalLikes: { $sum: "$likes" }, totalViews: { $sum: "$views" }, videoCount: { $sum: 1 } } }
    ]);
    console.log("Aggregated stats:", JSON.stringify(stats[0]));
    const est = Math.round(stats[0].totalLikes / 8.5);
    console.log("Estimated followers (likes/8.5):", est);
    console.log("This is the 3.86M problem!");

    // Try tikwm for real follower count
    const axios = require("axios");
    try {
        const { data } = await axios.get("https://www.tikwm.com/api/user/info?unique_id=omari.to", {
            timeout: 15000,
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        if (data && data.data) {
            console.log("\ntikwm user info:");
            console.log("  followers:", data.data.followerCount || data.data.follower_count || data.data.stats?.followerCount);
            console.log("  likes:", data.data.totalFavorited || data.data.likeCount || data.data.stats?.totalFavorited);
            console.log("  videoCount:", data.data.videoCount || data.data.stats?.videoCount);
            console.log("  uniqueId:", data.data.uniqueId);
            console.log("  nickname:", data.data.nickname);
        }
    } catch (e) {
        console.log("\ntikwm API error:", e.message);
    }

    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
