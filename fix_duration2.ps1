$content = Get-Content "F:\TikTok Web\Codes\script.js" -Raw

# Find the position after "}" before "// ===== MENU TOGGLE LOGIC ====="
$pattern = "// ===== MENU TOGGLE LOGIC ====="
$idx = $content.IndexOf($pattern)

if ($idx -ge 0) {
    # Find the closing brace before this pattern
    $searchStart = $idx - 10
    $braceIdx = $content.LastIndexOf("`n}", $idx)
    
    if ($braceIdx -ge 0) {
        # Insert after the closing brace
        $insertPos = $braceIdx + 2  # After "}\n"
        $newFunc = "`n// ===== DURATION FORMATTING =====" + "`n" + 
            "function formatDuration(secs) {" + "`n" + 
            "    secs = Math.round(Number(secs) || 0);" + "`n" + 
            "    if (!secs) return \"\";" + "`n" + 
            "    const h = Math.floor(secs / 3600);" + "`n" + 
            "    const m = Math.floor((secs % 3600) / 60);" + "`n" + 
            "    const s = secs % 60;" + "`n" + 
            "    return h ? `\${h}:\${String(m).padStart(2, \"0\")}:\${String(s).padStart(2, \"0\")}`" + "`n" + 
            "        : `\${m}:\${String(s).padStart(2, \"0\")}`;" + "`n" + 
            "}" + "`n"
        $newContent = $content.Substring(0, $insertPos) + $newFunc + $content.Substring($insertPos)
        Set-Content "F:\TikTok Web\Codes\script.js" $newContent
        "Done - Inserted at $insertPos"
    } else {
        "Could not find brace"
    }
} else {
    "Pattern not found"
}