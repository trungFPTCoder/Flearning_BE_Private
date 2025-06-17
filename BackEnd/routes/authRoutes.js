const express = require("express");
const { register, login, verifyEmail, googleLogin, refreshToken, logout } = require("../controllers/authController");
const router = express.Router();

router.post("/register", register);
router.get("/verify-email/:token", verifyEmail);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

module.exports = router;