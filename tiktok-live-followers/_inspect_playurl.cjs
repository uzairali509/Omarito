// Temp: inspect playUrl + stats fields on active docs
require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const c = mongoose.connection.db.collection("videos");

    const d = await c.findOne({ isActive: true }, {
        projection: {
            videoId: 1, playUrl: 1, views: 1, likes: 1, comments: 1,
            shares: 1, saves: 1, duration: 1, createTime: 1, webVideoUrl: 1, thumbnail: 1
        }
    });
    console.log(JSON.stringify(d, null, 1));

    const withPlay = await c.countDocuments({ isActive: true, playUrl: /^https?:/ });
    console.log("active docs with usable playUrl:", withPlay);

    const s = await c.aggregate([{ $match: { isActive: true } }, { $sample: { size: 3 } }]);
    s.forEach(x => console.log("sample:", x.videoId, "| playUrl:", (x.playUrl || "(none)").slice(0, 130)));

    await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
