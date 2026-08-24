// Temp verification: grid per creator, pagination safety, fake rejection
const BASE = "http://localhost:3000";
const ALLOWED = ["@omari.to/", "@dilandyalieva/", "@hello.safia/"];

(async () => {
    let fail = 0;
    const check = (name, ok, extra = "") => {
        console.log((ok ? "PASS " : "FAIL ") + name + (extra ? " | " + extra : ""));
        if (!ok) fail++;
    };

    // 1) Per-creator grids
    const gridExpect = { "omari.to": "@omari.to/", "dilandyalieva": "@dilandyalieva/", "hello.safia": "@hello.safia/" };
    for (const [u, expect] of Object.entries(gridExpect)) {
        const d = await (await fetch(`${BASE}/tiktok-grid-videos?username=${u}`)).json();
        const allMine = d.success && d.videos.length > 0 && d.videos.every(() => true);
        check(`grid @${u} count=${d.videos.length}`, d.success && d.videos.length > 0);
        // verify every card id really belongs to that handle via DB-free proxy: re-request with fake username must be empty
    }

    // grid URL purity: fetch raw and ensure response shape ok
    // 2) Fake / unknown usernames
    for (const u of ["ajlukz40", "omor2.011", "omari.to005", "someoneelse"]) {
        const d = await (await fetch(`${BASE}/tiktok-grid-videos?username=${u}`)).json();
        check(`grid fake @${u} -> empty`, d.success && d.videos.length === 0);
    }

    // 3) /omari-videos pagination — every video_url must be an allowed account
    let scanned = 0;
    for (let page = 1; page <= 10; page++) {
        const d = await (await fetch(`${BASE}/omari-videos?page=${page}&limit=30`)).json();
        if (!d.success) { check(`omari-videos page ${page} success`, false); break; }
        scanned += d.videos.length;
        const bad = d.videos.filter(v => !ALLOWED.some(a => v.video_url.includes(a)));
        if (bad.length) { check(`omari-videos page ${page} purity`, false, JSON.stringify(bad.slice(0, 2))); break; }
        if (!d.hasMore) { check(`omari-videos pages 1..${page} pure (${scanned} videos, total=${d.total})`, true); break; }
    }

    // 4) grid purity via /omari-videos-style handle check per creator using grid ids mapped to tiktok URLs
    for (const [u, expect] of Object.entries(gridExpect)) {
        const d = await (await fetch(`${BASE}/tiktok-grid-videos?username=${u}`)).json();
        const urls = await (await fetch(`${BASE}/omari-videos?page=1&limit=50`)).json();
        // cross-check: every grid id must appear in omari-videos with the right handle
        const byId = {};
        for (let p = 1; p <= 10; p++) {
            const dd = await (await fetch(`${BASE}/omari-videos?page=${p}&limit=50`)).json();
            dd.videos.forEach(v => byId[v.id] = v.video_url);
            if (!dd.hasMore) break;
        }
        const mismatched = d.videos.filter(v => !(byId[v.id] || "").includes(expect));
        check(`grid @${u}: all ${d.videos.length} cards map to ${expect}`, mismatched.length === 0, mismatched.length ? JSON.stringify(mismatched.slice(0, 2)) : "");
    }

    // 5) Frontend pages served
    for (const q of ["", "?creator=Omar", "?creator=Dylan", "?creator=Sufiya"]) {
        const r = await fetch(`${BASE}/Codes/videos.html${q}`);
        check(`videos.html${q} -> ${r.status}`, r.status === 200);
    }
    const idx = await fetch(`${BASE}/`);
    check("homepage / -> 200", idx.status === 200);

    // 6) CORS header for Live Server origin
    const corsRes = await fetch(`${BASE}/tiktok-grid-videos?username=omari.to`, { headers: { Origin: "http://127.0.0.1:5500" } });
    check("CORS allows Live Server origin", corsRes.headers.get("access-control-allow-origin") === "http://127.0.0.1:5500", corsRes.headers.get("access-control-allow-origin"));

    console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("ERROR", e); process.exit(1); });
