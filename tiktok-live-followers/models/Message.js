const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    firstname: String,
    email: String,
    country: String,
    city: String,
    message: String
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);