require("dotenv").config();
const mongoose = require("mongoose");
const Video = require("../models/Video");

async function fix() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    // Find YouTube videos with tikok_id: null
    const bad = await Video.find({ platform: "youtube", tikok_id: null });
    console.log("Found", bad.length, "YouTube videos with tikok_id: null");
    if (bad.length > 0) {
        await Video.deleteMany({ platform: "youtube", tikok_id: null });
        console.log("Deleted them");
    }
    
    // Also delete any without platform field but with youtube URLs
    const bad2 = await Video.find({ platform: { $exists: false }, webVideoUrl: /youtube/ });
    console.log("Found", bad2.length, "legacy YouTube videos without platform");
    if (bad2.length > 0) {
        await Video.deleteMany({ platform: { $exists: false }, webVideoUrl: /youtube/ });
        console.log("Deleted them");
    }
    
    // Verify cleanup
    const remaining = await Video.find({ platform: "youtube" });
    console.log("Remaining YouTube videos:", remaining.length);
    for (const v of remaining) {
        console.log("  -", v.videoId, "tikok_id:", v.tikok_id);
    }
    
    mongoose.disconnect();
    console.log("Done");
}

fix().catch(console.error);