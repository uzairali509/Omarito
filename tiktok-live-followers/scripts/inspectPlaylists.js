/**
 * Inspect Omar (@omari.to) video records to determine
 * how to identify playlist membership (Omarito.World, Omarito.Wow, Omarito.Chef)
 * 
 * Usage: node scripts/inspectPlaylists.js
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const Video = require("../models/Video");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
}

async function inspectPlaylists() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected\n");

        // Fetch 20 recent @omari.to videos
        const videos = await Video.find({
            webVideoUrl: { $regex: /tiktok\.com\/@omari\.to\/video\//i },
            isActive: true
        })
        .sort({ createTime: -1 })
        .limit(20)
        .lean();

        console.log(`Found ${videos.length} @omari.to videos\n`);
        console.log("=".repeat(80));

        videos.forEach((v, i) => {
            console.log(`\n[${i + 1}] Video ID: ${v.videoId}`);
            console.log(`    Title: ${v.title?.substring(0, 80) || "(no title)"}`);
            console.log(`    Description: ${v.description?.substring(0, 100) || "(no description)"}`);
            console.log(`    Hashtags: ${v.hashtags?.join(", ") || "(none)"}`);
            console.log(`    Creator: ${v.creator}`);
            console.log(`    Username: ${v.username}`);
            console.log(`    Web URL: ${v.webVideoUrl}`);
            console.log(`    Create Time: ${v.createTime}`);
            console.log(`    Views: ${v.views}, Likes: ${v.likes}, Comments: ${v.comments}`);
        });

        console.log("\n" + "=".repeat(80));
        console.log("\nANALYSIS:");
        console.log("- Check if hashtags contain playlist identifiers");
        console.log("- Check if title/description contain Omarito.World/Wow/Chef keywords");
        console.log("- Check if any other field distinguishes the playlists");
        console.log("\nIf no clear pattern exists, playlist filtering may not be possible with current data.");

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

inspectPlaylists();
