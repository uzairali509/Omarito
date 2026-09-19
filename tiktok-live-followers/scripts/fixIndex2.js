require("dotenv").config();
const mongoose = require("mongoose");

async function fixIndex() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const collection = db.collection("videos");
    
    // List all indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:");
    indexes.forEach(idx => console.log("  -", idx.name, JSON.stringify(idx.key), idx.partialFilterExpression ? "PARTIAL: " + JSON.stringify(idx.partialFilterExpression) : ""));
    
    // Drop the old unique sparse index on tikok_id (name: tikok_id_1)
    try {
        await collection.dropIndex("tikok_id_1");
        console.log("Dropped old tikok_id_1 index");
    } catch (e) {
        console.log("Could not drop tikok_id_1:", e.message);
    }
    
    // Also drop tikokId_1 if it exists
    try {
        await collection.dropIndex("tikokId_1");
        console.log("Dropped tikokId_1 index");
    } catch (e) {
        console.log("Could not drop tikokId_1:", e.message);
    }
    
    // Verify
    const indexes2 = await collection.indexes();
    console.log("Remaining indexes:");
    indexes2.forEach(idx => console.log("  -", idx.name, JSON.stringify(idx.key), idx.partialFilterExpression ? "PARTIAL: " + JSON.stringify(idx.partialFilterExpression) : ""));
    
    mongoose.disconnect();
    console.log("Done");
}

fixIndex().catch(console.error);