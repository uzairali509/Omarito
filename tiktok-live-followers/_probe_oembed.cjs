// Temp: probe TikTok oEmbed for thumbnails (different endpoint, may not be rate-limited)
const videos = [
    ["omari.to", "7669474430833184021"],
    ["dilandyalieva", "7667673118143466785"],
    ["hello.safia", "7501290557751168262"]
];

(async () => {
    for (const [handle, id] of videos) {
        const url = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${handle}/video/${id}`;
        try {
            const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
            const t = await r.text();
            let d = null;
            try { d = JSON.parse(t); } catch (e) {}
            if (d && d.thumbnail_url) {
                const em = d.thumbnail_url.match(/x-expires=(\d+)/);
                console.log(handle, "->", r.status, "thumb:", d.thumbnail_url.slice(0, 100),
                    "| expires:", em ? new Date(+em[1] * 1000).toISOString() : "none");
                const ir = await fetch(d.thumbnail_url);
                console.log("   thumb fetch ->", ir.status, ir.headers.get("content-type"));
            } else {
                console.log(handle, "->", r.status, t.slice(0, 120));
            }
        } catch (e) {
            console.log(handle, "-> FAIL", e.message);
        }
        await new Promise(r => setTimeout(r, 500));
    }
})();
