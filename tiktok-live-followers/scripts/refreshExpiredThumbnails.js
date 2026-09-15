require("dotenv").config();

const mongoose = require("mongoose");
const Video = require("../models/Video");
const { fetchFreshThumbnail } = require("../services/thumbnailService");

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
}

function parseExpiry(url) {
    const m = String(url || "").match(/x-expires=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

function isExpired(url) {
    if (!url) return true;
    const exp = parseExpiry(url);
    if (exp === null) return false; // No expiry info, assume valid
    return exp * 1000 < Date.now();
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
            if (!isExpired(thumb)) {
                skipped++;
                continue;
            }

            console.log(`\n🔄 Refreshing thumbnail for video ${i + 1}/${videos.length}: ${video.videoId}`);
            console.log(`   Old thumbnail (expired): ${thumb.substring(0, 60)}...`);

            // Try to get fresh thumbnail using thumbnailService (oEmbed -> page scrape fallback)
            if (video.webVideoUrl) {
                try {
                    const freshThumb = await fetchFreshThumbnail(video.webVideoUrl);
                    
                    if (freshThumb) {
                        // Update database with fresh thumbnail
                        await Video.updateOne(
                            { videoId: video.videoId },
                            { $set: { thumbnail: freshThumb } }
                        );
                        
                        console.log(`   ✅ Fresh thumbnail: ${freshThumb.substring(0, 60)}...`);
                        refreshed++;
                    } else {
                        console.log(`   ❌ No fresh thumbnail from any source`);
                        failed++;
                    }
                } catch (error) {
                    console.log(`   ❌ Thumbnail refresh failed: ${error.message}`);
                    failed++;
                }
            } else {
                console.log(`   ❌ No webVideoUrl available`);
                failed++;
            }

            process.stdout.write(
                `\r📦 ${i + 1}/${videos.length} | Refreshed:${refreshed} | Skipped:${skipped} | Failed:${failed}`
            );
            
            // Small delay to avoid rate limiting
            if (i < videos.length - 1) {
                await new Promise(r => setTimeout(r, 200));
            }
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