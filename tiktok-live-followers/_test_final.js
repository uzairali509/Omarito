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
    console.log("=== PLAYLIST TESTS ===");
    
    console.log("\n--- Omarito.World ---");
    const p1 = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.World");
    console.log("success:", p1.success, "count:", p1.videos.length, "playlistMeta:", p1.playlistMetadataAvailable);
    p1.videos.slice(0, 3).forEach(v => {
        console.log("  id=" + v.id + " title=" + (v.title || "").substring(0, 50) + " hashtags=" + JSON.stringify((v.hashtags || []).slice(0, 3)));
    });

    console.log("\n--- Omarito.Wow ---");
    const p2 = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.Wow");
    console.log("success:", p2.success, "count:", p2.videos.length, "playlistMeta:", p2.playlistMetadataAvailable);

    console.log("\n--- Omarito.Chef ---");
    const p3 = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.Chef");
    console.log("success:", p3.success, "count:", p3.videos.length, "playlistMeta:", p3.playlistMetadataAvailable);

    console.log("\n--- No playlist (all Omar) ---");
    const p4 = await get("/tiktok-grid-videos?username=omari.to");
    console.log("success:", p4.success, "count:", p4.videos.length);

    console.log("\n=== CREATOR FILTER TESTS ===");
    
    console.log("\n--- Dylan ---");
    const d = await get("/tiktok-grid-videos?username=dilandyalieva");
    console.log("success:", d.success, "count:", d.videos.length);
    if (d.videos.length > 0) {
        console.log("  first: id=" + d.videos[0].id + " user=" + d.videos[0].username + " views=" + d.videos[0].views);
    }

    console.log("\n--- Sufiya ---");
    const s = await get("/tiktok-grid-videos?username=hello.safia");
    console.log("success:", s.success, "count:", s.videos.length);
    if (s.videos.length > 0) {
        console.log("  first: id=" + s.videos[0].id + " user=" + s.videos[0].username + " views=" + s.videos[0].views);
    }

    console.log("\n=== SINGLE VIDEO + PLAYER TESTS ===");
    
    // Test with a known Omar video
    const sv = await get("/tiktok-video?id=7669474430833184021");
    console.log("\n--- Single Video ---");
    console.log("success:", sv.success);
    if (sv.video) {
        console.log("  id:", sv.video.id);
        console.log("  views:", sv.video.views, "likes:", sv.video.likes, "comments:", sv.video.comments, "shares:", sv.video.shares);
        console.log("  duration:", sv.video.duration);
        console.log("  creator:", sv.video.creator, "username:", sv.video.username);
        console.log("  playUrl:", (sv.video.playUrl || "").substring(0, 60));
        console.log("  video_url:", (sv.video.video_url || "").substring(0, 60));
    }

    console.log("\n--- Play URL ---");
    const play = await get("/tiktok-play?id=7669474430833184021");
    console.log("success:", play.success);
    console.log("  playUrl:", (play.playUrl || "null").substring(0, 80));
    console.log("  watchUrl:", (play.watchUrl || "null").substring(0, 80));

    console.log("\n=== UP NEXT TESTS ===");
    const un = await get("/tiktok-upnext?limit=5&exclude=7669474430833184021");
    console.log("success:", un.success, "count:", un.videos.length);
    un.videos.forEach(v => {
        console.log("  id=" + v.id + " views=" + v.views + " likes=" + v.likes + " user=" + v.username + " duration=" + v.duration);
    });

    console.log("\n=== HOMEPAGE DATA TEST ===");
    const td = await get("/tiktok-data");
    console.log("followers:", td.followers, "likes:", td.likes);

    console.log("\n=== THUMBNAIL URL CHECK ===");
    // Check if thumbnails have x-expires
    if (p4.videos.length > 0) {
        p4.videos.slice(0, 5).forEach(v => {
            const exp = String(v.thumbnail || "").match(/x-expires=(\d+)/);
            const expired = exp && (+exp[1] * 1000) < Date.now();
            console.log("  id=" + v.id + " expired=" + expired + " thumb_len=" + (v.thumbnail || "").length);
        });
    }
}

main().catch(e => console.error("FATAL:", e));
