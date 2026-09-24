const fs = require('fs');

const content = fs.readFileSync('F:\\TikTok Web\\Codes\\script.js', 'utf8');

const newFunc = "\n// ===== DURATION FORMATTING =====\n" +
    "function formatDuration(secs) {\n" +
    "    secs = Math.round(Number(secs) || 0);\n" +
    "    if (!secs) return \"\";\n" +
    "    const h = Math.floor(secs / 3600);\n" +
    "    const m = Math.floor((secs % 3600) / 60);\n" +
    "    const s = secs % 60;\n" +
    "    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')\n" +
    "        : m + ':' + String(s).padStart(2, '0');\n" +
    "}\n";

// Find the position after "}" before "// ===== MENU TOGGLE LOGIC ====="
const pattern = "// ===== MENU TOGGLE LOGIC =====";
const idx = content.indexOf(pattern);

if (idx >= 0) {
    // Find the closing brace before this pattern
    const braceIdx = content.lastIndexOf("\n}", idx);
    
    if (braceIdx >= 0) {
        const insertPos = braceIdx + 2;
        const newContent = content.substring(0, insertPos) + newFunc + content.substring(insertPos);
        fs.writeFileSync('F:\\TikTok Web\\Codes\\script.js', newContent, 'utf8');
        console.log('Done - Inserted at', insertPos);
    } else {
        console.log('Could not find brace');
    }
} else {
    console.log('Pattern not found');
}