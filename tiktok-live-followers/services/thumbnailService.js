const axios = require("axios");
const Video = require("../models/Video");

// ===============================
// TIKTOK THUMBNAIL REFRESH
// TikTok CDN thumbnail URLs are SIGNED and expire (x-expires).
// Apify-synced docs store the URL from scrape time, so after a few
// days every thumbnail 403s. The public video page however serves a
// fresh signed image URL, so we scrape it server-side on demand,
// store it back on the doc and reuse it until it expires again.
// ===============================

const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// In-flight dedup: never scrape the same video twice in parallel
const pending = new Map();

/**
 * Epoch seconds from the x-expires query param of a signed CDN URL.
 * Returns null when the URL carries no expiry information.
 */
function parseExpiry(url) {
    const m = String(url || "").match(/x-expires=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * true when the stored thumbnail is still usable for at least minHours.
 * URLs without x-expires are treated as non-expiring.
 */
function isUsable(url, minHours = 1) {
    if (!url || !/^https?:\/\//.test(url)) return false;
    const exp = parseExpiry(url);
    if (exp === null) return true;
    return exp > Math.floor(Date.now() / 1000) + minHours * 3600;
}

/**
 * Extract a signed TikTok CDN image URL from a video page's HTML.
 * Handles both raw URLs and HTML-entity-escaped ones (&amp;).
 */
function extractImageUrl(html) {
    const candidates =
        html.match(
            /https?:\/\/[a-z0-9.-]*tiktokcdn[a-z0-9.-]*\.com\/[^"'\s<>\\]+?\.image[^"'\s<>\\]*/gi
        ) || [];

    for (const raw of candidates) {
        const clean = raw
            .replace(/&amp;/g, "&")
            .replace(/\\u002F/g, "/")
            .replace(/\\\//g, "/");
        if (parseExpiry(clean) !== null) return clean;
    }

    // Fallback: first candidate even without expiry info
    if (candidates.length) {
        return candidates[0].replace(/&amp;/g, "&");
    }
    return null;
}

/**
 * Scrape the public TikTok video page for a fresh signed image URL.
 */
async function scrapeFreshThumbnail(webVideoUrl) {
    const { data: html } = await axios.get(webVideoUrl, {
        headers: { "User-Agent": BROWSER_UA },
        timeout: 15000
    });
    return extractImageUrl(html);
}

/**
 * Preferred refresh path: TikTok's public oEmbed endpoint returns the
 * current signed thumbnail as JSON (lightweight and not rate-limited
 * like full page fetches). Falls back to page scraping.
 */
async function fetchFreshThumbnail(webVideoUrl) {
    try {
        const { data } = await axios.get(
            "https://www.tiktok.com/oembed",
            {
                params: { url: webVideoUrl },
                headers: { "User-Agent": BROWSER_UA },
                timeout: 15000
            }
        );
        if (data && data.thumbnail_url) return data.thumbnail_url;
    } catch (err) {
        // fall through to page scrape
    }
    return scrapeFreshThumbnail(webVideoUrl);
}

/**
 * Return a currently-valid thumbnail URL for a video doc.
 * Uses the stored URL while valid; otherwise scrapes the video page
 * and persists the fresh URL back to the doc.
 */
function getUsableThumbnail(video) {
    if (isUsable(video.thumbnail)) {
        return Promise.resolve(video.thumbnail);
    }

    if (!video.webVideoUrl) {
        return Promise.resolve(null);
    }

    const key = String(video.videoId);
    if (pending.has(key)) {
        return pending.get(key);
    }

    const task = (async () => {
        try {
            const fresh = await fetchFreshThumbnail(video.webVideoUrl);
            if (fresh) {
                await Video.updateOne(
                    { videoId: video.videoId },
                    { $set: { thumbnail: fresh } }
                ).catch(() => {});
            }
            return fresh;
        } finally {
            pending.delete(key);
        }
    })();

    pending.set(key, task);
    return task;
}

/**
 * Extract a signed TikTok video-stream URL (mp4) from a video page's
 * HTML. Handles raw, HTML-entity-escaped and JSON-escaped variants.
 */
function extractPlayUrl(html) {
    const candidates =
        html.match(/https?:\/\/[a-z0-9.-]*tiktokcdn[a-z0-9.-]*\.com\/[^"'\s<>\\]+?\.mp4[^"'\s<>\\]*/gi) || [];

    for (const raw of candidates) {
        const clean = raw
            .replace(/&amp;/g, "&")
            .replace(/\\u002F/g, "/")
            .replace(/\\\//g, "/");
        if (parseExpiry(clean) !== null) return clean;
    }
    if (candidates.length) {
        return candidates[0].replace(/&amp;/g, "&");
    }
    return null;
}

/**
 * Epoch seconds embedded in a signed tiktokcdn stream path, e.g.
 * https://v45.tiktokcdn-us.com/<signature>/<hex-epoch>/video/...
 * Used as fallback expiry when the URL has no x-expires param.
 */
function parseCdnPathExpiry(url) {
    const m = String(url || "").match(/tiktokcdn[a-z0-9.-]*\.com\/[^/]+\/([0-9a-f]{7,9})\//i);
    if (!m) return null;
    const exp = parseInt(m[1], 16);
    // sanity: must be a plausible epoch (after 2020, before 2100)
    if (exp > 1577836800 && exp < 4102444800) return exp;
    return null;
}

/**
 * true when the stored stream URL is still usable for at least minHours.
 * Checks x-expires first, then the epoch embedded in the CDN path.
 */
function isStreamUsable(url, minHours = 0.25) {
    if (!url || !/^https?:\/\//.test(url)) return false;
    let exp = parseExpiry(url);
    if (exp === null) exp = parseCdnPathExpiry(url);
    if (exp === null) return true;
    return exp > Math.floor(Date.now() / 1000) + minHours * 3600;
}

/**
 * Preferred stream source: public TikTok resolvers (tikwm.com) return a
 * fresh signed mp4 CDN URL as JSON. TikTok's own video pages now serve
 * a WAF bot-challenge to server-side fetches, so scraping rarely works.
 */
async function fetchPlayUrlViaResolver(webVideoUrl) {
    try {
        const { data } = await axios.get("https://www.tikwm.com/api/", {
            params: { url: webVideoUrl },
            headers: { "User-Agent": BROWSER_UA },
            timeout: 15000
        });
        if (data && data.code === 0 && data.data) {
            return data.data.play || data.data.hdplay || null;
        }
    } catch (err) {
        // fall through to page scrape
    }
    return null;
}

/**
 * Resolve a currently-valid stream URL for a video.
 * Tries the resolver first, then falls back to scraping the public
 * video page. Returns null when no usable stream can be found
 * (deleted videos, bot-walls) — the frontend then falls back to the
 * "Watch on TikTok" link.
 */
async function fetchFreshPlayUrl(webVideoUrl) {
    const viaResolver = await fetchPlayUrlViaResolver(webVideoUrl);
    if (viaResolver) return viaResolver;
    try {
        const { data: html } = await axios.get(webVideoUrl, {
            headers: { "User-Agent": BROWSER_UA },
            timeout: 15000
        });
        return extractPlayUrl(html);
    } catch (err) {
        return null;
    }
}

module.exports = {
    parseExpiry,
    isUsable,
    isStreamUsable,
    extractImageUrl,
    scrapeFreshThumbnail,
    fetchFreshThumbnail,
    getUsableThumbnail,
    extractPlayUrl,
    fetchFreshPlayUrl
};
