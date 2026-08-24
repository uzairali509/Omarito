// Temp: check if TikTok serves a fresh og:image for a video page
const id = "7669474430833184021";
const pageUrl = "https://www.tiktok.com/@omari.to/video/" + id;

(async () => {
    const r = await fetch(pageUrl, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        }
    });
    console.log("page status:", r.status);
    const html = await r.text();
    console.log("html bytes:", html.length);

    let og = null;
    const m1 = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/);
    const m2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image/);
    og = (m1 && m1[1]) || (m2 && m2[1]);
    console.log("og:image found:", !!og);
    if (og) console.log("og:image:", og.slice(0, 240));

    const em = og && og.match(/x-expires=(\d+)/);
    if (em) {
        const left = (+em[1] - Math.floor(Date.now() / 1000)) / 3600;
        console.log("og:image expires:", new Date(+em[1] * 1000).toISOString(), "valid for", left.toFixed(1), "hours");
    }

    if (og) {
        const ir = await fetch(og, { headers: { "User-Agent": "Mozilla/5.0" } });
        console.log("og:image fetch ->", ir.status, ir.headers.get("content-type"));
    }
})().catch(e => {
    console.error("FAIL", e.message);
    process.exit(1);
});
