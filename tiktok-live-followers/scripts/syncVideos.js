require("dotenv").config();

const mongoose = require("mongoose");
const Video = require("../models/Video");
const { fetchTikTokVideos } = require("../services/apifyService");

// Same allowlist as routes/socialRoutes.js — the REAL account is the
// @handle inside webVideoUrl, never the stored creator/username fields.
const ALLOWED_USERNAMES = ["omari.to", "dilandyalieva", "hello.safia"];

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleRegex(handle) {
    return new RegExp(
        "^https?://(?:[a-z0-9.-]+\\.)?tiktok\\.com/@" +
            escapeRegex(handle) + "/video/",
        "i"
    );
}

function isAllowedAccount(video) {
    return ALLOWED_USERNAMES.some(h => handleRegex(h).test(video.webVideoUrl || ""));
}

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
}

// Core sync function that can be called programmatically
async function syncVideosCore(options = {}) {
    const { disconnectAfter = true } = options;
    
    await connectDB();

    try {
        const videos = await fetchTikTokVideos();

        if (!videos.length) {
            console.log("❌ No videos found.");
            return { inserted: 0, updated: 0, skipped: 0, total: 0 };
        }

        console.log("");
        console.log(`🚀 Syncing ${videos.length} videos...`);
        console.log("");

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];

            if (!video.videoId || video.videoId === "undefined") {
                skipped++;
                continue;
            }

            // Videos from unrelated/fan/lookalike accounts are stored
            // inactive so they can never leak through any endpoint.
            video.isActive = isAllowedAccount(video);

            // Production DB has a NON-sparse unique index on tiktok_id,
            // so every doc must carry a unique value (missing counts as
            // null and would collide). The TikTok video id itself is the
            // canonical unique TikTok id.
            video.tiktok_id = String(video.videoId);
            delete video.nickname; // display-only field, not in schema

            const exists = await Video.exists({
                videoId: video.videoId
            });

            await Video.findOneAndUpdate(
                { videoId: video.videoId },
                { $set: video },
                { upsert: true, returnDocument: 'after', runValidators: true }
            );

            if (exists)
                updated++;
            else
                inserted++;

            process.stdout.write(
                `\r📦 ${i + 1}/${videos.length} | New:${inserted} | Updated:${updated} | Skipped:${skipped}`
            );
        }

        console.log("\n");
        console.log("=================================");
        console.log("✅ Sync Completed");
        console.log("=================================");
        console.log("Inserted :", inserted);
        console.log("Updated  :", updated);
        console.log("Skipped  :", skipped);
        console.log("Total    :", videos.length);
        console.log("=================================");

        return { inserted, updated, skipped, total: videos.length };

    } catch (err) {
        console.log("");
        console.error("❌ Sync Error:");
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

// Manual command wrapper (exits process after sync)
async function syncVideos() {
    try {
        await syncVideosCore({ disconnectAfter: true });
        process.exit(0);
    } catch (err) {
        console.error("Sync failed:", err);
        process.exit(1);
    }
}

// Export core function for programmatic use
module.exports = { syncVideosCore };

// Run manual sync if called directly
if (require.main === module) {
    syncVideos();
}
