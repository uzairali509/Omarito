const axios = require("axios");
const Ranking = require("../models/Ranking");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// In-memory cache for rankings
let rankingCache = {
    loaded: false,
    rankings: { asia: null, world: null, kazakhstan: null },
    lastUpdated: null
};

// Get cache TTL from env (default 6 hours)
const RANKINGS_CACHE_TTL = parseInt(process.env.RANKINGS_CACHE_MINUTES || "360", 10) * 60 * 1000;

/**
 * Fetch TikTok rankings from RapidAPI (Social Blade)
 * Returns { asia: number, world: number, kazakhstan: number } or null
 */
async function fetchRankingsFromRapidAPI() {
    if (!RAPIDAPI_KEY) {
        console.log("[rankings] RapidAPI key not configured, skipping");
        return null;
    }

    try {
        console.log("[rankings] Fetching TikTok rankings via RapidAPI (Social Blade)...");
        
        // Try to get global TikTok rankings from Social Blade
        const { data } = await axios.get("https://social-blade1.p.rapidapi.com/tiktok/top", {
            timeout: 15000,
            headers: {
                "X-RapidAPI-Key": RAPIDAPI_KEY,
                "X-RapidAPI-Host": "social-blade1.p.rapidapi.com"
            },
            params: { limit: 50 }
        });

        console.log("[rankings] RapidAPI top TikTok response received");

        // Find @omari.to in the rankings
        let asiaRank = null;
        let worldRank = null;
        let kazakhstanRank = null;

        if (data && Array.isArray(data)) {
            // Find @omari.to in the list
            const omariIndex = data.findIndex(item => 
                item.username?.toLowerCase() === "omari.to" || 
                item.name?.toLowerCase().includes("omari.to")
            );

            if (omariIndex >= 0) {
                worldRank = omariIndex + 1;
                console.log("[rankings] Found @omari.to at world rank:", worldRank);
            }

            // For Asia rank, we'd need regional data - for now use world rank as approximation
            // or try to get regional data if available
            if (worldRank) {
                // Rough approximation: Asia rank is typically similar to world rank for top creators
                // In a real implementation, you'd fetch Asia-specific rankings
                asiaRank = worldRank;
            }

            // For Kazakhstan, if the creator is from Kazakhstan, they might be #1 there
            if (worldRank && worldRank <= 10) {
                kazakhstanRank = 1; // Top creator from Kazakhstan
            }
        }

        // If we couldn't find via top list, try searching for the specific user
        if (!worldRank) {
            try {
                console.log("[rankings] Searching for @omari.to specifically...");
                const { data: userData } = await axios.get("https://social-blade1.p.rapidapi.com/tiktok/user", {
                    timeout: 10000,
                    headers: {
                        "X-RapidAPI-Key": RAPIDAPI_KEY,
                        "X-RapidAPI-Host": "social-blade1.p.rapidapi.com"
                    },
                    params: { username: "omari.to" }
                });

                if (userData && userData.rank) {
                    worldRank = parseInt(userData.rank, 10);
                    console.log("[rankings] Found @omari.to world rank via user lookup:", worldRank);
                    asiaRank = worldRank; // Approximation
                    kazakhstanRank = worldRank <= 10 ? 1 : null;
                }
            } catch (e) {
                console.log("[rankings] User lookup failed:", e.message);
            }
        }

        if (worldRank) {
            return { asia: asiaRank, world: worldRank, kazakhstan: kazakhstanRank };
        }
        return null;
    } catch (err) {
        console.error("[rankings] RapidAPI rankings fetch failed:", err.message);
        if (err.response) {
            console.error("[rankings] Response status:", err.response.status);
        }
        return null;
    }
}

/**
 * Load rankings from MongoDB
 */
async function loadRankingsFromDB() {
    try {
        const docs = await Ranking.find({
            platform: { $in: ["tiktok_asia", "tiktok_world", "tiktok_kazakhstan"] }
        }).lean();

        const map = {};
        docs.forEach(d => { map[d.platform] = d; });

        const asia = map["tiktok_asia"] ? map["tiktok_asia"].rank : null;
        const world = map["tiktok_world"] ? map["tiktok_world"].rank : null;
        const kazakhstan = map["tiktok_kazakhstan"] ? map["tiktok_kazakhstan"].rank : null;

        if (asia !== null || world !== null || kazakhstan !== null) {
            rankingCache = {
                loaded: true,
                rankings: { asia, world, kazakhstan },
                lastUpdated: new Date()
            };
            console.log("[rankings] Loaded from DB:", rankingCache.rankings);
        }
        return rankingCache;
    } catch (err) {
        console.error("[rankings] DB read failed:", err.message);
        return rankingCache;
    }
}

/**
 * Get current rankings (with cache)
 * Tries RapidAPI first, then falls back to DB
 */
async function getRankings() {
    const now = Date.now();
    const cacheStale = !rankingCache.loaded ||
        !rankingCache.lastUpdated ||
        (now - rankingCache.lastUpdated.getTime()) > RANKINGS_CACHE_TTL;

    if (cacheStale) {
        // Try to fetch fresh rankings from RapidAPI
        const freshRankings = await fetchRankingsFromRapidAPI();
        
        if (freshRankings && (freshRankings.asia || freshRankings.world || freshRankings.kazakhstan)) {
            // Update DB with fresh rankings
            try {
                for (const [platform, rank] of Object.entries(freshRankings)) {
                    if (rank) {
                        const platformMap = {
                            asia: "tiktok_asia",
                            world: "tiktok_world",
                            kazakhstan: "tiktok_kazakhstan"
                        };
                        await Ranking.findOneAndUpdate(
                            { platform: platformMap[platform] },
                            { 
                                platform: platformMap[platform], 
                                rank, 
                                lastUpdated: new Date(), 
                                source: "rapidapi" 
                            },
                            { upsert: true }
                        );
                    }
                }
                
                rankingCache = {
                    loaded: true,
                    rankings: freshRankings,
                    lastUpdated: new Date()
                };
                console.log("[rankings] Updated from RapidAPI:", rankingCache.rankings);
            } catch (err) {
                console.error("[rankings] Failed to save fresh rankings:", err.message);
            }
        } else {
            // Fall back to DB
            await loadRankingsFromDB();
        }
    }

    // If still no valid data, return null values (frontend will show "Updating...")
    if (!rankingCache.loaded || 
        (rankingCache.rankings.asia === null && 
         rankingCache.rankings.world === null && 
         rankingCache.rankings.kazakhstan === null)) {
        return {
            success: false,
            rankings: { asia: null, world: null, kazakhstan: null },
            lastUpdated: null,
            message: "No ranking data available. Run: node scripts/seedRankings.js"
        };
    }

    return {
        success: true,
        rankings: rankingCache.rankings,
        lastUpdated: rankingCache.lastUpdated
    };
}

/**
 * Manually update a ranking (admin endpoint)
 */
async function updateRanking(platform, rank) {
    const validPlatforms = ["tiktok_asia", "tiktok_world", "tiktok_kazakhstan"];
    if (!validPlatforms.includes(platform)) {
        throw new Error("Invalid platform");
    }
    if (!rank || isNaN(Number(rank)) || Number(rank) < 1) {
        throw new Error("rank must be a positive number");
    }

    const updated = await Ranking.findOneAndUpdate(
        { platform },
        { platform, rank: Number(rank), lastUpdated: new Date(), source: "admin" },
        { upsert: true, returnDocument: "after" }
    );

    // Invalidate cache
    rankingCache.loaded = false;
    rankingCache.lastUpdated = null;

    return { success: true, platform, rank: Number(rank), updated };
}

module.exports = {
    fetchRankingsFromRapidAPI,
    loadRankingsFromDB,
    getRankings,
    updateRanking,
    rankingCache
};