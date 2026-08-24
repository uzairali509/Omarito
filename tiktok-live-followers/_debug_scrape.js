const axios = require("axios");

async function debugScrape() {
    console.log("Testing TikTok profile scrape...");
    try {
        const { data: html } = await axios.get("https://www.tiktok.com/@omari.to", {
            timeout: 15000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });
        
        console.log("HTML length:", html.length);
        
        // Try multiple patterns
        const patterns = [
            /"followerCount"[\s:]*(\d+)/i,
            /"followerCount":(\d+)/,
            /"follower_count":(\d+)/,
            /followerCount["\s:]+(\d+)/,
            /"fans":(\d+)/
        ];
        
        patterns.forEach((p, i) => {
            const m = html.match(p);
            console.log(`Pattern ${i}: ${m ? 'MATCH=' + m[1] : 'NO MATCH'}`);
        });
        
        // Also check for heartCount
        const heartPatterns = [
            /"heartCount"[\s:]*(\d+)/i,
            /"heartCount":(\d+)/,
            /"totalFavorited"[\s:]*(\d+)/i,
            /heartCount["\s:]+(\d+)/
        ];
        
        heartPatterns.forEach((p, i) => {
            const m = html.match(p);
            console.log(`Heart pattern ${i}: ${m ? 'MATCH=' + m[1] : 'NO MATCH'}`);
        });
        
        // Search for the section containing follower data
        const idx = html.indexOf("followerCount");
        if (idx >= 0) {
            console.log("\nContext around 'followerCount':");
            console.log(html.substring(Math.max(0, idx - 50), idx + 100));
        } else {
            console.log("\n'followerCount' not found in HTML!");
            // Check if there's any JSON data
            const jsonIdx = html.indexOf('"User"');
            if (jsonIdx >= 0) {
                console.log("Found 'User' at:", jsonIdx);
                console.log(html.substring(jsonIdx, jsonIdx + 200));
            }
        }
        
    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Headers:", JSON.stringify(err.response.headers).substring(0, 200));
        }
    }
}

debugScrape();
