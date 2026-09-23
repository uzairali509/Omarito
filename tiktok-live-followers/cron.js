const cron = require("node-cron");
const { exec } = require("child_process");
const { loadRankingsFromDB, getRankings } = require("./services/rankingService");

console.log("🕒 Cron jobs started...");

// Prevent overlapping sync jobs
let isSyncRunning = false;
let isPlaylistSyncRunning = false;
let isAccountStatsRefreshRunning = false;

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

// Account statistics refresh (followers, likes) for @omari.to
const ACCOUNT_STATS_REFRESH_HOURS = parseInt(process.env.ACCOUNT_STATS_REFRESH_INTERVAL_HOURS || "6", 10);
const ACCOUNT_STATS_CRON = `0 */${ACCOUNT_STATS_REFRESH_HOURS} * * *`;

console.log(`📊 Account stats refresh interval: ${ACCOUNT_STATS_REFRESH_HOURS} hours`);

cron.schedule(ACCOUNT_STATS_CRON, () => {
  if (isAccountStatsRefreshRunning) {
    console.log("⏳ Account stats refresh already running, skipping");
    return;
  }
  console.log("🔄 Refreshing TikTok account statistics for @omari.to...");
  isAccountStatsRefreshRunning = true;

  exec("node scripts/refreshAccountStats.js", (error, stdout, stderr) => {
    isAccountStatsRefreshRunning = false;
    if (error) {
      console.error("❌ Account stats refresh error:", error);
    } else {
      console.log("✅ Account stats refresh completed");
      if (stdout) console.log(stdout.trim());
    }
  });
});

// Rankings cache warm-up on startup using rankingService
setTimeout(() => {
  console.log("🔄 Warming up rankings cache...");
  loadRankingsFromDB().catch(e => console.error("[cron] Rankings cache warm-up failed:", e.message));
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

// Rankings refresh (configurable interval, default 6 hours)
const RANKINGS_REFRESH_HOURS = parseInt(process.env.RANKINGS_REFRESH_INTERVAL_HOURS || "6", 10);
const RANKINGS_CRON = `0 */${RANKINGS_REFRESH_HOURS} * * *`;

console.log(`🏆 Rankings refresh interval: ${RANKINGS_REFRESH_HOURS} hours`);

let isRankingsRefreshRunning = false;

cron.schedule(RANKINGS_CRON, async () => {
  if (isRankingsRefreshRunning) {
    console.log("⏳ Rankings refresh already running, skipping");
    return;
  }
  console.log("🔄 Refreshing TikTok rankings for @omari.to...");
  isRankingsRefreshRunning = true;

  try {
    // getRankings will attempt to fetch from real provider and update cache/DB
    const result = await getRankings();
    if (result.success) {
      console.log("✅ Rankings refresh completed:", result.rankings);
    } else {
      console.log("ℹ️ Rankings refresh: no provider configured or no data available");
    }
  } catch (err) {
    console.error("❌ Rankings refresh error:", err.message);
  } finally {
    isRankingsRefreshRunning = false;
  }
});