require("dotenv").config();
const mongoose = require("mongoose");

async function fixTikTokIdIndex() {
    await mongoose.connect(process.env.MONGO_URI, { 
        serverSelectionTimeoutMS: 60000,
        socketTimeoutMS: 60000
    });
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const collection = db.collection("videos");
    
    // Drop the tiktok_id index
    try {
        await collection.dropIndex({ tiktok_id: 1 });
        console.log("Dropped tiktok_id index");
    } catch (e) {
        console.log("Drop tiktok_id failed:", e.message);
    }
    
    // Create partial index for tiktok_id only on TikTok videos
    try {
        await collection.createIndex(
            { tiktok_id: 1 },
            { 
                unique: true, 
                partialFilterExpression: { platform: "tiktok" },
                name: "tiktok_id_1_partial"
            }
        );
        console.log("Created partial unique index on tiktok_id for platform=tiktok only");
    } catch (e) {
        console.log("Create partial index failed:", e.message);
    }
    
    // Verify
    const indexes = await collection.indexes();
    console.log("Remaining indexes:");
    indexes.forEach(idx => console.log("  -", idx.name, JSON.stringify(idx.key), idx.partialFilterExpression ? "PARTIAL: " + JSON.stringify(idx.partialFilterExpression) : ""));
    
    await mongoose.disconnect();
    console.log("Done");
}

fixTikTokIdIndex().catch(console.error);