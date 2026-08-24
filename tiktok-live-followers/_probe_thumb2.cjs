// Temp: find image/thumbnail candidates inside the TikTok video page HTML
const id = "7669474430833184021";
const pageUrl = "https://www.tiktok.com/@omari.to/video/" + id;

(async () => {
    const r = await fetch(pageUrl, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        }
    });
    const html = await r.text();

    // 1) any og:image anywhere (JSON-escaped variants)
    const ogVariants = html.match(/og:image[^,}]{0,400}/g) || [];
    console.log("--- og:image mentions:", ogVariants.length);
    ogVariants.slice(0, 3).forEach(s => console.log("   ", s.slice(0, 300)));

    // 2) image URLs pointing at tiktokcdn image hosts
    const urls = html.match(/https?:\\?\/\\?\/[^"'\s\\]*(?:tiktokcdn|tiktokcdn-us|tiktokcdn-eu)[^"'\s\\]*image[^"'\s\\]*/g) || [];
    const uniq = [...new Set(urls)].slice(0, 8);
    console.log("--- cdn image-like urls:", urls.length, "unique sample:");
    uniq.forEach(u => console.log("   ", u.slice(0, 220)));

    // 3) unescape one and test fetch
    const testUrl = uniq.find(u => u.includes("x-expires"));
    if (testUrl) {
        const clean = testUrl.replace(/\\\//g, "/").replace(/\\u002F/g, "/");
        const em = clean.match(/x-expires=(\d+)/);
        if (em) console.log("--- candidate expires:", new Date(+em[1] * 1000).toISOString());
        const ir = await fetch(clean, { headers: { "User-Agent": "Mozilla/5.0" } });
        console.log("--- candidate fetch ->", ir.status, ir.headers.get("content-type"));
    }

    // 4) is the page a bot wall?
    console.log("--- captcha markers:", /captcha|verify|sec.tiktok/i.test(html) ? "YES" : "no");
})().catch(e => {
    console.error("FAIL", e.message);
    process.exit(1);
});
