// Temp: identify the 8 persistently-stale thumbnails and probe their TikTok status
require("dotenv").config();
const mongoose = require("mongoose");
const { isUsable } = require("./services/thumbnailService");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const c = mongoose.connection.db.collection("videos");
    const docs = await c.find({ isActive: true }).project({ videoId: 1, thumbnail: 1, webVideoUrl: 1 }).toArray();
    const stale = docs.filter(d => !isUsable(d.thumbnail));
    console.log("stale count:", stale.length);
    for (const d of stale) {
        console.log("-", d.videoId, d.webVideoUrl);
        try {
            const r = await fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(d.webVideoUrl), {
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            const t = await r.text();
            console.log("   oembed:", r.status, t.slice(0, 120));
        } catch (e) {
            console.log("   oembed FAIL:", e.message);
        }
        // also test the local proxy behavior for this id
        try {
            const p = await fetch("http://localhost:3000/tiktok-thumbnail?id=" + d.videoId);
            console.log("   proxy ->", p.status, p.headers.get("content-type"));
        } catch (e) {
            console.log("   proxy FAIL:", e.message);
        }
    }
    await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
