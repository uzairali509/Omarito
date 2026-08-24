function formatStat(num) {
    if (num === null || num === undefined) return "0";
    const n = Number(num);
    if (isNaN(n)) return "0";
    if (n < 1000) return n.toString();
    function clean(val, suffix) {
        let s = val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : Math.round(val).toString();
        if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
        return s + suffix;
    }
    if (n < 1000000) return clean(n / 1000, "K");
    if (n < 1000000000) return clean(n / 1000000, "M");
    return clean(n / 1000000000, "B");
}

// Test with user's exact examples
console.log("Expected -> Actual:");
console.log("1K ->", formatStat(1000));
console.log("1.5K ->", formatStat(1500));
console.log("1M ->", formatStat(1000000));
console.log("3.86M ->", formatStat(3862164));
console.log("32.8M ->", formatStat(32828396));
console.log("59M ->", formatStat(59000000));
console.log("781M ->", formatStat(780800000));
console.log("509M ->", formatStat(509261700));
