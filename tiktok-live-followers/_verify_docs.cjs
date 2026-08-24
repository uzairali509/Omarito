require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const c = mongoose.connection.db.collection("videos");
    for (const h of ["omari.to", "dilandyalieva", "hello.safia"]) {
        const doc = await c.findOne({ webVideoUrl: { $regex: "@" + h.replace(".", "\\.") + "/video/" }, isActive: true });
        console.log("@" + h, "->", JSON.stringify({
            videoId: doc.videoId,
            title: (doc.title || "").slice(0, 40),
            thumbOk: /^https?:\/\//.test(doc.thumbnail || ""),
            thumb: (doc.thumbnail || "").slice(0, 70),
            webVideoUrl: doc.webVideoUrl
        }, null, 0));
    }
    const noThumb = await c.countDocuments({ isActive: true, $or: [{ thumbnail: "" }, { thumbnail: null }] });
    console.log("active docs missing thumbnail:", noThumb);
    await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
