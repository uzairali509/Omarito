const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
    {
        videoId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // TikTok's own unique video id (DB has a unique index on tiktok_id)
        tiktok_id: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        platform: {
            type: String,
            enum: ["tiktok", "youtube"],
            default: "tiktok"
        },

        creator: {
            type: String,
            default: "Other"
        },

        username: {
            type: String,
            default: ""
        },

        title: {
            type: String,
            default: ""
        },

        description: {
            type: String,
            default: ""
        },

        thumbnail: {
            type: String,
            default: ""
        },

        playUrl: {
            type: String,
            default: ""
        },

        webVideoUrl: {
            type: String,
            default: ""
        },

        musicName: {
            type: String,
            default: ""
        },

        musicAuthor: {
            type: String,
            default: ""
        },

        duration: {
            type: Number,
            default: 0
        },

        views: {
            type: Number,
            default: 0
        },

        likes: {
            type: Number,
            default: 0
        },

        comments: {
            type: Number,
            default: 0
        },

        shares: {
            type: Number,
            default: 0
        },

        saves: {
            type: Number,
            default: 0
        },

        hashtags: {
            type: [String],
            default: []
        },

        createTime: {
            type: Date,
            default: Date.now
        },

        avatar: {
            type: String,
            default: ""
        },

        verified: {
            type: Boolean,
            default: false
        },

        videoLanguage: {
            type: String,
            default: ""
        },

        country: {
            type: String,
            default: ""
        },

        source: {
            type: String,
            default: "Apify"
        },

        isTrending: {
            type: Boolean,
            default: false
        },

        isActive: {
            type: Boolean,
            default: true
        },

        // Official TikTok playlist memberships for this video.
        // Each entry is the numeric playlist ID string as it appears in
        // the official TikTok playlist URL (e.g. "7433667529204828933").
        // A video may belong to more than one playlist.
        playlistIds: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true,
        // Indexes already exist in the production DB (incl. unique tiktok_id_1);
        // do not let mongoose recreate/conflict with them at startup
        autoIndex: false
    }
);

// Single-field indexes (videoId unique index is already created by unique: true)
videoSchema.index({ creator: 1 });
videoSchema.index({ username: 1 });
videoSchema.index({ views: -1 });
videoSchema.index({ createTime: -1 });

// Text search index
videoSchema.index({
    title: "text",
    description: "text"
});

module.exports = mongoose.model("Video", videoSchema);
