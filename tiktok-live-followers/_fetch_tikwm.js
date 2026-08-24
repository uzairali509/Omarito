require("dotenv").config();
const axios = require("axios");
const Video = require("./models/Video");
const mongoose = require("mongoose");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ALLOWED_USERNAMES = ["omari.to", "dilandyalieva", "hello.safia"];

function handleRegex(handle) {
    const escaped = String(handle || "").replace(/\./g, "\\.");
    return new RegExp(`tiktok\\.com/@${escaped}/video/`, "i");
}

function detectCreator(username) {
    const u = (username || "").toLowerCase();
    if (u.includes("omari")) return "Omar";
    if (u.includes("dilan")) return "Dylan";
    if (u.includes("safia")) return "Sufiya";
    return "Other";
}

function mapTikwmVideo(item, handle) {
    const videoId = String(item.video_id || item.id || "");
    if (!videoId) return null;

    return {
        videoId,
        tiktok_id: videoId,
        creator: detectCreator(handle),
        username: handle || item.author?.unique_id || "",
        title: item.title || "",
        description: item.title || "",
        thumbnail: item.cover || item.origin_cover || "",
        playUrl: item.play || "",
        webVideoUrl: `https://www.tiktok.com/@${handle}/video/${videoId}`,
        duration: item.duration || 0,
        views: Number(item.play_count || 0),
        likes: Number(item.digg_count || 0),
        comments: Number(item.comment_count || 0),
        shares: Number(item.share_count || 0),
        saves: Number(item.collect_count || 0),
        hashtags: (item.hashtags || []).map(h => typeof h === "string" ? h : (h.name || "")).filter(Boolean),
        createTime: item.create_time ? new Date(item.create_time * 1000) : new Date(),
        isActive: ALLOWED_USERNAMES.includes(handle),
        source: "tikwm"
    };
}

async function fetchFromTikwm(handle) {
    console.log(`\nFetching videos for @${handle} via tikwm...`);
    try {
        // Try the POST endpoint
        const params = new URLSearchParams();
        params.append("unique_id", handle);
        params.append("count", "35");
        params.append("cursor", "0");
        
        const { data } = await axios.post(
            "https://www.tikwm.com/api/user/posts",
            params.toString(),
            {
                timeout: 20000,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                }
            }
        );

        if (data && data.data && data.data.videos) {
            console.log(`  Found ${data.data.videos.length} videos`);
            return data.data.videos.map(v => mapTikwmVideo(v, handle)).filter(Boolean);
        }
        console.log("  No videos in response:", JSON.stringify(data).substring(0, 300));
    } catch (e) {
        console.log(`  tikwm error: ${e.message}`);
    }
    return [];
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    let totalNew = 0;
    let totalUpdated = 0;

    for (const handle of ALLOWED_USERNAMES) {
        const videos = await fetchFromTikwm(handle);
        
        if (videos.length === 0) {
            console.log(`No videos fetched for @${handle}`);
            continue;
        }

        let newCount = 0;
        let updateCount = 0;

        for (const video of videos) {
            const exists = await Video.exists({ videoId: video.videoId });
            
            await Video.findOneAndUpdate(
                { videoId: video.videoId },
                { $set: video },
                { upsert: true, runValidators: true }
            );

            if (exists) updateCount++;
            else newCount++;
        }

        console.log(`@${handle}: ${newCount} new, ${updateCount} updated out of ${videos.length} fetched`);
        totalNew += newCount;
        totalUpdated += updateCount;
    }

    console.log(`\n=== Summary ===`);
    console.log(`New videos: ${totalNew}`);
    console.log(`Updated videos: ${totalUpdated}`);

    // Show final counts
    for (const handle of ALLOWED_USERNAMES) {
        const count = await Video.countDocuments({
            isActive: true,
            webVideoUrl: handleRegex(handle)
        });
        console.log(`@${handle}: ${count} active videos`);
    }

    await mongoose.disconnect();
    process.exit();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
