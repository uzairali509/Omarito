const path = require("path");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const Message = require("../models/Message");



// ================= HOME =================
const homePage = (req, res) => {
    res.sendFile(path.join(__dirname, "../../index.html"));
};


// ================= SIGNUP =================
const signupUser = async (req, res) => {

    try {

        const {
            firstname,
            lastname,
            age,
            date,
            email,
            password
        } = req.body;


        const exist = await User.findOne({
            email: email.toLowerCase()
        });

        if (exist) {
            return res.status(400).json({
                success: false,
                error: ["User already exists"]
            });
        }


        const hash = await bcrypt.hash(password, 10);


        const newUser = new User({
            firstname,
            lastname,
            username: "@" + firstname + lastname,
            age,
            date,
            email: email.toLowerCase(),
            password: hash,
            image: req.file ? req.file.filename : "default-user.png"
        });


        await newUser.save();


        res.status(201).json({
            success: true,
            message: "Signup successful"
        });

    }
    catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: ["Signup error"]
        });
    }
};


// ================= LOGIN =================
const loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;


        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: ["Invalid Email"]
            });
        }


        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({
                success: false,
                error: ["Wrong Password"]
            });
        }


        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );


        res.clearCookie("token"); // old cookie remove first

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });


        res.json({
            success: true,
            user: {
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                image: user.image
            }
        });

    }
    catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: ["Login error"]
        });
    }
};


// ================= GET USER =================
// ================= GET USER =================
const getUser = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: "No token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 🔥 BIRTHDAY STATUS LOGIC (FIXED & ROBUST)
        let birthdayStatus = "normal"; // Default

        if (user.date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Time hata ke sirf date check karo

            const birthDate = new Date(user.date);
            const birthMonth = birthDate.getMonth(); // 0-11 (May = 4)
            const birthDay = birthDate.getDate();   // 1-31 (21 = 21)

            // Is saal ki birthday date banao (Year current year rakho)
            const nextBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
            nextBirthday.setHours(0, 0, 0, 0);

            // Agar is saal ki birthday guzar chuki hai, toh agle saal ki date lo
            if (nextBirthday.getTime() < today.getTime()) {
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }

            const diffTime = nextBirthday.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // Accurate calculation

            if (diffDays === 0) {
                birthdayStatus = "today"; // ✅ Aaj birthday hai
            } else if (diffDays <= 7) {
                birthdayStatus = "near"; // ✅ 1 week ke andar hai
            }
        }

        res.json({
            success: true,
            user: {
                firstname: user.firstname,
                lastname: user.lastname,
                username: user.username,
                email: user.email,
                age: user.age,
                date: user.date,
                image: user.image
            },
            birthdayStatus: birthdayStatus // ✅ Frontend ko bhej diya
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "User fetch failed" });
    }
};


// ================= DELETE ACCOUNT =================
const deleteAccount = async (req, res) => {

    try {

        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token"
            });
        }


        const decoded = jwt.verify(token, process.env.JWT_SECRET);


        await User.findByIdAndDelete(decoded.id);


        res.clearCookie("token");


        res.json({
            success: true,
            message: "Account deleted"
        });

    }
    catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Delete failed"
        });
    }
};

const updateUser = async (req, res) => {
    try {

        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // 🔥 update fields (only if provided)
        user.firstname = req.body.firstname || user.firstname;
        user.lastname = req.body.lastname || user.lastname;
        user.age = req.body.age || user.age;
        user.date = req.body.date || user.date;

        if (req.file) {
            user.image = req.file.filename;
        }

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                firstname: user.firstname,
                lastname: user.lastname,
                age: user.age,
                date: user.date,
                image: user.image,
                email: user.email
            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: "Update failed"
        });
    }
};

const sendResetCode = async (req, res) => {

    try {

        const { email } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Email not found"
            });
        }

        // random 6 digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        user.resetCode = code;
        user.resetCodeExpire = Date.now() + 10 * 60 * 1000;

        await user.save();



        // SEND MAIL
        await resend.emails.send({

            from: "onboarding@resend.dev",

            to: user.email,

            subject: "Reset Your Omari.to Password",

            html: `

            <div style="
                background:#f3f3f3;
                padding:40px;
                font-family:Poppins,sans-serif;
            ">

                <div style="
                    max-width:600px;
                    margin:auto;
                    background:#ffffff;
                    border-radius:15px;
                    padding:40px;
                    box-shadow:0 0 10px rgba(0,0,0,0.1);
                ">

                    <h1 style="
                        color:#111;
                        margin-bottom:20px;
                    ">
                        Reset your password
                    </h1>

                    <p style="
                        color:#555;
                        font-size:16px;
                        line-height:28px;
                    ">
                        We received a request to reset your Omari.to account password.
                    </p>

                    <div style="
                        margin:35px 0;
                        background:#111;
                        color:white;
                        padding:20px;
                        border-radius:12px;
                        text-align:center;
                        font-size:38px;
                        letter-spacing:8px;
                        font-weight:bold;
                    ">
                        ${code}
                    </div>

                    <p style="
                        color:#666;
                        font-size:15px;
                    ">
                        This verification code will expire in 10 minutes.
                    </p>

                    <p style="
                        margin-top:30px;
                        color:#999;
                        font-size:14px;
                    ">
                        If you didn’t request this password reset, simply ignore this email.
                    </p>

                </div>

            </div>

            `
        });

        res.json({
            success: true,
            message: "Reset code sent successfully"
        });

    }
    catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Email send failed"
        });
    }
};

const resetPassword = async (req, res) => {

    try {

        const {
            email,
            code,
            newPassword
        } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.resetCode !== code) {
            return res.status(400).json({
                success: false,
                message: "Invalid code"
            });
        }

        if (Date.now() > user.resetCodeExpire) {
            return res.status(400).json({
                success: false,
                message: "Code expired"
            });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        user.password = hash;

        user.resetCode = null;
        user.resetCodeExpire = null;

        await user.save();

        res.json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Reset failed"
        });
    }
};



// ================= SAVE MESSAGE =================
const saveMessage = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Login required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const { country, city, message } = req.body;

        const newMessage = new Message({
            userId: user._id,
            firstname: user.firstname,
            email: user.email,
            country,
            city,
            message
        });

        await newMessage.save();

        res.json({ success: true, message: "Message saved successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Message save failed" });
    }
};

module.exports = {
    homePage,
    signupUser,
    loginUser,
    getUser,
    deleteAccount,
    updateUser,
    sendResetCode,
    resetPassword,
    saveMessage
};
