// Test the formatStat function as used on the homepage
function formatStat(num) {
    if (num === null || num === undefined) return "0";
    const n = Number(num);
    if (isNaN(n)) return "0";
    if (n < 1000) return n.toString();
    if (n < 1000000) {
        const k = n / 1000;
        return k >= 100 ? Math.round(k) + "K" : k >= 10 ? k.toFixed(1) + "K" : k.toFixed(2) + "K";
    }
    if (n < 1000000000) {
        const m = n / 1000000;
        return m >= 100 ? Math.round(m) + "M" : m >= 10 ? m.toFixed(1) + "M" : m.toFixed(2) + "M";
    }
    const b = n / 1000000000;
    return b >= 100 ? Math.round(b) + "B" : b >= 10 ? b.toFixed(1) + "B" : b.toFixed(2) + "B";
}

// Test with real values
console.log("Followers: 59000000 ->", formatStat(59000000));
console.log("Likes: 780800000 ->", formatStat(780800000));
console.log("Views: 509261700 ->", formatStat(509261700));

// Test edge cases
console.log("\nEdge cases:");
console.log("1000 ->", formatStat(1000));
console.log("1500 ->", formatStat(1500));
console.log("1000000 ->", formatStat(1000000));
console.log("3862164 ->", formatStat(3862164));
console.log("32828396 ->", formatStat(32828396));
