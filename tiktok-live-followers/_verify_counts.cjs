require("dotenv").config();
const mongoose = require("mongoose");

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const c = mongoose.connection.db.collection("videos");
    const H = ["omari.to", "dilandyalieva", "hello.safia"];

    console.log("total:", await c.countDocuments());
    console.log("active:", await c.countDocuments({ isActive: true }));

    for (const h of H) {
        const re = new RegExp(
            "^https?://(?:[a-z0-9.-]+\\.)?tiktok\\.com/@" + escapeRegex(h) + "/video/",
            "i"
        );
        console.log("@" + h + " ->", await c.countDocuments({ webVideoUrl: re, isActive: true }));
    }

    console.log("inactive (unrelated accounts):", await c.countDocuments({ isActive: false }));

    const samp = await c.find({ isActive: false }).limit(3).project({ username: 1, webVideoUrl: 1 }).toArray();
    console.log(JSON.stringify(samp));

    await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
