require("dotenv").config();
const mongoose = require("mongoose");

async function fixIndex() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const collection = db.collection("videos");
    
    // Drop the existing unique sparse index on tikok_id
    try {
        await collection.dropIndex("tikok_id_1");
        console.log("Dropped existing tikok_id_1 index");
    } catch (e) {
        console.log("Index may not exist:", e.message);
    }
    
    // Create a partial unique index that only applies to TikTok videos
    await collection.createIndex(
        { tikok_id: 1 },
        { 
            unique: true, 
            partialFilterExpression: { platform: "tiktok" },
            name: "tikok_id_1_partial"
        }
    );
    console.log("Created partial unique index on tikok_id for platform=tiktok only");
    
    // Verify
    const indexes = await collection.indexes();
    console.log("Current indexes:");
    indexes.forEach(idx => console.log("  -", idx.name, JSON.stringify(idx.key), idx.partialFilterExpression ? "PARTIAL: " + JSON.stringify(idx.partialFilterExpression) : ""));
    
    mongoose.disconnect();
    console.log("Done");
}

fixIndex().catch(console.error);