require("dotenv").config();

const mongoose = require("mongoose");
const Video = require("../models/Video");
const axios = require("axios");

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
}

async function refreshExpiredThumbnails() {
    await connectDB();

    try {
        console.log("🔍 Finding videos with expired thumbnails...");
        
        const videos = await Video.find({ 
            thumbnail: { $exists: true, $ne: "" },
            isActive: true 
        }).lean();

        console.log(`📊 Found ${videos.length} videos with thumbnails`);

        let refreshed = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const thumb = video.thumbnail || "";
            
            // Check if thumbnail is expired
            const exp = thumb.match(/x-expires=(\d+)/);
            const expired = exp && (+exp[1] * 1000) < Date.now();

            if (!expired) {
                skipped++;
                continue;
            }

            console.log(`\n🔄 Refreshing thumbnail for video ${i + 1}/${videos.length}: ${video.videoId}`);
            console.log(`   Old thumbnail (expired): ${thumb.substring(0, 60)}...`);

            // Try to get fresh thumbnail from tikwm
            if (video.webVideoUrl) {
                try {
                    const { data } = await axios.get(
                        `https://www.tikwm.com/api/?url=${encodeURIComponent(video.webVideoUrl)}`,
                        { timeout: 20000, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
                    );
                    
                    const freshThumb = data?.data?.cover || data?.data?.origin_cover || "";
                    
                    if (freshThumb) {
                        // Update database with fresh thumbnail
                        await Video.updateOne(
                            { videoId: video.videoId },
                            { $set: { thumbnail: freshThumb } }
                        );
                        
                        console.log(`   ✅ Fresh thumbnail: ${freshThumb.substring(0, 60)}...`);
                        refreshed++;
                    } else {
                        console.log(`   ❌ No fresh thumbnail from tikwm`);
                        failed++;
                    }
                } catch (error) {
                    console.log(`   ❌ tikwm request failed: ${error.message}`);
                    failed++;
                }
            } else {
                console.log(`   ❌ No webVideoUrl available`);
                failed++;
            }

            process.stdout.write(
                `\r📦 ${i + 1}/${videos.length} | Refreshed:${refreshed} | Skipped:${skipped} | Failed:${failed}`
            );
        }

        console.log("\n");
        console.log("=================================");
        console.log("✅ Thumbnail Refresh Completed");
        console.log("=================================");
        console.log("Refreshed :", refreshed);
        console.log("Skipped  :", skipped);
        console.log("Failed   :", failed);
        console.log("Total    :", videos.length);
        console.log("=================================");

    } catch (err) {
        console.log("");
        console.error("❌ Thumbnail Refresh Error:");
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log("");
        console.log("🔒 MongoDB Disconnected");
        process.exit();
    }
}

refreshExpiredThumbnails();