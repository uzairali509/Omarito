// Temp: probe what stream URLs the TikTok video page actually contains
const id = process.argv[2] || "7669474430833184021";
const url = "https://www.tiktok.com/@omari.to/video/" + id;

(async () => {
    const r = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        }
    });
    const html = await r.text();
    console.log("status:", r.status, "bytes:", html.length);

    const hits = {
        mp4: (html.match(/\.mp4/gi) || []).length,
        playAddr: (html.match(/playAddr/g) || []).length,
        downloadAddr: (html.match(/downloadAddr/g) || []).length,
        bitrateInfo: (html.match(/bitrateInfo/g) || []).length,
        tiktokcdn_video: (html.match(/tiktokcdn[a-z-]*\.com\/[^"'\s]*?video\/index/gi) || []).length
    };
    console.log(hits);

    // show a sample around playAddr if present
    const i = html.indexOf("playAddr");
    if (i > -1) console.log("context:", html.slice(i, i + 400).replace(/\\u002F/g, "/"));

    // any vid.tiktokcdn URLs?
    const vids = html.match(/https?:[^"'\s\\]*tiktokcdn[^"'\s\\]*?\/video\/[^"'\s\\]{5,80}/g) || [];
    console.log("video-path cdn urls:", vids.slice(0, 3));

    // dump full stub content to see what TikTok served
    console.log("----- FULL BODY -----");
    console.log(html);
})().catch(e => console.error("ERR", e.message));
