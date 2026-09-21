const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    video: {
        type: String,
        required: true
    },
    videoType: {
        type: String,
        enum: ['tiktok', 'youtube'],
        default: 'tiktok'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent duplicate favorites from same user on same video
favoriteSchema.index({ user: 1, video: 1, videoType: 1 }, { unique: true });
favoriteSchema.index({ video: 1 });
favoriteSchema.index({ user: 1 });
favoriteSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Favorite", favoriteSchema);