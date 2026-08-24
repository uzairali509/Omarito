const express = require("express");
const router = express.Router();
const upload = require("../middlewares/uploadMiddleware");
const {
    homePage,
    signupUser,
    loginUser,
    getUser,
    deleteAccount,
    updateUser,
    sendResetCode,
    resetPassword,
    saveMessage
} = require("../controllers/authController");

// Home
router.get("/", homePage);

// Auth
router.post("/signup", upload.single("image"), signupUser);
router.post("/login", loginUser);
router.get("/get-user", getUser);
router.delete("/delete-account", deleteAccount);
router.put("/update-user", upload.single("image"), updateUser);
router.post("/send-reset-code", sendResetCode);
router.post("/reset-password", resetPassword);
router.post("/save-message", saveMessage);

module.exports = router;
