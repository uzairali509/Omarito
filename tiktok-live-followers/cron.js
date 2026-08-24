const cron = require("node-cron");
const { exec } = require("child_process");

console.log("🕒 Cron jobs started...");

// Prevent overlapping sync jobs
let isSyncRunning = false;
let isPlaylistSyncRunning = false;

// Configurable sync interval from .env (default 15 minutes)
const SYNC_INTERVAL_MINUTES = parseInt(process.env.TIKTOK_SYNC_INTERVAL_MINUTES || "15", 10);
const SYNC_CRON_PATTERN = `*/${SYNC_INTERVAL_MINUTES} * * * *`;

console.log(`📅 TikTok video sync interval: ${SYNC_INTERVAL_MINUTES} minutes`);

// Run video sync at configured interval
cron.schedule(SYNC_CRON_PATTERN, () => {
  if (isSyncRunning) {
    console.log("⏳ Video sync already running, skipping this cycle");
    return;
  }

  console.log("🔄 Running TikTok video sync...");
  isSyncRunning = true;

  exec("node scripts/syncVideos.js", (error, stdout, stderr) => {
    isSyncRunning = false;
    if (error) {
      console.error("❌ Sync Error:", error);
    } else {
      console.log("✅ Video sync completed");
      if (stdout) console.log(stdout.trim());
    }
  });
});

// Rankings cache warm-up on startup and every N hours (configurable)
// This just ensures the in-memory cache is populated after a server restart.
const RANKINGS_CACHE_MINUTES = parseInt(process.env.RANKINGS_CACHE_MINUTES || "60", 10);
const RANKINGS_CRON = `0 */${Math.max(1, Math.round(RANKINGS_CACHE_MINUTES / 60))} * * *`;
setTimeout(() => {
  // Warm up rankings cache 8 seconds after startup
  const { loadRankingsCache } = (() => {
    try { return require("./routes/socialRoutes"); } catch(e) { return {}; }
  })();
  if (typeof loadRankingsCache === "function") {
    loadRankingsCache().catch(e => console.error("[cron] Rankings cache warm-up failed:", e.message));
  }
}, 8000);

// Playlist sync runs once every 6 hours (playlists change rarely)
cron.schedule("0 */6 * * *", () => {
  if (isPlaylistSyncRunning) {
    console.log("⏳ Playlist sync already running, skipping");
    return;
  }
  console.log("🎵 Running TikTok playlist sync...");
  isPlaylistSyncRunning = true;
  exec("node scripts/syncPlaylists.js", (error, stdout, stderr) => {
    isPlaylistSyncRunning = false;
    if (error) {
      console.error("❌ Playlist sync error:", error);
    } else {
      console.log("✅ Playlist sync completed");
      if (stdout) console.log(stdout.trim());
    }
  });
});

// TikTok CDN thumbnails are signed and expire after a few days.
// Refresh expired thumbnails of the allowed accounts every 6 hours so
// the Shorts grid never shows 403/broken images.
cron.schedule("30 */6 * * *", () => {
  console.log("🖼️ Running expired thumbnail refresher...");
  exec("node scripts/refreshExpiredThumbnails.js", (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Thumbnail refresh error:", error);
    } else {
      console.log("✅ Thumbnail refresh completed");
      if (stdout) console.log(stdout.trim());
    }
  });
});

// Optional initial sync on startup (configurable)
// Disabled by default to prevent startup issues
if (process.env.RUN_INITIAL_SYNC === "true") {
  console.log("🚀 Running initial sync on startup...");
  setTimeout(() => {
    if (!isSyncRunning) {
      isSyncRunning = true;
      exec("node scripts/syncVideos.js", (error, stdout, stderr) => {
        isSyncRunning = false;
        if (error) {
          console.error("❌ Initial sync error:", error);
        } else {
          console.log("✅ Initial sync completed");
          if (stdout) console.log(stdout.trim());
        }
      });
    }
  }, 5000);
} else {
  console.log("ℹ️ Initial sync disabled. Set RUN_INITIAL_SYNC=true to enable.");
}
