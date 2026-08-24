// TEMP diagnostic script — inspect real MongoDB collections/fields. Delete after use.
require("fs").readFileSync(".env", "utf8").split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
});
const mongoose = require("./node_modules/.pnpm/mongoose@9.9.2/node_modules/mongoose");

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
        console.log("CONNECTED to", mongoose.connection.name);

        const cols = await mongoose.connection.db.listCollections().toArray();
        console.log("COLLECTIONS:", cols.map(c => c.name).join(", "));

        for (const c of cols) {
            const col = mongoose.connection.db.collection(c.name);
            const count = await col.estimatedDocumentCount();
            console.log(`\n===== ${c.name} (${count} docs) =====`);
            const sample = await col.find({}).limit(3).toArray();
            // union of keys across samples
            const keys = new Set();
            sample.forEach(d => Object.keys(d).forEach(k => keys.add(k)));
            console.log("FIELDS:", [...keys].join(", "));
            sample.forEach((d, i) => {
                const slim = {};
                for (const k of Object.keys(d)) {
                    const v = d[k];
                    slim[k] = typeof v === "string" && v.length > 160 ? v.slice(0, 160) + "…" : v;
                }
                console.log(`-- doc ${i}:`, JSON.stringify(slim));
            });
        }

        // Distinct handle distribution in videos via webVideoUrl (if present)
        const vids = mongoose.connection.db.collection("videos");
        const urls = await vids.distinct("webVideoUrl").catch(() => null);
        if (urls) {
            console.log("\n===== webVideoUrl distinct (first 40) =====");
            urls.slice(0, 40).forEach(u => console.log(u));
            console.log("total distinct webVideoUrl:", urls.length);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (e) {
        console.error("INSPECT FAILED:", e.message);
        process.exit(1);
    }
})();
