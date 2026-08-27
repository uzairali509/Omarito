const express = require("express");
const router = express.Router();
const axios = require("axios");
const Video = require("../models/Video");
const { fetchFreshThumbnail, isUsable } = require("../services/thumbnailService");
const { getRankings, updateRanking } = require("../services/rankingService");

// =======================
// ALLOWLIST & HELPERS
// =======================

// Only these TikTok accounts may ever appear in any response
const ALLOWED_USERNAMES = ["omari.to", "dilandyalieva", "hello.safia"];

// Official playlist IDs for @omari.to — used by grid, upnext, and backfill
const OFFICIAL_PLAYLIST_IDS = {
    "7433667529204828933": "OMARITO.WOW",
    "7433396735386405638": "OMARITO.WORLD",
    "7433392358749653766": "OMARITO.CHEF"
};

// Legacy name strings accepted from the URL (?playlist=Omarito.World)
// Mapped to their official numeric IDs so old links keep working.
const PLAYLIST_NAME_TO_ID = {
    "Omarito.World": "7433396735386405638",
    "Omarito.Wow":   "7433667529204828933",
    "Omarito.Chef":  "7433392358749653766",
    "omarito.world": "7433396735386405638",
    "omarito.wow":   "7433667529204828933",
    "omarito.chef":  "7433392358749653766"
};

// Build a regex that matches webVideoUrl for a specific creator handle.
// Anchored to the TikTok URL pattern so lookalikes (@omor2.011, @omari.to005)
// can never match.
function handleRegex(username) {
    const clean = String(username || "").replace(/^@/, "").toLowerCase().trim();
    // Escape dots for regex: omari.to -> omari\.to
    const escaped = clean.replace(/\./g, "\\.");
    return new RegExp(`tiktok\\.com/@${escaped}/video/`, "i");
}

// Map a Mongoose Video document to the shape the frontend expects
function mapVideoDoc(doc) {
    return {
        id: doc.videoId || doc.tiktok_id || "",
        title: doc.title || "",
        description: doc.description || "",
        thumbnail: doc.thumbnail || "",
        views: doc.views || 0,
        likes: doc.likes || 0,
        comments: doc.comments || 0,
        shares: doc.shares || 0,
        saves: doc.saves || 0,
        duration: doc.duration || 0,
        username: doc.username || "",
        creator: doc.creator || "",
        video_url: doc.webVideoUrl || "",
        playUrl: doc.playUrl || "",
        createTime: doc.createTime || null,
        hashtags: doc.hashtags || []
    };
}

// Check if a TikTok play/stream URL is still usable (not expired)
function isStreamUsable(url) {
    if (!url) return false;
    // Check for x-expires parameter in the URL
    const exp = String(url).match(/x-expires=(\d+)/);
    if (exp) {
        return (+exp[1] * 1000) > Date.now();
    }
    // If no expiry marker, assume usable
    return true;
}

// =======================
// GET /tiktok-data
// Homepage follower + like counts for @omari.to
// Scrapes REAL account-level stats from TikTok profile pages
// =======================

// In-memory cache for account-level stats (refreshed every 30 min)
let tiktokProfileCache = {
    followers: 59000000, // Known baseline for @omari.to (59M)
    likes: 781000000, // Known baseline for @omari.to (781M total likes)
    views: 0,
    updatedAt: null
};
const PROFILE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Fetch TikTok stats via RapidAPI (Social Blade) as fallback
async function fetchTikTokStatsViaRapidAPI(handle) {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
        console.log("[tiktok-data] RapidAPI key not configured, skipping");
        return null;
    }

    try {
        console.log("[tiktok-data] Fetching TikTok stats via RapidAPI for @" + handle);
        const { data } = await axios.get("https://social-blade1.p.rapidapi.com/tiktok/user", {
            timeout: 10000,
            headers: {
                "X-RapidAPI-Key": rapidApiKey,
                "X-RapidAPI-Host": "social-blade1.p.rapidapi.com"
            },
            params: { username: handle }
        });

        console.log("[tiktok-data] RapidAPI response:", JSON.stringify(data).substring(0, 200));

        // Parse the response - structure may vary
        let followers = 0;
        let likes = 0;

        if (data?.followers) {
            followers = parseInt(data.followers.toString().replace(/,/g, ''), 10);
        } else if (data?.data?.followers) {
            followers = parseInt(data.data.followers.toString().replace(/,/g, ''), 10);
        }

        if (data?.likes || data?.hearts) {
            likes = parseInt((data.likes || data.hearts).toString().replace(/,/g, ''), 10);
        } else if (data?.data?.likes || data?.data?.hearts) {
            likes = parseInt((data.data.likes || data.data.hearts).toString().replace(/,/g, ''), 10);
        }

        // Also try total_likes field
        if (likes === 0 && data?.total_likes) {
            likes = parseInt(data.total_likes.toString().replace(/,/g, ''), 10);
        } else if (likes === 0 && data?.data?.total_likes) {
            likes = parseInt(data.data.total_likes.toString().replace(/,/g, ''), 10);
        }

        console.log("[tiktok-data] RapidAPI Extracted: followers=" + followers + " likes=" + likes);

        if (followers > 0 && likes > 0) {
            return { followers, likes };
        }
        return null;
    } catch (err) {
        console.error("[tiktok-data] RapidAPI fetch failed:", err.message);
        if (err.response) {
            console.error("[tiktok-data] RapidAPI Response status:", err.response.status);
            console.error("[tiktok-data] RapidAPI Response data:", err.response.data);
        }
        return null;
    }
}

// Scrape real account-level stats from TikTok profile page
async function fetchRealProfileStats(handle) {
    try {
        console.log("[tiktok-data] Scraping TikTok profile for @" + handle);
        const { data: html } = await axios.get(`https://www.tiktok.com/@${handle}`, {
            timeout: 15000,
            maxContentLength: 10 * 1024 * 1024,
            responseType: "text",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });

        console.log("[tiktok-data] HTML received, length:", typeof html === "string" ? html.length : typeof html);

        // Extract real account-level stats from the HTML
        // Try multiple patterns as TikTok's HTML structure may vary
        const patterns = {
            followers: [
                /"followerCount"[\s:]*(\d+)/i,
                /"followerCount"\s*:\s*(\d+)/i,
                /followerCount["\s:]+(\d+)/i,
                /"stats"[\s\S]{0,100}"followerCount"[\s:]*(\d+)/i,
            ],
            likes: [
                /"heartCount"[\s:]*(\d+)/i,
                /"heartCount"\s*:\s*(\d+)/i,
                /"totalFavorited"[\s:]*(\d+)/i,
                /"totalFavorited"\s*:\s*(\d+)/i,
                /heartCount["\s:]+(\d+)/i,
                /"stats"[\s\S]{0,100}"heartCount"[\s:]*(\d+)/i,
            ]
        };

        let followers = 0;
        let likes = 0;

        // Try each pattern for followers
        for (const pattern of patterns.followers) {
            const match = html.match(pattern);
            if (match && match[1]) {
                followers = parseInt(match[1], 10);
                if (followers > 0) break;
            }
        }

        // Try each pattern for likes
        for (const pattern of patterns.likes) {
            const match = html.match(pattern);
            if (match && match[1]) {
                likes = parseInt(match[1], 10);
                if (likes > 0) break;
            }
        }

        // Also try to extract from __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag
        if (followers === 0 || likes === 0) {
            try {
                const universalDataMatch = html.match(/__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*(\{[\s\S]*?\});/);
                if (universalDataMatch) {
                    const universalData = JSON.parse(universalDataMatch[1]);
                    // Navigate to user stats
                    const userData = universalData?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
                    if (userData) {
                        if (followers === 0 && userData.stats?.followerCount) {
                            followers = parseInt(userData.stats.followerCount, 10);
                        }
                        if (likes === 0 && userData.stats?.heartCount) {
                            likes = parseInt(userData.stats.heartCount, 10);
                        }
                    }
                }
            } catch (e) {
                console.log("[tiktok-data] Universal data parsing failed:", e.message);
            }
        }

        console.log("[tiktok-data] Extracted: followers=" + followers + " likes=" + likes);
        
        // Only return if we got valid data (followers > 0)
        if (followers > 0 && likes > 0) {
            return { followers, likes };
        }
        return null;
    } catch (err) {
        console.error("[tiktok-data] TikTok profile scrape failed:", err.message);
        if (err.response) {
            console.error("[tiktok-data] Response status:", err.response.status);
        }
        return null;
    }
}

router.get("/tiktok-data", async (req, res) => {
    try {
        const now = Date.now();
        const cacheValid = tiktokProfileCache.updatedAt &&
            (now - tiktokProfileCache.updatedAt) < PROFILE_CACHE_TTL;

        if (cacheValid) {
            // Return cached stats (includes baseline followers if scrape failed)
            return res.json({
                followers: tiktokProfileCache.followers,
                likes: tiktokProfileCache.likes,
                views: tiktokProfileCache.views
            });
        }

        // Fetch REAL account-level stats from TikTok (try scraping first)
        let profileStats = await fetchRealProfileStats("omari.to");

        // If scraping fails, try RapidAPI as fallback
        if (!profileStats || profileStats.followers === 0) {
            console.log("[tiktok-data] Direct scrape failed, trying RapidAPI fallback...");
            profileStats = await fetchTikTokStatsViaRapidAPI("omari.to");
        }

        if (profileStats && profileStats.followers > 0) {
            // Also get aggregated views from DB (TikTok page doesn't expose total views)
            const viewStats = await Video.aggregate([
                { $match: { webVideoUrl: handleRegex("omari.to"), isActive: true } },
                { $group: { _id: null, totalViews: { $sum: "$views" } } }
            ]);
            const totalViews = (viewStats[0] && viewStats[0].totalViews) || 0;

            // Update cache with real values
            tiktokProfileCache = {
                followers: profileStats.followers,
                likes: profileStats.likes,
                views: totalViews,
                updatedAt: now
            };

            res.json({
                followers: profileStats.followers,
                likes: profileStats.likes,
                views: totalViews
            });
        } else {
            // Both sources failed — return cached baseline followers (59M) + baseline likes (781M) + DB aggregated views
            console.log("[tiktok-data] All sources failed, using cached baseline followers + baseline likes + DB aggregated views");
            
            const stats = await Video.aggregate([
                { $match: { webVideoUrl: handleRegex("omari.to"), isActive: true } },
                { $group: { _id: null, totalViews: { $sum: "$views" } } }
            ]);
            
            const totalViews = (stats[0] && stats[0].totalViews) || 0;

            // Update cache with baseline followers + baseline likes + DB views
            tiktokProfileCache = {
                followers: tiktokProfileCache.followers, // Keep baseline (59M)
                likes: tiktokProfileCache.likes, // Keep baseline (781M)
                views: totalViews,
                updatedAt: now
            };

            res.json({
                followers: tiktokProfileCache.followers,
                likes: tiktokProfileCache.likes,
                views: totalViews
            });
        }
    } catch (err) {
        console.error("GET /tiktok-data error:", err);
        // On error, return cached baseline followers if available
        res.json({ 
            followers: tiktokProfileCache.followers || 59000000, 
            likes: tiktokProfileCache.likes || 0, 
            views: tiktokProfileCache.views || 0 
        });
    }
});

// =======================
// POST /tiktok-data/update
// Admin endpoint to manually update @omari.to follower/like counts
// Body: { followers: <number>, likes: <number> }
// =======================
router.post("/tiktok-data/update", async (req, res) => {
    try {
        const { followers, likes } = req.body;
        
        if (followers === undefined && likes === undefined) {
            return res.status(400).json({ success: false, error: "Provide followers and/or likes" });
        }
        
        if (followers !== undefined && (isNaN(Number(followers)) || Number(followers) < 0)) {
            return res.status(400).json({ success: false, error: "followers must be a positive number" });
        }
        if (likes !== undefined && (isNaN(Number(likes)) || Number(likes) < 0)) {
            return res.status(400).json({ success: false, error: "likes must be a positive number" });
        }

        const now = Date.now();
        
        // Get current aggregated views from DB
        const stats = await Video.aggregate([
            { $match: { webVideoUrl: handleRegex("omari.to"), isActive: true } },
            { $group: { _id: null, totalViews: { $sum: "$views" } } }
        ]);
        const totalViews = (stats[0] && stats[0].totalViews) || 0;

        // Update cache
        tiktokProfileCache = {
            followers: followers !== undefined ? Number(followers) : tiktokProfileCache.followers,
            likes: likes !== undefined ? Number(likes) : tiktokProfileCache.likes,
            views: totalViews,
            updatedAt: now
        };

        console.log("[tiktok-data] Manual update:", { 
            followers: tiktokProfileCache.followers, 
            likes: tiktokProfileCache.likes,
            views: totalViews 
        });

        res.json({ 
            success: true, 
            followers: tiktokProfileCache.followers,
            likes: tiktokProfileCache.likes,
            views: totalViews,
            updatedAt: new Date(now).toISOString()
        });
    } catch (err) {
        console.error("POST /tiktok-data/update error:", err);
        res.status(500).json({ success: false, error: "Failed to update stats" });
    }
});

// =======================
// GET /omari-ranking
// Dynamic influencer rankings for the About page.
// Uses rankingService for dynamic fetching with RapidAPI fallback
// =======================
router.get("/omari-ranking", async (req, res) => {
    try {
        const result = await getRankings();
        res.json(result);
    } catch (err) {
        console.error("GET /omari-ranking error:", err);
        res.json({
            success: false,
            rankings: { asia: null, world: null, kazakhstan: null },
            lastUpdated: null
        });
    }
});

// =======================
// POST /omari-ranking/update
// Admin endpoint to update a single ranking value in the database.
// Body: { platform: "tiktok_asia"|"tiktok_world"|"tiktok_kazakhstan", rank: <number> }
// =======================
router.post("/omari-ranking/update", async (req, res) => {
    try {
        const { platform, rank } = req.body;
        const result = await updateRanking(platform, rank);
        res.json(result);
    } catch (err) {
        console.error("POST /omari-ranking/update error:", err);
        res.status(500).json({ success: false, error: err.message || "Failed to update ranking" });
    }
});

// =======================
// GET /omari-videos
// Paginated video list for @omari.to
// =======================
router.get("/omari-videos", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
        const skip = (page - 1) * limit;

        const query = {
            isActive: true,
            webVideoUrl: handleRegex("omari.to")
        };

        const [docs, total] = await Promise.all([
            Video.find(query).sort({ createTime: -1 }).skip(skip).limit(limit).lean(),
            Video.countDocuments(query)
        ]);

        const videos = docs.map(mapVideoDoc);

        res.json({
            success: true,
            videos,
            page,
            limit,
            total,
            hasMore: skip + videos.length < total
        });
    } catch (err) {
        console.error("GET /omari-videos error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch videos" });
    }
});

// =======================
// GET /tiktok-thumbnail
// Proxy / redirect to a valid thumbnail image
// Uses thumbnailService for robust fallback chain: stored URL -> oEmbed -> page scrape
// =======================
router.get("/tiktok-thumbnail", async (req, res) => {
    try {
        const id = String(req.query.id || "").trim();
        if (!id) return res.status(400).send("Missing id");

        const doc = await Video.findOne({
            $or: [{ videoId: id }, { tiktok_id: id }],
            isActive: true
        }).lean();

        if (!doc) {
            // Return a 1x1 transparent PNG rather than a broken image icon
            return res.redirect("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+kAAAANSURBVBhXY2BgYPgPAAEEAQB9IGQNAAAAAElFTkSuQmCC");
        }

        const thumb = doc.thumbnail || "";

        // Check if the stored thumbnail URL is still usable
        if (isUsable(thumb)) {
            return res.redirect(thumb);
        }

        // Stored URL expired or unusable — try to get fresh thumbnail
        if (doc.webVideoUrl) {
            try {
                console.log("[tiktok-thumbnail] Fetching fresh thumbnail for:", doc.videoId);
                const freshThumb = await fetchFreshThumbnail(doc.webVideoUrl);
                
                if (freshThumb) {
                    // Update the stored thumbnail for next time
                    Video.updateOne(
                        { videoId: doc.videoId },
                        { $set: { thumbnail: freshThumb } }
                    ).catch(() => { });
                    return res.redirect(freshThumb);
                }
            } catch (e) {
                console.error("[tiktok-thumbnail] Thumbnail refresh failed:", e.message);
            }
        }

        // If stored URL exists but is expired, still try it as last resort
        if (thumb) {
            console.log("[tiktok-thumbnail] Using expired URL as fallback:", thumb.substring(0, 60));
            return res.redirect(thumb);
        }

        // Final fallback: transparent pixel
        console.log("[tiktok-thumbnail] No thumbnail available, using transparent fallback");
        res.redirect("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+kAAAANSURBVBhXY2BgYPgPAAEEAQB9IGQNAAAAAElFTkSuQmCC");
    } catch (err) {
        console.error("GET /tiktok-thumbnail error:", err);
        res.status(500).send("Thumbnail error");
    }
});

// =======================
// GET /tiktok-upnext
// Up Next recommendations (mixed allowed creators, $sample)
// =======================
router.get("/tiktok-upnext", async (req, res) => {
    try {
        const limit      = Math.min(20, Math.max(1, parseInt(req.query.limit) || 8));
        const exclude    = String(req.query.exclude    || "").trim();
        const playlistId = String(req.query.playlistId || "").trim();

        // Build the allowlist pipeline: match ANY of the allowed accounts
        const matchStage = {
            isActive: true,
            $or: ALLOWED_USERNAMES.map(u => ({ webVideoUrl: handleRegex(u) }))
        };

        // Exclude the currently playing video
        if (exclude) {
            matchStage.$and = [
                { videoId:    { $ne: exclude } },
                { tiktok_id:  { $ne: exclude } }
            ];
        }

        const pipeline = [{ $match: matchStage }];

        if (playlistId && OFFICIAL_PLAYLIST_IDS && OFFICIAL_PLAYLIST_IDS[playlistId]) {
            // Prefer videos from the same playlist first, then fill with others.
            // Use a two-query approach: same-playlist videos first, then random fill.
            const playlistMatchStage = { ...matchStage, playlistIds: playlistId };
            
            const samePlaylist = await Video.aggregate([
                { $match: playlistMatchStage },
                { $sample: { size: limit } }
            ]);
            
            if (samePlaylist.length >= limit) {
                return res.json({ success: true, videos: samePlaylist.map(mapVideoDoc) });
            }
            
            // Fill remaining slots with other allowed videos
            const excludeIds = samePlaylist.map(v => v.videoId);
            const otherMatch = {
                ...matchStage,
                videoId: { $nin: excludeIds },
                playlistIds: { $ne: playlistId }
            };
            const remaining = await Video.aggregate([
                { $match: otherMatch },
                { $sample: { size: limit - samePlaylist.length } }
            ]);
            
            const docs = [...samePlaylist, ...remaining];
            return res.json({ success: true, videos: docs.map(mapVideoDoc) });
        } else {
            // Random sample when no playlist context
            pipeline.push({ $sample: { size: limit } });
        }

        pipeline.push({ $limit: limit });

        const docs   = await Video.aggregate(pipeline);
        const videos = docs.map(mapVideoDoc);

        res.json({ success: true, videos });
    } catch (err) {
        console.error("GET /tiktok-upnext error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch recommendations" });
    }
});

// =======================
// GET /tiktok-playlists
// Returns the official playlist definitions with current DB counts
// =======================
router.get("/tiktok-playlists", async (req, res) => {
    try {
        const playlists = [
            { id: "7433667529204828933", name: "OMARITO.WOW" },
            { id: "7433396735386405638", name: "OMARITO.WORLD" },
            { id: "7433392358749653766", name: "OMARITO.CHEF" }
        ];
        const withCounts = await Promise.all(playlists.map(async p => ({
            ...p,
            count: await Video.countDocuments({ playlistIds: p.id, isActive: true })
        })));
        res.json({ success: true, playlists: withCounts });
    } catch (err) {
        console.error("GET /tiktok-playlists error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch playlists" });
    }
});

// =======================
// GET /tiktok-video
// Single video lookup by id (allowlist enforced)
// Returns fresh thumbnail via thumbnailService fallback chain
// =======================
router.get("/tiktok-video", async (req, res) => {
    try {
        const id = String(req.query.id || "").trim();
        if (!id) return res.json({ success: false, error: "Missing id" });

        const doc = await Video.findOne({
            $or: [
                { videoId: id },
                { tiktok_id: id }
            ],
            isActive: true
        }).lean();

        if (!doc) {
            return res.json({ success: false, error: "Video not found" });
        }

        // Verify the video belongs to an allowed account
        const isAllowed = ALLOWED_USERNAMES.some(u => handleRegex(u).test(doc.webVideoUrl || ""));
        if (!isAllowed) {
            return res.json({ success: false, error: "Video not from allowed account" });
        }

        const videoData = mapVideoDoc(doc);

        // Ensure thumbnail is fresh (same logic as /tiktok-thumbnail)
        const thumb = videoData.thumbnail || "";
        if (doc.webVideoUrl && !isUsable(thumb)) {
            try {
                const freshThumb = await fetchFreshThumbnail(doc.webVideoUrl);
                if (freshThumb) {
                    videoData.thumbnail = freshThumb;
                    // Update stored thumbnail for next time
                    Video.updateOne(
                        { videoId: doc.videoId },
                        { $set: { thumbnail: freshThumb } }
                    ).catch(() => { });
                }
            } catch (e) {
                console.error("[tiktok-video] Thumbnail refresh failed:", e.message);
            }
        }

        res.json({ success: true, video: videoData });
    } catch (err) {
        console.error("GET /tiktok-video error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch video" });
    }
});

// =======================
// GET /tiktok-play
// Resolve a currently-valid play URL for a video
// Uses thumbnailService for robust fallback: stored URL -> tikwm -> page scrape
// =======================
router.get("/tiktok-play", async (req, res) => {
    try {
        const id = String(req.query.id || "").trim();
        if (!id) return res.json({ success: false, error: "Missing id" });

        const doc = await Video.findOne({
            $or: [
                { videoId: id },
                { tiktok_id: id }
            ],
            isActive: true
        }).lean();

        if (!doc) {
            return res.json({ success: false, error: "Video not found" });
        }

        // Verify allowlist
        const isAllowed = ALLOWED_USERNAMES.some(u => handleRegex(u).test(doc.webVideoUrl || ""));
        if (!isAllowed) {
            return res.json({ success: false, error: "Not allowed" });
        }

        // Check if the stored playUrl is still usable
        let url = doc.playUrl && isStreamUsable(doc.playUrl) ? doc.playUrl : null;

        // If not, try to resolve via thumbnailService (tikwm + page scrape fallback)
        if (!url && doc.webVideoUrl) {
            try {
                const { fetchFreshPlayUrl } = require("../services/thumbnailService");
                url = await fetchFreshPlayUrl(doc.webVideoUrl);
                if (url) {
                    // Cache the fresh play URL
                    Video.updateOne(
                        { videoId: doc.videoId },
                        { $set: { playUrl: url } }
                    ).catch(() => { });
                }
            } catch (e) {
                console.error("Play URL resolve failed:", e.message);
            }
        }

        res.json({
            success: true,
            playUrl: url || null,
            watchUrl: doc.webVideoUrl
        });
    } catch (err) {
        console.error("GET /tiktok-play error:", err);
        res.status(500).json({ success: false, error: "Failed to resolve play URL" });
    }
});

// =======================
// GET /tiktok-grid-videos
// Video grid with creator + optional playlist filtering.
// Playlist filtering uses the official numeric playlist ID stored in
// the playlistIds array — NOT keyword matching on title/hashtags.
// =======================

router.get("/tiktok-grid-videos", async (req, res) => {
    try {
        const username = String(req.query.username || "").replace(/^@/, "").toLowerCase().trim();

        // Accept either a numeric playlist ID (?playlistId=…) OR a legacy
        // name string (?playlist=Omarito.World).  Numeric ID takes priority.
        let playlistId = String(req.query.playlistId || "").trim();
        if (!playlistId) {
            const playlistName = String(req.query.playlist || "").trim();
            playlistId = PLAYLIST_NAME_TO_ID[playlistName] || "";
        }

        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100));
        const skip  = (page - 1) * limit;

        // Reject unknown usernames at the API level
        if (!ALLOWED_USERNAMES.includes(username)) {
            return res.json({ success: true, videos: [], total: 0, hasMore: false });
        }

        // Base query: allowlist enforced via webVideoUrl
        const baseQuery = {
            isActive: true,
            webVideoUrl: handleRegex(username)
        };

        let videos = [];
        let total  = 0;

        if (playlistId) {
            // ── Playlist mode: filter by official playlist ID stored in DB ──
            // Only @omari.to has playlists
            if (username !== "omari.to" || !OFFICIAL_PLAYLIST_IDS[playlistId]) {
                return res.json({ success: true, videos: [], total: 0, hasMore: false,
                    playlistId, playlistName: "" });
            }

            const playlistQuery = { ...baseQuery, playlistIds: playlistId };
            const [docs, cnt] = await Promise.all([
                Video.find(playlistQuery).sort({ createTime: -1 }).skip(skip).limit(limit).lean(),
                Video.countDocuments(playlistQuery)
            ]);
            videos = docs.map(mapVideoDoc);
            total  = cnt;

            return res.json({
                success: true,
                videos,
                playlistId,
                playlistName: OFFICIAL_PLAYLIST_IDS[playlistId] || "",
                page, limit, total,
                hasMore: skip + videos.length < total
            });
        }

        // ── All-creator mode (no playlist) ──
        const [docs, cnt] = await Promise.all([
            Video.find(baseQuery).sort({ createTime: -1 }).skip(skip).limit(limit).lean(),
            Video.countDocuments(baseQuery)
        ]);
        videos = docs.map(mapVideoDoc);
        total  = cnt;

        res.json({
            success: true,
            videos,
            playlistId: null,
            playlistName: null,
            page, limit, total,
            hasMore: skip + videos.length < total
        });
    } catch (err) {
        console.error("GET /tiktok-grid-videos error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch videos" });
    }
});

module.exports = router;
module.exports.loadRankingsCache = loadRankingsFromDB;
