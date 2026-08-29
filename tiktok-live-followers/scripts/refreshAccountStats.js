require("dotenv").config();

const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
}

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const TIKTOK_SCRAPER_ACTOR_ID = "GdWCkxBtKWOsKjdch"; // Apify TikTok Scraper actor ID

async function fetchTikTokStatsViaApify(handle) {
    if (!APIFY_TOKEN) {
        console.log("[Apify] APIFY_TOKEN not configured, skipping");
        return null;
    }

    try {
        console.log(`[Apify] Fetching TikTok stats for @${handle}...`);
        
        // Start the actor run
        const runResponse = await axios.post(
            `https://api.apify.com/v2/acts/GdWCkxBtKWOsKjdch/runs?token=${APIFY_TOKEN}`,
            {
                profiles: [handle],
                resultsLimit: 1
            },
            {
                timeout: 30000,
                headers: { "Content-Type": "application/json" }
            }
        );

        const runId = runResponse.data.data.id;
        console.log(`[Apify] Run started: ${runId}`);

        // Wait for completion
        let attempts = 0;
        while (attempts < 40) {
            await new Promise(r => setTimeout(r, 3000));
            const runStatus = await axios.get(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
            );
            
            const status = runStatus.data.data.status;
            console.log(`[Apify] Run status: ${status}`);
            
            if (status === "SUCCEEDED") {
                // Get results
                const dataset = await axios.get(
                    `https://api.apify.com/v2/datasets/${runStatus.data.data.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=1`
                );
                
                const items = dataset.data;
                if (items && items.length > 0) {
                    const item = items[0];
                    const authorMeta = item.authorMeta;
                    
                    if (authorMeta) {
                        const followers = authorMeta.fans || 0;
                        const likes = authorMeta.heart || 0;
                        
                        console.log(`[Apify] Extracted: followers=${followers} likes=${likes}`);
                        
                        if (followers > 0 && likes > 0) {
                            return { followers, likes };
                        }
                    }
                }
                return null;
            } else if (status === "FAILED") {
                console.error(`[Apify] Run failed: ${runStatus.data.data.statusMessage}`);
                return null;
            }
            
            attempts++;
        }
        
        console.error("[Apify] Timeout waiting for run completion");
        return null;
    } catch (err) {
        console.error("[Apify] Fetch failed:", err.message);
        if (err.response) {
            console.error("[Apify] Response status:", err.response.status);
        }
        return null;
    }
}

function buildHandleRegex(handle) {
    const clean = String(handle || "").replace(/^@/, "").toLowerCase().trim();
    const escaped = clean.replace(/\./g, "\\.");
    return new RegExp(`tiktok\\.com/@${escaped}/video/`, "i");
}

async function refreshAccountStats() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const cacheFile = path.join(__dirname, "..", "accountStatsCache.json");
    let cache = { followers: 0, likes: 0, views: 0, updatedAt: null };
    
    // Read existing cache if available
    if (fs.existsSync(cacheFile)) {
        try {
            cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
            console.log("📖 Loaded existing cache:", cache);
        } catch (e) {
            console.log("⚠️ Failed to read cache file, starting fresh");
        }
    }

    try {
        console.log("🔍 Refreshing account statistics for @omari.to...");

        // Fetch REAL account-level stats from Apify
        console.log("[Apify] Attempting to fetch stats for @omari.to...");
        const profileStats = await fetchTikTokStatsViaApify("omari.to");

        // Get aggregated views from DB
        const Video = require("../models/Video");
        
        function handleRegex(handle) {
            const clean = String(handle || "").replace(/^@/, "").toLowerCase().trim();
            const escaped = clean.replace(/\./g, "\\.");
            return new RegExp(`tiktok\\.com/@${escaped}/video/`, "i");
        }

        const viewStats = await Video.aggregate([
            { $match: { webVideoUrl: handleRegex("omari.to"), isActive: true } },
            { $group: { _id: null, totalViews: { $sum: "$views" } } }
        ]);
        const totalViews = (viewStats[0] && viewStats[0].totalViews) || 0;

        const now = Date.now();

        if (profileStats && profileStats.followers > 0) {
            // Update cache with REAL fresh values from Apify
            cache = {
                followers: profileStats.followers,
                likes: profileStats.likes,
                views: totalViews,
                updatedAt: now,
                source: "apify"
            };

            console.log("✅ Updated cache with FRESH values from Apify:", {
                followers: profileStats.followers,
                likes: profileStats.likes,
                views: totalViews,
                source: "apify"
            });
        } else {
            // Provider failed — keep last known valid cached value
            console.log("⚠️ Provider failed, keeping last known valid cached value");
            
            if (cache.followers === 0 || cache.likes === 0) {
                console.log("❌ No valid cached value available — showing 'Updating...' in frontend");
                cache = {
                    followers: 0,
                    likes: 0,
                    views: totalViews,
                    updatedAt: now,
                    source: "none"
                };
            } else {
                cache = {
                    followers: cache.followers,
                    likes: cache.likes,
                    views: totalViews,
                    updatedAt: now,
                    source: "cache"
                };
            }
        }

        // Write updated cache to file
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
        console.log("💾 Cache written to file:", cacheFile);

        console.log("=================================");
        console.log("✅ Account Stats Refresh Completed");
        console.log("=================================");
        console.log("Followers:", cache.followers);
        console.log("Likes:", cache.likes);
        console.log("Views:", cache.views);
        console.log("Source:", cache.source);
        console.log("Updated At:", new Date(cache.updatedAt).toISOString());
        console.log("=================================");

    } catch (err) {
        console.error("❌ Account Stats Refresh Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("🔒 MongoDB Disconnected");
        process.exit(0);
    }
}

refreshAccountStats();