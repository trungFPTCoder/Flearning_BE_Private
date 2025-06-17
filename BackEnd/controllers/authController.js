const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail"); 
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm tạo token
const generateTokens = (user) => {
    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
    const refreshToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });
    return { accessToken, refreshToken };
};

// @desc    Register a new user
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

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
        await new Token({
            userId: newUser._id,
            token: verificationToken,
        }).save();

        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

        const htmlMessage = `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
                <h2 style="color: #333;">Xác thực địa chỉ Email của bạn</h2>
                <p style="color: #555;">Cảm ơn bạn đã đăng ký. Vui lòng nhấp vào nút bên dưới để hoàn tất việc xác thực.</p>
                <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; margin: 20px 0; font-size: 16px; color: white; background-color: #007BFF; text-decoration: none; border-radius: 5px;">
                    Verify Email
                </a>
                <p style="color: #888; font-size: 12px;">Nếu bạn không yêu cầu việc này, vui lòng bỏ qua email.</p>
            </div>
        `;

        await sendEmail(newUser.email, "Xác thực Email", htmlMessage);
        
        res.status(201).json({ message: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};

// @desc    Verify user's email
exports.verifyEmail = async (req, res) => {
    try {
        const token = await Token.findOne({ token: req.params.token });
        if (!token) return res.status(400).send("Liên kết không hợp lệ hoặc đã hết hạn.");

        const user = await User.findById(token.userId);
        if (!user) return res.status(400).send("Không tìm thấy người dùng.");

        user.status = "verified";
        await user.save();
        await token.deleteOne();

        res.status(200).send("Email đã được xác thực thành công.");
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};

// @desc    Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Email hoặc mật khẩu không đúng." });
        }
        
        if (user.status === 'unverified') {
            return res.status(403).json({ message: "Vui lòng xác thực email của bạn trước khi đăng nhập." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Email hoặc mật khẩu không đúng." });
        }

        const { accessToken, refreshToken } = generateTokens(user);
        
        // Gửi refreshToken trong httpOnly cookie để bảo mật
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
        });

        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({
            accessToken,
            user: userObject, // Trả về toàn bộ đối tượng user
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};

// @desc    Login with Google
exports.googleLogin = async (req, res) => {
    const { tokenId } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { email_verified, name, email, picture } = ticket.getPayload();

        if (!email_verified) {
            return res.status(400).json({ message: "Email Google chưa được xác thực." });
        }

        let user = await User.findOne({ email });

        if (!user) {
            user = new User({
                firstName: name.split(' ')[0],
                lastName: name.split(' ').slice(1).join(' '),
                userName: email.split('@')[0],
                email,
                password: null,
                userImage: picture,
                status: 'verified', // Tự động xác thực
            });
            await user.save();
        }

        const { accessToken, refreshToken } = generateTokens(user);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({
            accessToken,
            user: userObject, // Trả về toàn bộ đối tượng user
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi xác thực Google.", error: error.message });
    }
};


// @desc    Refresh access token
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

// @desc    Logout user
exports.logout = (req, res) => {
    // Xóa cookie chứa refresh token
    res.cookie('refreshToken', '', {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: "Đăng xuất thành công." });
};