const Ranking = require("../models/Ranking");

// In-memory cache for rankings
let rankingCache = {
    loaded: false,
    rankings: { asia: null, world: null, kazakhstan: null },
    lastUpdated: null
};

// Get cache TTL from env (default 6 hours)
const RANKINGS_CACHE_TTL = parseInt(process.env.RANKINGS_CACHE_MINUTES || "360", 10) * 60 * 1000;

/**
 * Fetch TikTok rankings from a real provider.
 * Currently no free provider is available - this function returns null.
 * When a real provider is configured, implement the fetch logic here.
 * 
 * Required provider capabilities:
 * - Must provide actual Asia ranking for @omari.to
 * - Must provide actual World ranking for @omari.to
 * - Must provide actual Kazakhstan ranking for @omari.to
 * - Must use documented methodology (not approximations)
 * 
 * Potential providers to integrate:
 * - TikTok Business/Creator API (requires approval)
 * - Social Blade API (requires paid subscription)
 * - TikTok Business/Creator Marketplace API
 * - Other legitimate social analytics APIs with ranking endpoints
 * 
 * @returns {Promise<{asia: number, world: number, kazakhstan: number} | null>}
 */
async function fetchRankingsFromProvider() {
    // TODO: Implement when a real ranking provider is configured
    // Currently no free ranking provider is available:
    // - TikTok ranking endpoints return 503/"url doesn't match"
    // - RapidAPI Social Blade returns 403 (not subscribed)
    // - Other RapidAPI TikTok endpoints return 403/404
    // - Apify TikTok scraper doesn't provide rankings
    
    console.log("[rankings] No ranking provider configured — returning null");
    return null;
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

        // Only load if we have valid data from a real provider (not seed values)
        const hasRealData = (asia !== null && map["tiktok_asia"]?.source === "provider") ||
                           (world !== null && map["tiktok_world"]?.source === "provider") ||
                           (kazakhstan !== null && map["tiktok_kazakhstan"]?.source === "provider");

        if (hasRealData) {
            rankingCache = {
                loaded: true,
                rankings: { asia, world, kazakhstan },
                lastUpdated: new Date()
            };
            console.log("[rankings] Loaded real provider data from DB:", rankingCache.rankings);
        } else {
            console.log("[rankings] No real provider data in DB (only seed/admin values)");
            rankingCache.loaded = false;
        }
        return rankingCache;
    } catch (err) {
        console.error("[rankings] DB read failed:", err.message);
        return rankingCache;
    }
}

/**
 * Get current rankings (with cache)
 * Tries real provider first. If no provider configured, returns null.
 * Only uses DB cache if data came from a real provider.
 */
async function getRankings() {
    // Try to fetch fresh rankings from real provider
    const freshRankings = await fetchRankingsFromProvider();

    if (freshRankings && (freshRankings.asia || freshRankings.world || freshRankings.kazakhstan)) {
        // Update DB with fresh rankings from real provider
        for (const [platform, rank] of Object.entries(freshRankings)) {
            if (rank) {
                const platformMap = {
                    asia: "tiktok_asia",
                    world: "tiktok_world",
                    kazakhstan: "tiktok_kazakhstan"
                };
                try {
                    await Ranking.findOneAndUpdate(
                        { platform: platformMap[platform] },
                        { 
                            platform: platformMap[platform], 
                            rank, 
                            lastUpdated: new Date(), 
                            source: "provider" 
                        },
                        { upsert: true }
                    );
                } catch (err) {
                    console.error("[rankings] DB update error:", err.message);
                }
            }
            
            rankingCache = {
                loaded: true,
                rankings: freshRankings,
                lastUpdated: new Date()
            };
            console.log("[rankings] Updated from real provider:", rankingCache.rankings);
        }
    } else {
            // No provider configured or provider returned no data
            // Load from DB only if we have real provider data cached
            await loadRankingsFromDB();
        }

    // If no valid data from real provider, return null (frontend shows "Updating...")
    if (!rankingCache.loaded || 
        (rankingCache.rankings.asia === null && 
         rankingCache.rankings.world === null && 
         rankingCache.rankings.kazakhstan === null)) {
        return {
            success: false,
            rankings: { asia: null, world: null, kazakhstan: null },
            lastUpdated: null,
            message: "No ranking provider configured. Configure a real ranking provider (e.g., TikTok Business API, Social Blade subscription) to display rankings."
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
    fetchRankingsFromProvider,
    loadRankingsFromDB,
    getRankings,
    updateRanking,
    rankingCache
};