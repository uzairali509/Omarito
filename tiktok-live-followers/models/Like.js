const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
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

// Prevent duplicate likes from same user on same video
likeSchema.index({ user: 1, video: 1, videoType: 1 }, { unique: true });
likeSchema.index({ video: 1 });
likeSchema.index({ user: 1 });

module.exports = mongoose.model("Like", likeSchema);