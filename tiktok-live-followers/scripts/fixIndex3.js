require("dotenv").config();
const mongoose = require("mongoose");

async function fixIndex() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const collection = db.collection("videos");
    
    // Drop by key specification instead of name
    try {
        await collection.dropIndex({ tikok_id: 1 });
        console.log("Dropped index on tikok_id");
    } catch (e) {
        console.log("Could not drop by key:", e.message);
    }
    
    // Also drop tiktokId_1
    try {
        await collection.dropIndex({ tiktokId: 1 });
        console.log("Dropped index on tikokId");
    } catch (e) {
        console.log("Could not drop tikokId:", e.message);
    }
    
    // Verify
    const indexes = await collection.indexes();
    console.log("Remaining indexes:");
    indexes.forEach(idx => console.log("  -", idx.name, JSON.stringify(idx.key), idx.partialFilterExpression ? "PARTIAL: " + JSON.stringify(idx.partialFilterExpression) : ""));
    
    mongoose.disconnect();
    console.log("Done");
}

fixIndex().catch(console.error);