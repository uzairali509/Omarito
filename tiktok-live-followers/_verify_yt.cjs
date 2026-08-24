// Temp: verify YouTube Data API works with the page's existing config
const fs = require("fs");
const html = fs.readFileSync("F:/TikTok Web/Codes/videos.html", "utf8");
const key = (html.match(/API_KEY = "([^"]+)"/) || [])[1];
const ids = ["NonjJz3Itm0", "97PvHHgo78k", "Gx0Gu9MoLUE", "aJuZJ8IGVr8"];

fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.join(",")}&key=${key}`)
    .then(r => r.json())
    .then(d => {
        if (d.error) { console.log("YT ERROR:", d.error.message); process.exit(1); }
        console.log("YT items returned:", d.items.length);
        let shorts = 0;
        d.items.forEach(i => {
            const dur = i.contentDetails && i.contentDetails.duration;
            const m = (dur || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const secs = m ? (+(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0)) : null;
            if (secs !== null && secs <= 60) shorts++;
            console.log("-", i.snippet.title.slice(0, 60), "|", dur, secs !== null && secs <= 60 ? "(would be excluded as Short)" : "");
        });
        console.log("Shorts that exclusion logic would skip:", shorts);
    })
    .catch(e => { console.log("fetch fail", e.message); process.exit(1); });
