const https = require("https");
const http = require("http");

// Test YouTube API
function testYouTube() {
    return new Promise((resolve, reject) => {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=NonjJz3Itm0,97PvHHgo78k,Gx0Gu9MoLUE&key=AIzaSyBtqSE00ra7_NoRg3EGuipaq75VIBDsecg`;
        https.get(url, res => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => {
                try {
                    const d = JSON.parse(body);
                    console.log("YouTube API status:", res.statusCode);
                    console.log("Items:", d.items ? d.items.length : 0);
                    if (d.error) console.log("ERROR:", JSON.stringify(d.error));
                    if (d.items && d.items.length > 0) {
                        console.log("First title:", d.items[0].snippet.title);
                        console.log("Duration:", d.items[0].contentDetails.duration);
                    }
                } catch (e) {
                    console.log("Parse error:", body.substring(0, 200));
                }
                resolve();
            });
        }).on("error", reject);
    });
}

// Test tikwm
function testTikwm() {
    return new Promise((resolve, reject) => {
        const url = `https://www.tikwm.com/api/?url=https://www.tiktok.com/@omari.to/video/7669474430833184021`;
        https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => {
                console.log("\ntikwm status:", res.statusCode);
                try {
                    const d = JSON.parse(body);
                    console.log("tikwm success:", d.code === 0);
                    if (d.data) {
                        console.log("  cover:", (d.data.cover || "").substring(0, 80));
                        console.log("  play:", (d.data.play || "").substring(0, 80));
                        console.log("  title:", (d.data.title || "").substring(0, 80));
                    }
                } catch (e) {
                    console.log("Response:", body.substring(0, 300));
                }
                resolve();
            });
        }).on("error", e => {
            console.log("\ntikwm error:", e.message);
            resolve();
        });
    });
}

async function main() {
    await testYouTube();
    await testTikwm();
}

main().catch(e => console.error("FATAL:", e));
