require("dotenv").config();
const mongoose = require("mongoose");

async function dropOldIndex() {
    await mongoose.connect(process.env.MONGO_URI, { 
        serverSelectionTimeoutMS: 60000,
        socketTimeoutMS: 60000
    });
    console.log("Connected to MongoDB");
    
    const db = mongoose.connection.db;
    const collection = db.collection("videos");
    
    // Try dropping by index specification
    try {
        await collection.dropIndex({ tikok_id: 1 });
        console.log("Dropped old tikok_id index by spec");
    } catch (e) {
        console.log("Drop by spec failed:", e.message);
    }
    
    // Also try dropping tikokId
    try {
        await collection.dropIndex({ tikokId: 1 });
        console.log("Dropped tikokId index by spec");
    } catch (e) {
        console.log("Drop tikokId failed:", e.message);
    }
    
    // Verify
    const indexes = await collection.indexes();
    console.log("Remaining indexes:");
    indexes.forEach(idx => console.log("  -", idx.name, JSON.stringify(idx.key), idx.partialFilterExpression ? "PARTIAL: " + JSON.stringify(idx.partialFilterExpression) : ""));
    
    await mongoose.disconnect();
    console.log("Done");
}

dropOldIndex().catch(console.error);