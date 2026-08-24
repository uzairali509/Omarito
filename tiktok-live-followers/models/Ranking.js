const mongoose = require("mongoose");

const rankingSchema = new mongoose.Schema({
    // Platform/region identifier
    platform: {
        type: String,
        required: true,
        unique: true,
        enum: ["tiktok_asia", "tiktok_world", "tiktok_kazakhstan"]
    },
    
    // Current rank value
    rank: {
        type: Number,
        required: true
    },
    
    // When this ranking was last verified/updated
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    
    // Optional: source of the ranking (manual, socialblade, etc.)
    source: {
        type: String,
        default: "manual"
    },
    
    // Optional: additional metadata
    metadata: {
        followerCount: Number,
        totalLikes: Number,
        notes: String
    }
});

module.exports = mongoose.model("Ranking", rankingSchema);
