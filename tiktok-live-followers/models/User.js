const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    tiktokId: String,
    googleId: String,
    authProvider: {
        type: String,
        default: 'local',
        enum: ['local', 'google', 'tiktok']
    },
    firstname: String,
    lastname: String,
    username: String,
    age: Number,
    date: String,
    email: {
        type: String,
        unique: true
    },
    password: String,
    image: String,

    resetCode: String,
    resetCodeExpire: Date

});

userSchema.index({ googleId: 1 });
userSchema.index({ tiktokId: 1 });

module.exports = mongoose.model("User", userSchema);