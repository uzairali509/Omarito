const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Video = require("../models/Video");
const { fetchFreshThumbnail, isUsable, isStreamUsable } = require("../services/thumbnailService");
const { getRankings, updateRanking } = require("../services/rankingService");

// Cache file path for account statistics
const ACCOUNT_STATS_CACHE_FILE = path.join(__dirname, "..", "accountStatsCache.json");

// Read account stats from cache file
function readAccountStatsCache() {
    try {
        if (fs.existsSync(ACCOUNT_STATS_CACHE_FILE)) {
            const data = fs.readFileSync(ACCOUNT_STATS_CACHE_FILE, "utf8");
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("[tiktok-data] Failed to read cache file:", e.message);
    }
    return null;
}

// Write account stats to cache file
function writeAccountStatsCache(data) {
    try {
        fs.writeFileSync(ACCOUNT_STATS_CACHE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("[tiktok-data] Failed to write cache file:", e.message);
    }
}

// Load cache from file on startup (NO static baselines)
let tiktokProfileCache = readAccountStatsCache() || {
    followers: 0,
    likes: 0,
    views: 0,
    updatedAt: null,
    source: "none"
};

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
        hashtags: doc.hashtags || [],
        platform: doc.platform || "tiktok",
        isShort: doc.isShort || false
    };
}

// =======================
// GET /tiktok-data
// Homepage follower + like counts for @omari.to
// Data is refreshed by cron job (scripts/refreshAccountStats.js) via Apify
// =======================

router.get("/tiktok-data", async (req, res) => {
    try {
        // Always read fresh from cache file to get latest refreshed values
        const fileCache = readAccountStatsCache();
        if (fileCache) {
            tiktokProfileCache = fileCache;
        }

        // If no valid data ever fetched, return updating state
        if (!tiktokProfileCache.followers || !tiktokProfileCache.likes) {
            return res.json({
                followers: 0,
                likes: 0,
                views: 0,
                updating: true
            });
        }

        // Return cached stats (refreshed by cron job every 6 hours via Apify)
        const viewStats = await Video.aggregate([
            { $match: { webVideoUrl: handleRegex("omari.to"), isActive: true } },
            { $group: { _id: null, totalViews: { $sum: "$views" } } }
        ]);
        const totalViews = (viewStats[0] && viewStats[0].totalViews) || 0;

        res.json({
            followers: tiktokProfileCache.followers,
            likes: tiktokProfileCache.likes,
            views: totalViews,
            updatedAt: tiktokProfileCache.updatedAt,
            source: tiktokProfileCache.source
        });
    } catch (err) {
        console.error("GET /tiktok-data error:", err);
        // On error, try to read from cache file
        const fileCache = readAccountStatsCache();
        if (fileCache && fileCache.followers && fileCache.likes) {
            return res.json({
                followers: fileCache.followers,
                likes: fileCache.likes,
                views: fileCache.views || 0,
                updatedAt: fileCache.updatedAt,
                source: fileCache.source
            });
        }
        // No valid data available
        res.json({
            followers: 0,
            likes: 0,
            views: 0,
            updating: true
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
            updatedAt: now,
            source: "admin"
        };
        writeAccountStatsCache(tiktokProfileCache);

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
            $or: [
                { platform: "tiktok" },
                { platform: { $exists: false } }
            ],
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
            isActive: true,
            $and: [
                { $or: [ { platform: "tiktok" }, { platform: { $exists: false } } ] }
            ]
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
        // Include legacy records without platform field
        // Filter out audio-only/photo-mode videos
        const baseMatchStage = {
            isActive: true,
            $and: [
                { $or: [ { platform: "tiktok" }, { platform: { $exists: false } } ] },
                { $or: ALLOWED_USERNAMES.map(u => ({ webVideoUrl: handleRegex(u) })) },
                { duration: { $gt: 0 } },
                { $or: [
                    { thumbnail: { $not: /photomode-image/ } },
                    { thumbnail: { $exists: false } },
                    { thumbnail: "" }
                ]}
            ]
        };

        const matchStage = { ...baseMatchStage };

        // Exclude the currently playing video
        if (exclude) {
            matchStage.$and = [
                ...matchStage.$and,
                { videoId:    { $ne: exclude } },
                { tiktok_id:  { $ne: exclude } }
            ];
        }

        const pipeline = [{ $match: matchStage }];

        if (playlistId && OFFICIAL_PLAYLIST_IDS && OFFICIAL_PLAYLIST_IDS[playlistId]) {
            // Prefer videos from the same playlist first, then fill with others.
            // Use a two-query approach: same-playlist videos first, then random fill.
            const playlistMatchStage = { ...baseMatchStage, playlistIds: playlistId };
            
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
                ...baseMatchStage,
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
            count: await Video.countDocuments({ playlistIds: p.id, isActive: true, platform: "tiktok" })
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
            isActive: true,
            $and: [
                { $or: [ { platform: "tiktok" }, { platform: { $exists: false } } ] }
            ]
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
            isActive: true,
            $and: [
                { $or: [ { platform: "tiktok" }, { platform: { $exists: false } } ] }
            ]
        }).lean();

        if (!doc) {
            return res.json({ success: false, error: "Video not found" });
        }

        // Verify allowlist
        const isAllowed = ALLOWED_USERNAMES.some(u => handleRegex(u).test(doc.webVideoUrl || ""));
        if (!isAllowed) {
            return res.json({ success: false, error: "Not allowed" });
        }

        // Always try to get a fresh playable URL from the resolver (tikwm.com)
        // TikTok CDN URLs are signed, IP-bound, and can return 503/403 even before timestamp expiry.
        // The resolver (tikwm.com) returns a fresh working CDN URL on each request.
        let url = null;
        if (doc.webVideoUrl) {
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

        // Fallback to stored playUrl only if resolver fails and stored URL appears usable
        if (!url && doc.playUrl && isStreamUsable(doc.playUrl)) {
            url = doc.playUrl;
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
// GET /tiktok-video-proxy
// Proxy TikTok video stream with required headers (Referer, Origin)
// TikTok CDN requires these headers, which browser <video> element cannot send
// =======================
router.get("/tiktok-video-proxy", async (req, res) => {
    try {
        const id = String(req.query.id || "").trim();
        if (!id) return res.status(400).json({ success: false, error: "Missing id" });

        const doc = await Video.findOne({
            $or: [
                { videoId: id },
                { tiktok_id: id }
            ],
            isActive: true,
            $and: [
                { $or: [ { platform: "tiktok" }, { platform: { $exists: false } } ] }
            ]
        }).lean();

        if (!doc) {
            return res.status(404).json({ success: false, error: "Video not found" });
        }

        // Verify allowlist
        const isAllowed = ALLOWED_USERNAMES.some(u => handleRegex(u).test(doc.webVideoUrl || ""));
        if (!isAllowed) {
            return res.status(403).json({ success: false, error: "Not allowed" });
        }

        // Get fresh play URL
        let url = null;
        if (doc.webVideoUrl) {
            try {
                const { fetchFreshPlayUrl } = require("../services/thumbnailService");
                url = await fetchFreshPlayUrl(doc.webVideoUrl);
            } catch (e) {
                console.error("Play URL resolve failed:", e.message);
            }
        }
        if (!url && doc.playUrl && isStreamUsable(doc.playUrl)) {
            url = doc.playUrl;
        }
        if (!url) {
            return res.status(404).json({ success: false, error: "No playable stream found" });
        }

        // Proxy the video with required headers
        const axios = require("axios");
        const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
        
        const videoRes = await axios.get(url, {
            responseType: "stream",
            headers: {
                "User-Agent": BROWSER_UA,
                "Referer": "https://www.tiktok.com/",
                "Origin": "https://www.tiktok.com"
            },
            timeout: 30000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Forward relevant headers
        res.set({
            "Content-Type": videoRes.headers["content-type"] || "video/mp4",
            "Content-Length": videoRes.headers["content-length"],
            "Accept-Ranges": videoRes.headers["accept-ranges"] || "bytes",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range"
        });

        // Handle range requests for video seeking
        const range = req.headers.range;
        if (range && videoRes.headers["accept-ranges"] === "bytes") {
            res.set("Content-Range", videoRes.headers["content-range"] || range);
            res.status(206);
        }

        videoRes.data.pipe(res);
        
        videoRes.data.on("error", (err) => {
            console.error("[tiktok-video-proxy] Stream error:", err.message);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

    } catch (err) {
        console.error("GET /tiktok-video-proxy error:", err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: "Failed to proxy video" });
        }
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
        // Match platform: "tiktok" OR platform doesn't exist (backward compat)
        // Filter out audio-only/photo-mode videos
        const baseQuery = {
            isActive: true,
            $or: [
                { platform: "tiktok" },
                { platform: { $exists: false } }
            ],
            webVideoUrl: handleRegex(username),
            duration: { $gt: 0 },
            $or: [
                { thumbnail: { $not: /photomode-image/ } },
                { thumbnail: { $exists: false } },
                { thumbnail: "" }
            ]
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

// =======================
// GET /tiktok-all-videos
// Fetch TikTok videos from ALL allowed creators combined (for "All" view)
// =======================
router.get("/tiktok-all-videos", async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100));
        const skip  = (page - 1) * limit;

        // Build query matching ANY allowed creator
        // Match platform: "tiktok" OR platform doesn't exist (backward compat)
        // Filter out audio-only/photo-mode videos
        const matchStage = {
            isActive: true,
            $and: [
                { $or: [ { platform: "tiktok" }, { platform: { $exists: false } } ] },
                { $or: ALLOWED_USERNAMES.map(u => ({ webVideoUrl: handleRegex(u) })) },
                { duration: { $gt: 0 } },
                { $or: [
                    { thumbnail: { $not: /photomode-image/ } },
                    { thumbnail: { $exists: false } },
                    { thumbnail: "" }
                ]}
            ]
        };

        const [docs, total] = await Promise.all([
            Video.find(matchStage).sort({ createTime: -1 }).skip(skip).limit(limit).lean(),
            Video.countDocuments(matchStage)
        ]);

        const videos = docs.map(mapVideoDoc);

        res.json({
            success: true,
            videos,
            page, limit, total,
            hasMore: skip + videos.length < total
        });
    } catch (err) {
        console.error("GET /tiktok-all-videos error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch videos" });
    }
});

// =======================
// GET /youtube-videos
// Fetch YouTube videos (regular and Shorts) with platform filtering
// =======================
router.get("/youtube-videos", async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100));
        const skip  = (page - 1) * limit;
        const type  = String(req.query.type || "").toLowerCase(); // "all", "videos", "shorts"

        const matchStage = {
            isActive: true,
            platform: "youtube"
        };

        if (type === "videos") {
            matchStage.isShort = { $ne: true };
        } else if (type === "shorts") {
            matchStage.isShort = true;
        }

        const [docs, total] = await Promise.all([
            Video.find(matchStage).sort({ createTime: -1 }).skip(skip).limit(limit).lean(),
            Video.countDocuments(matchStage)
        ]);

        const videos = docs.map(mapVideoDoc);

        res.json({
            success: true,
            videos,
            page, limit, total,
            hasMore: skip + videos.length < total
        });
    } catch (err) {
        console.error("GET /youtube-videos error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch YouTube videos" });
    }
});

// =======================
// GET /youtube-video
// Single YouTube video lookup by id
// =======================
router.get("/youtube-video", async (req, res) => {
    try {
        const id = String(req.query.id || "").trim();
        if (!id) return res.json({ success: false, error: "Missing id" });

        const doc = await Video.findOne({
            videoId: id,
            platform: "youtube",
            isActive: true
        }).lean();

        if (!doc) {
            return res.json({ success: false, error: "Video not found" });
        }

        const videoData = mapVideoDoc(doc);
        res.json({ success: true, video: videoData });
    } catch (err) {
        console.error("GET /youtube-video error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch video" });
    }
});

// =======================
// GET /notifications
// Returns recent video updates for the notification panel
// =======================
router.get("/notifications", async (req, res) => {
    try {
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
        
        // Build the allowlist pipeline: match ANY of the allowed accounts for TikTok
        // Also include YouTube videos
        const tiktokMatch = {
            isActive: true,
            platform: "tiktok",
            $or: ALLOWED_USERNAMES.map(u => ({ webVideoUrl: handleRegex(u) }))
        };
        
        const youtubeMatch = {
            isActive: true,
            platform: "youtube"
        };
        
        // Fetch both TikTok and YouTube videos, sorted by createTime
        const [tiktokDocs, youtubeDocs] = await Promise.all([
            Video.find(tiktokMatch).sort({ createTime: -1 }).limit(limit).lean(),
            Video.find(youtubeMatch).sort({ createTime: -1 }).limit(limit).lean()
        ]);
        
        // Combine and sort by createTime descending
        const allDocs = [...tiktokDocs, ...youtubeDocs]
            .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
            .slice(0, limit);
        
        const notifications = allDocs.map(doc => ({
            videoId: doc.videoId || doc.tiktok_id,
            creator: doc.creator,
            username: doc.username,
            title: doc.title || doc.description || '',
            thumbnail: doc.thumbnail,
            createTime: doc.createTime,
            platform: doc.platform || 'tiktok',
            creatorAvatar: doc.avatar
        }));
        
        res.json({ success: true, notifications });
    } catch (err) {
        console.error("GET /notifications error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch notifications" });
    }
});

module.exports = router;
