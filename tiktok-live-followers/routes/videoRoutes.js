const express = require("express");
const router = express.Router();
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const Favorite = require("../models/Favorite");
const User = require("../models/User");
const Video = require("../models/Video");

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }

        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ success: false, error: "User not found" });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: "Invalid authentication" });
    }
};

// ==================== LIKE SYSTEM ====================

// Get like status and count for a video
router.get("/api/videos/:id/like", async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.query.type || 'tiktok';
        
        // Get total like count
        const likeCount = await Like.countDocuments({ video: id, videoType });
        
        // Check if current user has liked (if authenticated)
        let userLiked = false;
        const token = req.cookies.token;
        if (token) {
            try {
                const jwt = require("jsonwebtoken");
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userLike = await Like.findOne({ 
                    user: decoded.id, 
                    video: id, 
                    videoType 
                });
                userLiked = !!userLike;
            } catch (error) {
                // Token invalid, continue without user like status
            }
        }

        res.json({ 
            success: true, 
            likeCount, 
            userLiked 
        });
    } catch (error) {
        console.error("Get like status error:", error);
        res.status(500).json({ success: false, error: "Failed to get like status" });
    }
});

// Like a video (requires authentication)
router.post("/api/videos/:id/like", authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.body.type || 'tiktok';
        
        // Check if already liked
        const existingLike = await Like.findOne({ 
            user: req.user._id, 
            video: id, 
            videoType 
        });
        
        if (existingLike) {
            return res.json({ 
                success: true, 
                alreadyLiked: true, 
                likeCount: await Like.countDocuments({ video: id, videoType }),
                userLiked: true
            });
        }
        
        // Create new like
        await Like.create({
            user: req.user._id,
            video: id,
            videoType
        });
        
        const likeCount = await Like.countDocuments({ video: id, videoType });
        
        res.json({ 
            success: true, 
            likeCount, 
            userLiked: true 
        });
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error (already liked)
            const likeCount = await Like.countDocuments({ video: id, videoType });
            return res.json({ 
                success: true, 
                alreadyLiked: true, 
                likeCount,
                userLiked: true
            });
        }
        console.error("Like video error:", error);
        res.status(500).json({ success: false, error: "Failed to like video" });
    }
});

// Unlike a video (requires authentication)
router.delete("/api/videos/:id/like", authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.query.type || 'tiktok';
        
        await Like.deleteOne({ 
            user: req.user._id, 
            video: id, 
            videoType 
        });
        
        const likeCount = await Like.countDocuments({ video: id, videoType });
        
        res.json({ 
            success: true, 
            likeCount, 
            userLiked: false 
        });
    } catch (error) {
        console.error("Unlike video error:", error);
        res.status(500).json({ success: false, error: "Failed to unlike video" });
    }
});

// ==================== COMMENT SYSTEM ====================

// Get comments for a video
router.get("/api/videos/:id/comments", async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.query.type || 'tiktok';
        
        const comments = await Comment.find({ video: id, videoType })
            .populate('user', 'firstname lastname username image')
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ 
            success: true, 
            comments: comments.map(c => ({
                id: c._id,
                text: c.text,
                user: {
                    firstname: c.user.firstname,
                    lastname: c.user.lastname,
                    username: c.user.username,
                    image: c.user.image
                },
                createdAt: c.createdAt,
                isOwn: false // Will be set on frontend
            }))
        });
    } catch (error) {
        console.error("Get comments error:", error);
        res.status(500).json({ success: false, error: "Failed to get comments" });
    }
});

// Post a comment (requires authentication)
router.post("/api/videos/:id/comments", authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const videoType = req.body.type || 'tiktok';
        
        // Validate comment text
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, error: "Comment text is required" });
        }
        
        if (text.length > 1000) {
            return res.status(400).json({ success: false, error: "Comment too long (max 1000 characters)" });
        }
        
        // Create comment
        const comment = await Comment.create({
            user: req.user._id,
            video: id,
            videoType,
            text: text.trim()
        });
        
        // Populate user data
        await comment.populate('user', 'firstname lastname username image');
        
        res.json({ 
            success: true, 
            comment: {
                id: comment._id,
                text: comment.text,
                user: {
                    firstname: comment.user.firstname,
                    lastname: comment.user.lastname,
                    username: comment.user.username,
                    image: comment.user.image
                },
                createdAt: comment.createdAt,
                isOwn: true
            }
        });
    } catch (error) {
        console.error("Post comment error:", error);
        res.status(500).json({ success: false, error: "Failed to post comment" });
    }
});

// Delete a comment (requires authentication and ownership)
router.delete("/api/videos/:id/comments/:commentId", authenticateUser, async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json({ success: false, error: "Comment not found" });
        }
        
        // Check ownership
        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: "You can only delete your own comments" });
        }
        
        await Comment.findByIdAndDelete(commentId);
        
        res.json({ success: true });
    } catch (error) {
        console.error("Delete comment error:", error);
        res.status(500).json({ success: false, error: "Failed to delete comment" });
    }
});

// ==================== DOWNLOAD CONTROL ====================

// Download video (requires authentication)
router.get("/api/videos/:id/download", authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.query.type || 'tiktok';
        
        if (videoType === 'tiktok') {
            // Get TikTok video info
            const video = await Video.findOne({ 
                $or: [{ videoId: id }, { tiktok_id: id }],
                isActive: true 
            });
            
            if (!video) {
                return res.status(404).json({ success: false, error: "Video not found" });
            }
            
            // Get fresh play URL
            const axios = require("axios");
            try {
                const { data } = await axios.get(
                    `https://www.tikwm.com/api/?url=${encodeURIComponent(video.webVideoUrl)}`,
                    { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
                );
                
                if (data?.data?.play) {
                    // Redirect to the download URL
                    return res.redirect(data.data.play);
                } else {
                    return res.status(404).json({ success: false, error: "Download URL not available" });
                }
            } catch (error) {
                console.error("TikTok download error:", error);
                return res.status(500).json({ success: false, error: "Failed to get download URL" });
            }
        } else if (videoType === 'youtube') {
            // YouTube downloads are handled differently due to ToS
            return res.status(403).json({ 
                success: false, 
                error: "YouTube downloads are not supported due to Terms of Service" 
            });
        }
        
        res.status(400).json({ success: false, error: "Invalid video type" });
    } catch (error) {
        console.error("Download video error:", error);
        res.status(500).json({ success: false, error: "Failed to process download" });
    }
});

// ==================== FAVORITE SYSTEM ====================

// Get favorite status and count for a video
router.get("/api/videos/:id/favorite", async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.query.type || 'tiktok';
        
        // Get total favorite count
        const favoriteCount = await Favorite.countDocuments({ video: id, videoType });
        
        // Check if current user has favorited (if authenticated)
        let userFavorited = false;
        const token = req.cookies.token;
        if (token) {
            try {
                const jwt = require("jsonwebtoken");
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userFavorite = await Favorite.findOne({ 
                    user: decoded.id, 
                    video: id, 
                    videoType 
                });
                userFavorited = !!userFavorite;
            } catch (error) {
                // Token invalid, continue without user favorite status
            }
        }
        
        res.json({ 
            success: true, 
            favoriteCount, 
            userFavorited 
        });
    } catch (error) {
        console.error("Get favorite status error:", error);
        res.status(500).json({ success: false, error: "Failed to get favorite status" });
    }
});

// Favorite a video (requires authentication)
router.post("/api/videos/:id/favorite", authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.body.type || 'tiktok';
        
        // Check if already favorited
        const existingFavorite = await Favorite.findOne({ 
            user: req.user._id, 
            video: id, 
            videoType 
        });
        
        if (existingFavorite) {
            return res.json({ 
                success: true, 
                alreadyFavorited: true, 
                favoriteCount: await Favorite.countDocuments({ video: id, videoType }),
                userFavorited: true
            });
        }
        
        // Create new favorite
        await Favorite.create({
            user: req.user._id,
            video: id,
            videoType
        });
        
        const favoriteCount = await Favorite.countDocuments({ video: id, videoType });
        
        res.json({ 
            success: true, 
            favoriteCount, 
            userFavorited: true 
        });
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error (already favorited)
            const favoriteCount = await Favorite.countDocuments({ video: id, videoType });
            return res.json({ 
                success: true, 
                alreadyFavorited: true, 
                favoriteCount,
                userFavorited: true
            });
        }
        console.error("Favorite video error:", error);
        res.status(500).json({ success: false, error: "Failed to favorite video" });
    }
});

// Unfavorite a video (requires authentication)
router.delete("/api/videos/:id/favorite", authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const videoType = req.query.type || 'tiktok';
        
        await Favorite.deleteOne({ 
            user: req.user._id, 
            video: id, 
            videoType 
        });
        
        const favoriteCount = await Favorite.countDocuments({ video: id, videoType });
        
        res.json({ 
            success: true, 
            favoriteCount, 
            userFavorited: false 
        });
    } catch (error) {
        console.error("Unfavorite video error:", error);
        res.status(500).json({ success: false, error: "Failed to unfavorite video" });
    }
});

// Get user's favorites
router.get("/api/user/favorites", authenticateUser, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        
        const [favorites, total] = await Promise.all([
            Favorite.find({ user: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Favorite.countDocuments({ user: req.user._id })
        ]);
        
        // Enrich favorites with video data
        const videoIds = favorites.map(f => f.video);
        const videoTypes = favorites.map(f => f.videoType);
        
        // Fetch video details from Video collection
        const videos = await Video.find({
            $or: videoIds.map((id, index) => ({
                videoId: id,
                platform: videoTypes[index] === 'youtube' ? 'youtube' : 'tiktok'
            }))
        }).lean();
        
        // Create lookup map
        const videoMap = new Map();
        videos.forEach(v => {
            const key = `${v.platform || 'tiktok'}:${v.videoId}`;
            videoMap.set(key, v);
        });
        
        // Enrich favorites
        const enrichedFavorites = favorites.map(fav => {
            const key = `${fav.videoType}:${fav.video}`;
            const video = videoMap.get(key);
            return {
                ...fav,
                videoData: video || null
            };
        });
        
        res.json({ 
            success: true, 
            favorites: enrichedFavorites,
            page,
            limit,
            total,
            hasMore: skip + favorites.length < total
        });
    } catch (error) {
        console.error("Get favorites error:", error);
        res.status(500).json({ success: false, error: "Failed to get favorites" });
    }
});

module.exports = router;

module.exports = router;