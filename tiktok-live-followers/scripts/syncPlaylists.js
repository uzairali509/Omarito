/**
 * syncPlaylists.js
 * ----------------
 * Synchronises the three official @omari.to TikTok playlists with MongoDB.
 *
 * Official playlists (source of truth):
 *   Wow   – 7433667529204828933  (OMARITO.WOW✈️)       – ~11  posts
 *   World – 7433396735386405638  (OMARITO.WORLD👨🏻‍🎓) – ~199 posts
 *   Chef  – 7433392358749653766  (OMARITO.CHEF🧑🏻‍🍳)  – ~34  posts
 *
 * Strategy
 * --------
 * TikTok's public oEmbed / web pages expose playlist JSON inside the
 * __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag.  We page through the
 * playlist using the cursor/hasMore fields.
 *
 * For each video ID found in the playlist we:
 *   1. Upsert a minimal Video document (if not already present).
 *   2. Ensure the playlistIds array contains this playlist's ID.
 *
 * Usage
 * -----
 *   node scripts/syncPlaylists.js              # sync all three playlists
 *   node scripts/syncPlaylists.js --id=7433667529204828933   # one only
 *
 * This file also exports syncPlaylistsCore() for programmatic use.
 */

require("dotenv").config({ path: __dirname + "/../.env" });

const mongoose = require("mongoose");
const axios    = require("axios");
const Video    = require("../models/Video");

// ── Official playlist definitions ──────────────────────────────────────────
const OFFICIAL_PLAYLISTS = [
    {
        id:   "7433667529204828933",
        name: "OMARITO.WOW✈️",
        slug: "OMARITO.WOW%E2%9C%88%EF%B8%8F",
        url:  "https://www.tiktok.com/@omari.to/playlist/OMARITO.WOW%E2%9C%88%EF%B8%8F-7433667529204828933"
    },
    {
        id:   "7433396735386405638",
        name: "OMARITO.WORLD👨🏻‍🎓",
        slug: "OMARITO.WORLD%F0%9F%91%A8%F0%9F%8F%BB%E2%80%8D%F0%9F%8E%93",
        url:  "https://www.tiktok.com/@omari.to/playlist/OMARITO.WORLD%F0%9F%91%A8%F0%9F%8F%BB%E2%80%8D%F0%9F%8E%93-7433396735386405638"
    },
    {
        id:   "7433392358749653766",
        name: "OMARITO.CHEF🧑🏻‍🍳",
        slug: "OMARITO.CHEF%F0%9F%A7%91%F0%9F%8F%BB%E2%80%8D%F0%9F%8D%B3",
        url:  "https://www.tiktok.com/@omari.to/playlist/OMARITO.CHEF%F0%9F%A7%91%F0%9F%8F%BB%E2%80%8D%F0%9F%8D%B3-7433392358749653766"
    }
];

// ── HTTP helper ─────────────────────────────────────────────────────────────
const http = axios.create({
    timeout: 30000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "application/json, text/plain, */*"
    }
});

// TikTok internal API — fetch one page of a playlist
// Returns { items: [{videoId, webVideoUrl, ...}], cursor, hasMore }
async function fetchPlaylistPage(playlistId, cursor = 0) {
    // Approach 1: TikTok's internal API endpoint
    try {
        const params = {
            mixId: playlistId,
            cursor: cursor,
            count: 50,
            aid: 1988
        };
        const url = "https://www.tiktok.com/api/mix/item_list/?" + Object.entries(params)
            .map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join("&");

        const { data } = await http.get(url, {
            headers: {
                "Referer": `https://www.tiktok.com/@omari.to`,
                "Origin": "https://www.tiktok.com"
            }
        });

        if (data && Array.isArray(data.itemList)) {
            const items = data.itemList.map(normaliseItem).filter(Boolean);
            return { items, cursor: data.cursor || 0, hasMore: !!data.hasMore };
        }
    } catch (e) {
        // Fall through to tikwm approach
    }

    return { items: [], cursor: 0, hasMore: false };
}

// Fetch playlist video IDs via tikwm (third-party TikTok API proxy)
// tikwm supports playlist fetching with pagination
async function fetchPlaylistViaTikwm(playlistId) {
    const allItems = [];
    let cursor = 0;
    let hasMore = true;
    let page = 0;
    const MAX_PAGES = 20; // safety cap

    while (hasMore && page < MAX_PAGES) {
        page++;
        try {
            const url = `https://www.tikwm.com/api/user/mix?mix_id=${encodeURIComponent(playlistId)}&cursor=${cursor}&count=30`;
            const { data } = await http.get(url, { timeout: 25000 });

            if (data && data.data && Array.isArray(data.data.videos)) {
                for (const item of data.data.videos) {
                    const norm = normaliseTikwmItem(item);
                    if (norm) allItems.push(norm);
                }
                hasMore  = !!data.data.hasMore;
                cursor   = data.data.cursor || 0;
                console.log(`   [tikwm] Page ${page}: got ${data.data.videos.length} items, hasMore=${hasMore}, cursor=${cursor}`);
            } else {
                hasMore = false;
            }
        } catch (e) {
            console.error(`   [tikwm] Page ${page} failed:`, e.message);
            hasMore = false;
        }
    }

    return allItems;
}

// ── Normalisation helpers ────────────────────────────────────────────────────

function normaliseItem(item) {
    // TikTok internal API shape
    const id = String(item.id || "").trim();
    if (!id) return null;
    const author = item.author || {};
    const stats  = item.stats  || {};
    const video  = item.video  || {};
    const music  = item.music  || {};
    return {
        videoId:     id,
        tiktok_id:   id,
        webVideoUrl: `https://www.tiktok.com/@${author.uniqueId || "omari.to"}/video/${id}`,
        title:       item.desc || "",
        description: item.desc || "",
        thumbnail:   video.cover || video.originCover || "",
        duration:    Number(video.duration || 0),
        views:       Number(stats.playCount  || 0),
        likes:       Number(stats.diggCount  || 0),
        comments:    Number(stats.commentCount || 0),
        shares:      Number(stats.shareCount || 0),
        saves:       Number(stats.collectCount || 0),
        username:    author.uniqueId || "omari.to",
        creator:     "Omar",
        musicName:   music.title || "",
        musicAuthor: music.authorName || "",
        hashtags:    (item.textExtra || []).filter(t => t.hashtagName).map(t => t.hashtagName),
        createTime:  item.createTime ? new Date(item.createTime * 1000) : new Date(),
        isActive:    true,
        source:      "TikTok"
    };
}

function normaliseTikwmItem(item) {
    // tikwm API shape
    const id = String(item.video_id || item.id || "").trim();
    if (!id) return null;
    const authorName = item.author && item.author.unique_id ? item.author.unique_id : "omari.to";
    return {
        videoId:     id,
        tiktok_id:   id,
        webVideoUrl: `https://www.tiktok.com/@${authorName}/video/${id}`,
        title:       item.title || item.text || "",
        description: item.title || item.text || "",
        thumbnail:   item.cover || item.origin_cover || "",
        duration:    Number(item.duration || 0),
        views:       Number(item.play_count || item.views || 0),
        likes:       Number(item.digg_count || item.likes || 0),
        comments:    Number(item.comment_count || item.comments || 0),
        shares:      Number(item.share_count || item.shares || 0),
        saves:       Number(item.collect_count || 0),
        username:    authorName,
        creator:     "Omar",
        musicName:   item.music && item.music.title ? item.music.title : "",
        musicAuthor: item.music && item.music.author ? item.music.author : "",
        hashtags:    [],
        createTime:  item.create_time ? new Date(item.create_time * 1000) : new Date(),
        isActive:    true,
        source:      "TikTok"
    };
}

// ── Upsert a single video into MongoDB ──────────────────────────────────────
async function upsertVideoWithPlaylist(videoData, playlistId) {
    const filter = { videoId: videoData.videoId };

    // Build the $set payload (everything except playlistIds which we $addToSet)
    const setData = { ...videoData };
    delete setData.playlistIds; // handled separately

    await Video.findOneAndUpdate(
        filter,
        {
            $set:      setData,
            $addToSet: { playlistIds: playlistId }
        },
        { upsert: true, runValidators: false }
    );
}

// ── Sync one playlist ────────────────────────────────────────────────────────
async function syncOnePlaylist(playlist) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Syncing: ${playlist.name}`);
    console.log(`ID: ${playlist.id}`);
    console.log(`URL: ${playlist.url}`);
    console.log("=".repeat(60));

    // First try tikwm (most reliable for playlist content with pagination)
    let items = await fetchPlaylistViaTikwm(playlist.id);

    // Fall back to direct TikTok API if tikwm returns nothing
    if (!items.length) {
        console.log("   tikwm returned 0 items, trying TikTok internal API...");
        let cursor  = 0;
        let hasMore = true;
        let page    = 0;

        while (hasMore && page < 50) {
            page++;
            const result = await fetchPlaylistPage(playlist.id, cursor);
            items = items.concat(result.items);
            cursor  = result.cursor;
            hasMore = result.hasMore;
            console.log(`   [direct] Page ${page}: got ${result.items.length} items, cursor=${cursor}, hasMore=${hasMore}`);
            if (!result.items.length || !cursor) break;
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
    }

    console.log(`\n   Total items fetched: ${items.length}`);

    if (!items.length) {
        console.log("   ⚠️  No items found for this playlist. The API may be rate-limited or the playlist is private.");
        return { playlistId: playlist.id, name: playlist.name, fetched: 0, upserted: 0 };
    }

    let upserted = 0;
    for (const item of items) {
        try {
            await upsertVideoWithPlaylist(item, playlist.id);
            upserted++;
        } catch (err) {
            console.error(`   Error upserting ${item.videoId}:`, err.message);
        }
    }

    console.log(`   ✅ Upserted ${upserted}/${items.length} videos for playlist ${playlist.name}`);

    // Verify database state
    const dbCount = await Video.countDocuments({ playlistIds: playlist.id });
    console.log(`   📊 DB now has ${dbCount} videos tagged with playlist ${playlist.id}`);

    return { playlistId: playlist.id, name: playlist.name, fetched: items.length, upserted, dbCount };
}

// ── Core sync function (exported for programmatic use) ───────────────────────
async function syncPlaylistsCore(options = {}) {
    const { disconnectAfter = true, specificId = null } = options;

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const playlists = specificId
        ? OFFICIAL_PLAYLISTS.filter(p => p.id === specificId)
        : OFFICIAL_PLAYLISTS;

    if (!playlists.length) {
        console.error(`No playlist found with id: ${specificId}`);
        if (disconnectAfter) await mongoose.disconnect();
        return [];
    }

    const results = [];
    for (const playlist of playlists) {
        const result = await syncOnePlaylist(playlist);
        results.push(result);
    }

    console.log("\n\n" + "=".repeat(60));
    console.log("PLAYLIST SYNC SUMMARY");
    console.log("=".repeat(60));
    results.forEach(r => {
        console.log(`${r.name}`);
        console.log(`  ID      : ${r.playlistId}`);
        console.log(`  Fetched : ${r.fetched}`);
        console.log(`  Upserted: ${r.upserted}`);
        console.log(`  In DB   : ${r.dbCount || "N/A"}`);
    });
    console.log("=".repeat(60));

    if (disconnectAfter) {
        await mongoose.disconnect();
        console.log("🔒 MongoDB Disconnected");
    }

    return results;
}

// ── Manual run ───────────────────────────────────────────────────────────────
if (require.main === module) {
    const args = process.argv.slice(2);
    const idArg = args.find(a => a.startsWith("--id="));
    const specificId = idArg ? idArg.replace("--id=", "") : null;

    syncPlaylistsCore({ disconnectAfter: true, specificId })
        .then(() => process.exit(0))
        .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { syncPlaylistsCore, OFFICIAL_PLAYLISTS };
