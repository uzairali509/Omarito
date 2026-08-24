// TEMP diagnostic script — inspect real MongoDB collections/fields via C:\omari-install's mongoose (read-only).
require("fs").readFileSync(".env", "utf8").split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
});
const mongoose = require("C:\\omari-install\\node_modules\\mongoose");

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
        console.log("CONNECTED to DB:", mongoose.connection.name);

        const cols = await mongoose.connection.db.listCollections().toArray();
        console.log("COLLECTIONS:", cols.map(c => c.name).join(", "));

        for (const c of cols) {
            const col = mongoose.connection.db.collection(c.name);
            const count = await col.estimatedDocumentCount();
            console.log(`\n===== ${c.name} (${count} docs) =====`);
            const sample = await col.find({}).limit(3).toArray();
            const keys = new Set();
            sample.forEach(d => Object.keys(d).forEach(k => keys.add(k)));
            console.log("FIELDS:", [...keys].join(", "));
            sample.forEach((d, i) => {
                const slim = {};
                for (const k of Object.keys(d)) {
                    const v = d[k];
                    slim[k] = typeof v === "string" && v.length > 160 ? v.slice(0, 160) + "..." : v;
                }
                console.log(`-- doc ${i}:`, JSON.stringify(slim));
            });
        }

        // Handle distribution inside videos via webVideoUrl
        const vids = mongoose.connection.db.collection("videos");
        const urls = await vids.distinct("webVideoUrl").catch(() => null);
        if (urls && urls.length) {
            console.log("\n===== webVideoUrl handle distribution =====");
            const counts = {};
            urls.forEach(u => {
                const m = String(u).match(/tiktok\.com\/@([^/]+)\//i);
                const handle = m ? m[1] : "(no-handle) " + String(u).slice(0, 60);
                counts[handle] = (counts[handle] || 0) + 1;
            });
            Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log(`@${h}: ${n}`));
            console.log("total distinct webVideoUrl:", urls.length);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (e) {
        console.error("INSPECT FAILED:", e.message);
        process.exit(1);
    }
})();
