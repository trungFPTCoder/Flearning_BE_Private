const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm nội bộ để tạo token
const generateTokens = (user) => {
    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
    const refreshToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });
    return { accessToken, refreshToken };
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email đã tồn tại." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = await User.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            userName: email.split('@')[0] + "_" + crypto.randomBytes(4).toString('hex'),
        });

        const verificationToken = crypto.randomBytes(32).toString("hex");
        await new Token({ userId: newUser._id, token: verificationToken }).save();
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
        const htmlMessage = `<p>Vui lòng nhấp vào nút dưới đây để xác thực email của bạn:</p><a href="${verificationUrl}" target="_blank">Verify Email</a>`;
        await sendEmail(newUser.email, "Xác thực Email", htmlMessage);
        
        res.status(201).json({ message: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};

/**
 * @desc    Verify user's email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = async (req, res) => {
    try {
        const token = await Token.findOne({ token: req.params.token });
        if (!token) return res.status(400).send("Liên kết không hợp lệ hoặc đã hết hạn.");

        const user = await User.findById(token.userId);
        if (!user) return res.status(400).send("Không tìm thấy người dùng.");
        if (user.status === 'verified') return res.status(200).send("Email này đã được xác thực trước đó.");

        user.status = "verified";
        await user.save();
        await token.deleteOne();

        res.status(200).send("Email đã được xác thực thành công. Bạn có thể đóng cửa sổ này và đăng nhập.");
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};

/**
 * @desc    Login user with email and password
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(404).json({ message: "Email hoặc mật khẩu không đúng." });
        }

        if (!user.password) {
            return res.status(403).json({ message: "Tài khoản này được đăng ký bằng Google. Vui lòng đăng nhập bằng Google." });
        }
        
        if (user.status === 'unverified') {
            return res.status(403).json({ message: "Vui lòng xác thực email của bạn trước khi đăng nhập." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Email hoặc mật khẩu không đúng." });
        }

        const { accessToken, refreshToken } = generateTokens(user);
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });

        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({ accessToken, user: userObject });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};

/**
 * @desc    Login or Register with Google
 * @route   POST /api/auth/google
 * @access  Public
 */
exports.googleLogin = async (req, res) => {
    const { tokenId } = req.body;
    try {
        const ticket = await client.verifyIdToken({ idToken: tokenId, audience: process.env.GOOGLE_CLIENT_ID });
        const { email_verified, name, email, picture } = ticket.getPayload();

        if (!email_verified) {
            return res.status(400).json({ message: "Email Google chưa được xác thực." });
        }

        let user = await User.findOne({ email });

        if (!user) {
            user = new User({
                firstName: name.split(' ')[0],
                lastName: name.split(' ').slice(1).join(' '),
                userName: email.split('@')[0] + "_" + crypto.randomBytes(4).toString('hex'),
                email,
                password: null,
                userImage: picture,
                status: 'verified',
            });
            await user.save();
        }

        const { accessToken, refreshToken } = generateTokens(user);
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({ accessToken, user: userObject });
    } catch (error) {
        res.status(500).json({ message: "Lỗi xác thực Google.", error: error.message });
    }
};

/**
 * @desc    Request password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({ message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi.' });
        }

        let token = await Token.findOne({ userId: user._id });
        if (token) await token.deleteOne();

        const resetToken = crypto.randomBytes(32).toString("hex");
        await new Token({ userId: user._id, token: resetToken }).save();
        
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        const htmlMessage = `<p>Vui lòng nhấp vào nút dưới đây để đặt lại mật khẩu (liên kết có hiệu lực trong 1 giờ):</p><a href="${resetUrl}" target="_blank">Đặt lại mật khẩu</a>`;
        
        await sendEmail(user.email, "Yêu cầu đặt lại mật khẩu", htmlMessage);
        res.status(200).json({ message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi.' });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

/**
 * @desc    Reset password using token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const token = await Token.findOne({ token: req.params.token });
        if (!token) return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });

        const user = await User.findById(token.userId);
        if (!user) return res.status(400).json({ message: 'Không tìm thấy người dùng.' });
        
        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        await token.deleteOne();

        res.status(200).json({ message: 'Đặt lại mật khẩu thành công.' });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Private (via httpOnly cookie)
 */
exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Không có quyền truy cập." });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ message: "Người dùng không tồn tại." });

        const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
        res.status(200).json({ accessToken });
    } catch (error) {
        return res.status(403).json({ message: "Refresh token không hợp lệ." });
    }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = (req, res) => {
    res.cookie('refreshToken', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: "Đăng xuất thành công." });
};