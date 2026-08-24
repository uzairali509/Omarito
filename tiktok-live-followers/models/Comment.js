const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
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
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

commentSchema.index({ video: 1, createdAt: -1 });
commentSchema.index({ user: 1 });
commentSchema.index({ video: 1, videoType: 1 });

module.exports = mongoose.model("Comment", commentSchema);