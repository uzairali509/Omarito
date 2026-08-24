const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

require("./cron");


require("dotenv").config();
// ✅ Routes import
const authRoutes = require("./routes/authRoutes");
const socialRoutes = require("./routes/socialRoutes");
const videoRoutes = require("./routes/videoRoutes");
const cookieParser = require("cookie-parser");


const app = express();
dotenv.config();
app.use(cookieParser());

app.set('trust proxy', true);

app.use((req, res, next) => {
    // Agar request http hai aur live domain par hai toh https par redirect karo
    if (req.header('x-forwarded-proto') !== 'https' && req.hostname !== 'localhost') {
        return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
});


// =======================
// MIDDLEWARES
// =======================

// origin: true reflects the requesting origin (works from Live Server
// 127.0.0.1:5500 too); credentials allows cookie/session calls cross-origin
app.use(cors({ origin: true, credentials: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Static files

app.use("/Public", express.static(path.join(__dirname, "public")));
app.use("/Codes", express.static(path.join(__dirname, "../Codes")));
app.use("/Public", express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static("Public"));
app.use("/Public", express.static("Public"));



// Static files
// app.use(express.static(path.join(__dirname, "Public")));

// app.use("/Public", express.static(path.join(__dirname, "Public")));

// app.use("/Codes", express.static(path.join(__dirname, "../Codes")));

// app.use("/uploads", express.static(path.join(__dirname, "Public/uploads")));

// Serve the actual Omari.to homepage at root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

// API health check moved to /api/health
app.get("/api/health", (req, res) => {
    res.json({ message: "Omari.to API is running!" });
});

// /Codes/ has no index.html of its own — the homepage is the project
// root index.html, so send visitors there (page files under /Codes/*
// are still served by the static mount above).
app.get("/Codes", (req, res) => res.redirect("/index.html"));
app.get("/Codes/", (req, res) => res.redirect("/index.html"));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: "Internal Server Error" });
});


// Privacy Policy
app.get("/privacy", (req, res) => {
    res.send(`
        <h1>Privacy Policy</h1>
        <p>This website displays TikTok videos and creator profiles.</p>
    `);
});


// Terms of Service
app.get("/terms", (req, res) => {
    res.send(`
        <h1>Terms of Service</h1>
        <p>Users may browse public social media content on this website.</p>
    `);
});





// Session
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true
}));



// =======================
// DATABASE
// =======================

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// =======================
// ROUTES
// =======================

// Auth routes (login/signup)
app.use("/", authRoutes);

// TikTok + YouTube routes
app.use("/", socialRoutes);

// Video interaction routes (likes, comments, downloads)
app.use("/", videoRoutes);

app.post('/logout', (req, res) => {

    try {

        res.clearCookie('token', {
            httpOnly: true,
            sameSite: 'lax',
            secure: false
        });

        res.json({
            success: true,
            message: 'Logout successful'
        });

    }
    catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

// ... tumhare purane requires ...
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const TikTokStrategy = require("passport-tiktok-auth").Strategy;
const User = require("./models/User");
const jwt = require("jsonwebtoken");

// ✅ GOOGLE PASSPORT CONFIGURATION
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const googleId = profile.id;
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const displayName = profile.displayName || "";
            const firstName = profile.name && profile.name.givenName ? profile.name.givenName : displayName.split(" ")[0] || "User";
            const lastName = profile.name && profile.name.familyName ? profile.name.familyName : displayName.split(" ").slice(1).join(" ") || "";
            const image = profile.photos && profile.photos[0] ? profile.photos[0].value : "default-user.png";

            // 1. Find by Google ID first
            let user = await User.findOne({ googleId: googleId });
            if (user) {
                return done(null, user);
            }

            // 2. If email exists, find existing local account with same email
            if (email) {
                user = await User.findOne({ email: email.toLowerCase() });
                if (user) {
                    // Link Google identity to existing account
                    user.googleId = googleId;
                    if (!user.authProvider || user.authProvider === 'local') {
                        user.authProvider = 'google';
                    }
                    if (!user.image || user.image === 'default-user.png') {
                        user.image = image;
                    }
                    await user.save();
                    return done(null, user);
                }
            }

            // 3. Create new user
            const username = "@" + firstName.toLowerCase() + (lastName ? lastName.toLowerCase() : "") + "_" + googleId.substring(0, 4);
            user = await User.create({
                googleId: googleId,
                authProvider: 'google',
                firstname: firstName,
                lastname: lastName,
                username: username,
                email: email ? email.toLowerCase() : `${googleId}@google.omari.to`,
                image: image,
                password: "google_oauth"
            });

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

// ✅ TIKTOK PASSPORT CONFIGURATION
passport.use(new TikTokStrategy({
    clientID: process.env.TIKTOK_CLIENT_KEY,      // Client Key
    clientSecret: process.env.TIKTOK_CLIENT_SECRET, // Client Secret
    callbackURL: process.env.TIKTOK_REDIRECT_URI,
    scope: ["user.info.basic"]
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const tiktokId = profile.id;
            const username = profile.username || profile.open_id || "tiktok_user";
            const displayName = profile.displayName || profile.nickname || username;
            const avatarUrl = profile.avatarUrl || profile.avatar || "default-user.png";

            // 1. Find by tiktokId first (returning user)
            let user = await User.findOne({ tiktokId: tiktokId });
            if (user) {
                // Update avatar if missing
                if (!user.image || user.image === 'default-user.png') {
                    user.image = avatarUrl;
                    await user.save();
                }
                return done(null, user);
            }

            // 2. Check if email-based account already exists (link TikTok to existing)
            const fakeEmail = `${username}@tiktok.omari.to`;
            user = await User.findOne({ email: fakeEmail });
            if (user) {
                user.tiktokId = tiktokId;
                if (!user.authProvider || user.authProvider === 'local') {
                    user.authProvider = 'tiktok';
                }
                if (!user.image || user.image === 'default-user.png') {
                    user.image = avatarUrl;
                }
                await user.save();
                return done(null, user);
            }

            // 3. Create new user
            user = await User.create({
                tiktokId: tiktokId,
                authProvider: 'tiktok',
                firstname: displayName,
                lastname: "",
                username: "@" + username,
                email: fakeEmail,
                image: avatarUrl,
                password: "tiktok_oauth"
            });

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

// ✅ Passport Middleware
app.use(passport.initialize());

// Passport session serialization (minimal — the app primarily uses JWT cookies,
// but serialize/deserialize are required for passport.authenticate to work)
passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ✅ GOOGLE OAUTH ROUTES
app.get("/auth/google", (req, res, next) => {
    // Store where the user came from so we can redirect back after login
    if (req.query.from) {
        req.session.googleReturnTo = req.query.from;
    }
    passport.authenticate("google", {
        scope: ["openid", "profile", "email"]
    })(req, res, next);
});

app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/Codes/LogIn.html?error=google_failed" }),
    (req, res) => {
        try {
            // Generate JWT token (same as normal login)
            const token = jwt.sign(
                { id: req.user._id },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.clearCookie("token");
            res.cookie("token", token, {
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            // Redirect to where they came from, or homepage
            const returnTo = req.session.googleReturnTo || "/";
            delete req.session.googleReturnTo;
            res.redirect(returnTo);
        } catch (err) {
            console.error("Google callback error:", err);
            res.redirect("/Codes/LogIn.html?error=google_failed");
        }
    }
);

// ✅ TIKTOK OAUTH ROUTES
app.get("/auth/tiktok", (req, res, next) => {
    if (req.query.from) {
        req.session.tiktokReturnTo = req.query.from;
    }
    passport.authenticate("tiktok")(req, res, next);
});

app.get("/auth/tiktok/callback",
    passport.authenticate("tiktok", { failureRedirect: "/Codes/LogIn.html?error=tiktok_failed" }),
    (req, res) => {
        try {
            const token = jwt.sign(
                { id: req.user._id },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.clearCookie("token");
            res.cookie("token", token, {
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            const returnTo = req.session.tiktokReturnTo || "/";
            delete req.session.tiktokReturnTo;
            res.redirect(returnTo);
        } catch (err) {
            console.error("TikTok callback error:", err);
            res.redirect("/Codes/LogIn.html?error=tiktok_failed");
        }
    }
);


// =======================
// SERVER
// =======================

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
});
