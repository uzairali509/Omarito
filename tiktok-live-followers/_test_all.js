const http = require("http");

function test(url) {
    return new Promise((resolve, reject) => {
        const r = http.get(url, (x) => {
            let d = "";
            x.on("data", (c) => d += c);
            x.on("end", () => {
                try { resolve(JSON.parse(d)); }
                catch (e) { resolve({ raw: d.substring(0, 300) }); }
            });
        });
        r.on("error", reject);
        r.setTimeout(30000, () => { r.destroy(); reject(new Error("timeout")); });
    });
}

function formatStat(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

async function main() {
    console.log("=== Testing /tiktok-data ===");
    const t1 = await test("http://localhost:3000/tiktok-data");
    console.log("Followers:", t1.followers, "(" + formatStat(t1.followers) + ")");
    console.log("Likes:", t1.likes, "(" + formatStat(t1.likes) + ")");
    console.log("Views:", t1.views, "(" + formatStat(t1.views) + ")");

    console.log("\n=== Testing grid-videos (omari.to) ===");
    const t2 = await test("http://localhost:3000/tiktok-grid-videos?username=omari.to");
    console.log("Success:", t2.success, "| Count:", t2.videos.length);

    console.log("\n=== Testing grid-videos (dilandyalieva) ===");
    const t3 = await test("http://localhost:3000/tiktok-grid-videos?username=dilandyalieva");
    console.log("Success:", t3.success, "| Count:", t3.videos.length);

    console.log("\n=== Testing grid-videos (hello.safia) ===");
    const t4 = await test("http://localhost:3000/tiktok-grid-videos?username=hello.safia");
    console.log("Success:", t4.success, "| Count:", t4.videos.length);

    console.log("\n=== Testing playlist filter (Omarito.Wow) ===");
    const t5 = await test("http://localhost:3000/tiktok-grid-videos?username=omari.to&playlist=Omarito.Wow");
    console.log("Success:", t5.success, "| Count:", t5.videos.length);

    console.log("\n=== Testing /tiktok-upnext ===");
    const t6 = await test("http://localhost:3000/tiktok-upnext?limit=8");
    console.log("Success:", t6.success, "| Count:", t6.videos.length);

    console.log("\n=== Testing /omari-ranking ===");
    const t7 = await test("http://localhost:3000/omari-ranking");
    console.log("Asia:", t7.asiaRank, "| World:", t7.worldRank, "| KZ:", t7.kzRank);

    console.log("\n=== ALL TESTS COMPLETE ===");
}

main().catch(e => console.error("ERROR:", e.message));
