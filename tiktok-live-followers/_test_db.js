const http = require("http");

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, res => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { resolve(body); }
            });
        }).on("error", reject);
    });
}

async function main() {
    console.log("=== TEST 1: Grid Videos (Omar) ===");
    const g1 = await get("/tiktok-grid-videos?username=omari.to");
    console.log("success:", g1.success, "count:", g1.videos ? g1.videos.length : 0);
    if (g1.videos && g1.videos.length > 0) {
        const v = g1.videos[0];
        console.log("  first: id=" + v.id + " views=" + v.views + " likes=" + v.likes + " comments=" + v.comments + " shares=" + v.shares + " duration=" + v.duration);
        console.log("  title:", (v.title || "").substring(0, 60));
        console.log("  username:", v.username);
        console.log("  thumbnail:", (v.thumbnail || "").substring(0, 80));
        console.log("  hashtags:", JSON.stringify(v.hashtags || []));
    }

    console.log("\n=== TEST 2: Grid Videos (Dylan) ===");
    const g2 = await get("/tiktok-grid-videos?username=dilandyalieva");
    console.log("success:", g2.success, "count:", g2.videos ? g2.videos.length : 0);
    if (g2.videos && g2.videos.length > 0) {
        const v = g2.videos[0];
        console.log("  first: id=" + v.id + " views=" + v.views + " username=" + v.username);
    }

    console.log("\n=== TEST 3: Grid Videos (Sufiya) ===");
    const g3 = await get("/tiktok-grid-videos?username=hello.safia");
    console.log("success:", g3.success, "count:", g3.videos ? g3.videos.length : 0);

    console.log("\n=== TEST 4: Playlist Omarito.World ===");
    const p1 = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.World");
    console.log("success:", p1.success, "count:", p1.videos ? p1.videos.length : 0, "playlistMeta:", p1.playlistMetadataAvailable);
    if (p1.videos && p1.videos.length > 0) {
        console.log("  first id:", p1.videos[0].id, "title:", (p1.videos[0].title || "").substring(0, 50));
    }

    console.log("\n=== TEST 5: Playlist Omarito.Wow ===");
    const p2 = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.Wow");
    console.log("success:", p2.success, "count:", p2.videos ? p2.videos.length : 0, "playlistMeta:", p2.playlistMetadataAvailable);
    if (p2.videos && p2.videos.length > 0) {
        console.log("  first id:", p2.videos[0].id, "title:", (p2.videos[0].title || "").substring(0, 50));
    }

    console.log("\n=== TEST 6: Playlist Omarito.Chef ===");
    const p3 = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.Chef");
    console.log("success:", p3.success, "count:", p3.videos ? p3.videos.length : 0, "playlistMeta:", p3.playlistMetadataAvailable);
    if (p3.videos && p3.videos.length > 0) {
        console.log("  first id:", p3.videos[0].id, "title:", (p3.videos[0].title || "").substring(0, 50));
    }

    console.log("\n=== TEST 7: Single Video ===");
    if (g1.videos && g1.videos.length > 0) {
        const testId = g1.videos[0].id;
        const sv = await get("/tiktok-video?id=" + testId);
        console.log("success:", sv.success);
        if (sv.video) {
            console.log("  id:", sv.video.id);
            console.log("  views:", sv.video.views, "likes:", sv.video.likes);
            console.log("  playUrl:", (sv.video.playUrl || "").substring(0, 60));
            console.log("  video_url:", (sv.video.video_url || "").substring(0, 60));
        }
    }

    console.log("\n=== TEST 8: Up Next ===");
    const un = await get("/tiktok-upnext?limit=5");
    console.log("success:", un.success, "count:", un.videos ? un.videos.length : 0);
    if (un.videos && un.videos.length > 0) {
        un.videos.forEach(v => {
            console.log("  id=" + v.id + " views=" + v.views + " likes=" + v.likes + " user=" + v.username);
        });
    }

    console.log("\n=== TEST 9: TikTok Play ===");
    if (g1.videos && g1.videos.length > 0) {
        const testId = g1.videos[0].id;
        const play = await get("/tiktok-play?id=" + testId);
        console.log("success:", play.success);
        console.log("  playUrl:", (play.playUrl || "null").substring(0, 80));
        console.log("  watchUrl:", (play.watchUrl || "null").substring(0, 80));
    }

    console.log("\n=== TEST 10: TikTok Data (homepage) ===");
    const td = await get("/tiktok-data");
    console.log("followers:", td.followers, "likes:", td.likes, "views:", td.views);

    console.log("\n=== TEST 11: Check hashtags in Omar videos ===");
    // Check a few videos for hashtag content
    if (g1.videos && g1.videos.length > 0) {
        let withHashtags = 0;
        let withTitles = 0;
        g1.videos.slice(0, 20).forEach(v => {
            if (v.hashtags && v.hashtags.length > 0) withHashtags++;
            if (v.title && v.title.length > 0) withTitles++;
        });
        console.log("  (first 20 Omar videos)");
        console.log("  with hashtags:", withHashtags);
        console.log("  with titles:", withTitles);
        // Show some sample hashtags
        g1.videos.slice(0, 5).forEach(v => {
            console.log("  video", v.id, "hashtags:", JSON.stringify((v.hashtags || []).slice(0, 5)));
            console.log("    title:", (v.title || "").substring(0, 80));
        });
    }
}

main().catch(e => console.error("FATAL:", e));
