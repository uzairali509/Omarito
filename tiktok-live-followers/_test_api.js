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
    console.log("=== TEST 1: Single Video Lookup ===");
    const v1 = await get("/tiktok-video?id=7669474430833184021");
    console.log("success:", v1.success);
    if (v1.video) {
        const v = v1.video;
        console.log("  id:", v.id);
        console.log("  views:", v.views);
        console.log("  likes:", v.likes);
        console.log("  comments:", v.comments);
        console.log("  shares:", v.shares);
        console.log("  duration:", v.duration);
        console.log("  creator:", v.creator);
        console.log("  username:", v.username);
        console.log("  has playUrl:", !!v.playUrl);
        console.log("  has thumbnail:", !!v.thumbnail);
    }

    console.log("\n=== TEST 2: Up Next ===");
    const upnext = await get("/tiktok-upnext?limit=5&exclude=7669474430833184021");
    console.log("success:", upnext.success);
    console.log("count:", upnext.videos?.length);
    (upnext.videos || []).forEach(v => {
        console.log(`  id=${v.id} views=${v.views} likes=${v.likes} comments=${v.comments} shares=${v.shares} user=${v.username}`);
    });

    console.log("\n=== TEST 3: Creator Filter - Dylan ===");
    const dylan = await get("/tiktok-grid-videos?username=dilandyalieva");
    console.log("success:", dylan.success);
    console.log("count:", dylan.videos?.length);
    if (dylan.videos?.[0]) {
        const d = dylan.videos[0];
        console.log("  first: id=" + d.id + " views=" + d.views + " likes=" + d.likes + " user=" + d.username);
    }

    console.log("\n=== TEST 4: Creator Filter - Sufiya ===");
    const sufiya = await get("/tiktok-grid-videos?username=hello.safia");
    console.log("success:", sufiya.success);
    console.log("count:", sufiya.videos?.length);

    console.log("\n=== TEST 5: Creator Filter - Omar ===");
    const omar = await get("/tiktok-grid-videos?username=omari.to");
    console.log("success:", omar.success);
    console.log("count:", omar.videos?.length);
    if (omar.videos?.[0]) {
        const o = omar.videos[0];
        console.log("  first: id=" + o.id + " views=" + o.views + " likes=" + o.likes);
    }

    console.log("\n=== TEST 6: Playlist Filter ===");
    const playlist = await get("/tiktok-grid-videos?username=omari.to&playlist=Omarito.Wow");
    console.log("success:", playlist.success);
    console.log("count:", playlist.videos?.length);

    console.log("\n=== TEST 7: TikTok Play URL ===");
    const play = await get("/tiktok-play?id=7669474430833184021");
    console.log("success:", play.success);
    console.log("has playUrl:", !!play.playUrl);
    console.log("has watchUrl:", !!play.watchUrl);

    console.log("\n=== ALL TESTS COMPLETE ===");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
