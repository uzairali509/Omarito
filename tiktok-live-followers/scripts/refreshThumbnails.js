require("dotenv").config();

const axios = require("axios");
const mongoose = require("mongoose");
const Video = require("../models/Video");
const { isUsable } = require("../services/thumbnailService");

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

// oEmbed is lightweight; a few parallel workers are safe
const CONCURRENCY = 5;
const DELAY_MS = 150;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Bulk warmup uses oEmbed ONLY (page scraping gets rate-limited fast;
// the on-demand /tiktok-thumbnail proxy keeps scraping as fallback).
async function refreshViaOEmbed(webVideoUrl) {
    const { data } = await axios.get("https://www.tiktok.com/oembed", {
        params: { url: webVideoUrl },
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 15000
    });
    return (data && data.thumbnail_url) || null;
}

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const docs = await Video.find({
        isActive: true,
        webVideoUrl: { $in: ALLOWED_USERNAMES.map(handleRegex) }
    })
        .select("videoId thumbnail webVideoUrl")
        .lean();

    const stale = docs.filter(d => !isUsable(d.thumbnail));
    console.log(`active videos: ${docs.length}, stale thumbnails: ${stale.length}`);

    let ok = 0;
    let failed = 0;
    let cursor = 0;

    async function worker() {
        while (cursor < stale.length) {
            const i = cursor++;
            const doc = stale[i];
            try {
                const fresh = await refreshViaOEmbed(doc.webVideoUrl);
                if (fresh) {
                    await Video.updateOne(
                        { videoId: doc.videoId },
                        { $set: { thumbnail: fresh } }
                    );
                    ok++;
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
            }
            if ((ok + failed) % 25 === 0) {
                console.log(`progress: ${ok + failed}/${stale.length} (ok=${ok}, failed=${failed})`);
            }
            await sleep(DELAY_MS);
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    console.log(`done: refreshed=${ok}, failed=${failed}`);
    await mongoose.disconnect();
})().catch(err => {
    console.error("refreshThumbnails error:", err);
    process.exit(1);
});
