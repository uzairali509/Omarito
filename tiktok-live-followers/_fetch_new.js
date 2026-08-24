const axios = require("axios");

async function fetchProfileVideos(handle) {
    console.log(`\n=== Fetching @${handle} ===`);
    const { data } = await axios.get(`https://www.tiktok.com/@${handle}`, {
        timeout: 15000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        }
    });

    // Try SIGI_STATE
    const sigiMatch = data.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
    if (sigiMatch) {
        try {
            const json = JSON.parse(sigiMatch[1]);
            const items = json.ItemModule || {};
            const keys = Object.keys(items);
            console.log("SIGI_STATE: Found", keys.length, "videos");
            if (keys.length > 0) {
                const sample = items[keys[0]];
                console.log("Sample ID:", sample.id, "desc:", (sample.desc || "").substring(0, 50));
            }
            return keys.map(k => items[k]);
        } catch (e) {
            console.log("SIGI parse error:", e.message);
        }
    }

    // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
    const rehydraMatch = data.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (rehydraMatch) {
        try {
            const json = JSON.parse(rehydraMatch[1]);
            // Navigate the nested structure
            const userDetail = json["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
            if (userDetail && userDetail.itemList) {
                console.log("UNIVERSAL_DATA: Found", userDetail.itemList.length, "videos");
                return userDetail.itemList;
            }
            // Try other paths
            const keys = Object.keys(json["__DEFAULT_SCOPE__"] || {});
            console.log("DEFAULT_SCOPE keys:", keys);
            for (const key of keys) {
                const section = json["__DEFAULT_SCOPE__"][key];
                if (section && section.itemList) {
                    console.log(`Found itemList in ${key}: ${section.itemList.length} videos`);
                    return section.itemList;
                }
            }
        } catch (e) {
            console.log("UNIVERSAL_DATA parse error:", e.message);
        }
    }

    // Try finding video IDs in any JSON blob
    const videoIdPattern = /"id"\s*:\s*"(\d{15,25})"/g;
    const idMatches = [...data.matchAll(videoIdPattern)];
    const uniqueIds = [...new Set(idMatches.map(m => m[1]))];
    console.log("Regex fallback: Found", uniqueIds.length, "unique video IDs");
    if (uniqueIds.length > 0) {
        console.log("First 5:", uniqueIds.slice(0, 5));
    }

    // Check what script tags exist
    const scriptIds = [...data.matchAll(/<script id="([^"]+)"/g)].map(m => m[1]);
    console.log("Script IDs found:", scriptIds);

    return [];
}

async function main() {
    const videos = await fetchProfileVideos("omari.to");
    console.log("\nTotal videos extracted:", videos.length);
}

main().catch(e => console.error("FATAL:", e.message));
