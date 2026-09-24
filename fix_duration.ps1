$content = Get-Content "F:\TikTok Web\Codes\script.js" -Raw
$old = "`n}" + "`n" + "// ===== MENU TOGGLE LOGIC =====" + "`n" + 'const toggle = document.getElementById("menuToggle");'
$new = "`n}" + "`n" + "// ===== DURATION FORMATTING =====" + "`n" + "function formatDuration(secs) {" + "`n" + "    secs = Math.round(Number(secs) || 0);" + "`n" + "    if (!secs) return \"\";" + "`n" + "    const h = Math.floor(secs / 3600);" + "`n" + "    const m = Math.floor((secs % 3600) / 60);" + "`n" + "    const s = secs % 60;" + "`n" + "    return h ? `\${h}:\${String(m).padStart(2, \"0\")}:\${String(s).padStart(2, \"0\")}`" + "`n" + "        : `\${m}:\${String(s).padStart(2, \"0\")}`;" + "`n" + "}" + "`n" + "`n// ===== MENU TOGGLE LOGIC =====" + "`n" + 'const toggle = document.getElementById("menuToggle");'
$content = $content -replace [regex]::Escape($old), $new
Set-Content "F:\TikTok Web\Codes\script.js" $newContent
"Done"