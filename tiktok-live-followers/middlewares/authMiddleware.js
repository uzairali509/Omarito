const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) return res.redirect("/Codes/Login.html");

    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;

    next();
};