/**
 * Seed initial ranking data for the About page
 * 
 * This script sets the initial ranking values in the database.
 * Rankings should be verified from a reliable source before seeding.
 * 
 * Usage:
 *   node scripts/seedRankings.js
 * 
 * To update rankings later, either:
 *   1. Run this script with updated values
 *   2. POST to /omari-ranking/update endpoint
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const Ranking = require("../models/Ranking");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
}

// Initial ranking values - UPDATE THESE WITH VERIFIED DATA
// These are placeholder values that should be replaced with real rankings
const INITIAL_RANKINGS = [
    {
        platform: "tiktok_asia",
        rank: 10,  // #10 Biggest Influencer & TikToker in Asia
        source: "manual",
        metadata: {
            notes: "Update with verified ranking from reliable source"
        }
    },
    {
        platform: "tiktok_world",
        rank: 25,  // #25 Biggest Influencer & TikToker in World
        source: "manual",
        metadata: {
            notes: "Update with verified ranking from reliable source"
        }
    },
    {
        platform: "tiktok_kazakhstan",
        rank: 1,   // #1 Biggest Influencer in Kazakhstan
        source: "manual",
        metadata: {
            notes: "Update with verified ranking from reliable source"
        }
    }
];

async function seedRankings() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected");

        console.log("\nSeeding rankings...");
        
        for (const ranking of INITIAL_RANKINGS) {
            const result = await Ranking.findOneAndUpdate(
                { platform: ranking.platform },
                ranking,
                { upsert: true, new: true }
            );
            console.log(`✓ ${ranking.platform}: #${ranking.rank}`);
        }

        console.log("\n✅ Rankings seeded successfully");
        console.log("\nIMPORTANT: These are placeholder values.");
        console.log("Update them with verified rankings from a reliable source.");
        console.log("\nTo update via API:");
        console.log("  POST http://localhost:3000/omari-ranking/update");
        console.log("  Body: { platform: 'tiktok_asia', rank: 10 }");

        process.exit(0);
    } catch (err) {
        console.error("Error seeding rankings:", err);
        process.exit(1);
    }
}

seedRankings();
