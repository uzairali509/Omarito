require("dotenv").config();

const mongoose = require("mongoose");
const axios = require("axios");
const Video = require("../models/Video");

// Same allowlist as routes/socialRoutes.js — the REAL account is the
// @handle inside webVideoUrl, never the stored creator/username fields.
const ALLOWED_USERNAMES = ["omari.to", "dilandyalieva", "hello.safia"];

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const TIKTOK_SCRAPER_ACTOR_ID = "GdWCkxBtKWOsKjdch"; // Apify TikTok Scraper actor ID

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

function detectCreator(item) {
    const username = (
        item.authorMeta?.name ||
        ""
    ).toLowerCase();

    const nickname = (
        item.authorMeta?.nickName ||
        ""
    ).toLowerCase();

    if (
        username.includes("omari") ||
        nickname.includes("omari")
    ) {
        return "Omar";
    }

    if (
        username.includes("dilan") ||
        nickname.includes("dilan")
    ) {
        return "Dylan";
    }

    if (
        username.includes("safia") ||
        nickname.includes("safia")
    ) {
        return "Sufiya";
    }

    return "Other";
}

function normalizeVideo(item) {
    const videoId =
        item.id ||
        item.videoId ||
        item.webVideoUrl?.split("/video/")[1]?.split("?")[0] ||
        "";

    if (!videoId)
        return null;

    return {
        videoId: String(videoId),
        creator: detectCreator(item),
        username: item.authorMeta?.name || "",
        nickname: item.authorMeta?.nickName || "",
        title: item.text || "",
        description: item.text || "",
        thumbnail:
            item.videoMeta?.coverUrl ||
            item.covers?.default ||
            item.covers?.dynamic ||
            item.covers?.origin ||
            "",
        playUrl: item.videoUrl || "",
        webVideoUrl: item.webVideoUrl || "",
        musicName: item.musicMeta?.musicName || "",
        musicAuthor: item.musicMeta?.musicAuthor || "",
        duration: item.videoMeta?.duration || 0,
        views: Number(item.playCount || 0),
        likes: Number(item.diggCount || 0),
        comments: Number(item.commentCount || 0),
        shares: Number(item.shareCount || 0),
        saves: Number(item.collectCount || 0),
        hashtags: (item.hashtags || []).map(h => typeof h === "string" ? h : (h.name || "")).filter(Boolean),
        avatar: item.authorMeta?.avatar || "",
        verified: item.authorMeta?.verified || false,
        videoLanguage: item.textLanguage || "",
        country: item.region || "",
        createTime: item.createTimeISO
            ? new Date(item.createTimeISO)
            : item.createTime
                ? new Date(item.createTime * 1000)
                : new Date(),
        source: "Apify",
        isTrending: false,
        isActive: true
    };
}

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
}

async function fetchVideosBySearch(handle, limit = 50) {
    if (!APIFY_TOKEN) {
        console.log("[Apify] APIFY_TOKEN not configured, skipping");
        return [];
    }

    try {
        console.log(`[Apify] Searching TikTok videos for @${handle}...`);
        
        // Use searchQueries mode which returns more recent videos than profiles mode
        const runResponse = await axios.post(
            `https://api.apify.com/v2/acts/${TIKTOK_SCRAPER_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
            {
                searchQueries: [handle],
                resultsLimit: limit
            },
            {
                timeout: 30000,
                headers: { "Content-Type": "application/json" }
            }
        );

        const runId = runResponse.data.data.id;
        console.log(`[Apify] Search run started: ${runId}`);

        // Wait for completion
        let attempts = 0;
        while (attempts < 80) {
            await new Promise(r => setTimeout(r, 5000));
            const runStatus = await axios.get(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
            );
            
            const status = runStatus.data.data.status;
            console.log(`[Apify] Run status: ${status}`);
            
            if (status === "SUCCEEDED") {
                // Get results
                const dataset = await axios.get(
                    `https://api.apify.com/v2/datasets/${runStatus.data.data.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=${limit}`
                );
                
                const items = dataset.data;
                if (items && items.length > 0) {
                    // Filter to only include videos BY the target account (not mentioning it)
                    const filtered = items.filter(item => {
                        const author = (item.authorMeta?.name || "").toLowerCase();
                        return author === handle.toLowerCase();
                    });
                    
                    const normalized = filtered.map(normalizeVideo).filter(Boolean);
                    console.log(`[Apify] Found ${normalized.length} videos BY @${handle} (from ${items.length} search results)`);
                    return normalized;
                }
                return [];
            } else if (status === "FAILED") {
                console.error(`[Apify] Run failed: ${runStatus.data.data.statusMessage}`);
                return [];
            }
            
            attempts++;
        }
        
        console.error("[Apify] Timeout waiting for run completion");
        return [];
    } catch (err) {
        console.error("[Apify] Search fetch failed:", err.message);
        if (err.response) {
            console.error("[Apify] Response status:", err.response.status);
        }
        return [];
    }
}

async function fetchVideosByProfile(handle) {
    if (!APIFY_TOKEN) {
        console.log("[Apify] APIFY_TOKEN not configured, skipping");
        return [];
    }

    try {
        console.log(`[Apify] Fetching TikTok profile videos for @${handle}...`);
        
        // Use profiles mode as fallback
        const runResponse = await axios.post(
            `https://api.apify.com/v2/acts/${TIKTOK_SCRAPER_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
            {
                profiles: [handle],
                resultsLimit: 10
            },
            {
                timeout: 30000,
                headers: { "Content-Type": "application/json" }
            }
        );

        const runId = runResponse.data.data.id;
        console.log(`[Apify] Profile run started: ${runId}`);

        let attempts = 0;
        while (attempts < 80) {
            await new Promise(r => setTimeout(r, 5000));
            const runStatus = await axios.get(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
            );
            
            const status = runStatus.data.data.status;
            console.log(`[Apify] Run status: ${status}`);
            
            if (status === "SUCCEEDED") {
                const dataset = await axios.get(
                    `https://api.apify.com/v2/datasets/${runStatus.data.data.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=10`
                );
                
                const items = dataset.data;
                if (items && items.length > 0) {
                    const normalized = items.map(normalizeVideo).filter(Boolean);
                    console.log(`[Apify] Fetched ${normalized.length} profile videos for @${handle}`);
                    return normalized;
                }
                return [];
            } else if (status === "FAILED") {
                console.error(`[Apify] Run failed: ${runStatus.data.data.statusMessage}`);
                return [];
            }
            
            attempts++;
        }
        
        console.error("[Apify] Timeout waiting for run completion");
        return [];
    } catch (err) {
        console.error("[Apify] Profile fetch failed:", err.message);
        if (err.response) {
            console.error("[Apify] Response status:", err.response.status);
        }
        return [];
    }
}

// Core sync function that can be called programmatically
async function syncVideosCore(options = {}) {
    const { disconnectAfter = true } = options;
    
    await connectDB();

    try {
        let allVideos = [];
        const seenVideoIds = new Set();
        
        // Fetch videos for each allowed creator using search (better for recent videos)
        for (const handle of ALLOWED_USERNAMES) {
            // Try search mode first (finds more recent videos)
            const searchVideos = await fetchVideosBySearch(handle, 50);
            
            // Also try profile mode as fallback
            const profileVideos = await fetchVideosByProfile(handle);
            
            // Combine and deduplicate
            const combined = [...searchVideos, ...profileVideos];
            for (const video of combined) {
                if (!seenVideoIds.has(video.videoId)) {
                    seenVideoIds.add(video.videoId);
                    allVideos.push(video);
                }
            }
        }

        if (!allVideos.length) {
            console.log("❌ No videos found.");
            return { inserted: 0, updated: 0, skipped: 0, total: 0 };
        }

        console.log("");
        console.log(`🚀 Syncing ${allVideos.length} unique videos...`);
        console.log("");

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (let i = 0; i < allVideos.length; i++) {
            const video = allVideos[i];

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
                `\r📦 ${i + 1}/${allVideos.length} | New:${inserted} | Updated:${updated} | Skipped:${skipped}`
            );
        }

        console.log("\n");
        console.log("=================================");
        console.log("✅ Sync Completed");
        console.log("=================================");
        console.log("Inserted :", inserted);
        console.log("Updated  :", updated);
        console.log("Skipped  :", skipped);
        console.log("Total    :", allVideos.length);
        console.log("=================================");

        return { inserted, updated, skipped, total: allVideos.length };

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
