$content = Get-Content "F:\TikTok Web\Codes\script.js" -Raw
# Use a simple approach - find the start and end markers and remove everything between
$startMarker = "// Update the charactersBtn click handler in your existing code"
$endMarker = "// ===== PROFILE PANEL TOGGLE & DATA FETCHING ====="

$startIndex = $content.IndexOf($startMarker)
$endIndex = $content.IndexOf($endMarker, $startIndex)

if ($startIndex -ge 0 -and $endIndex -ge 0) {
    $newContent = $content.Substring(0, $startIndex) + $content.Substring($endIndex)
    Set-Content "F:\TikTok Web\Codes\script.js" $newContent
    "Done - removed duplicate charactersBtn handler"
} else {
    "Markers not found"
}