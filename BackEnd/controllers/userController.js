const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

/**
 * @desc    Set a password for an account that doesn't have one (e.g., Google sign-up)
 * @route   POST /api/user/set-password
 * @access  Private (User must be logged in)
 */
exports.setPassword = async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.user.id; 

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        // Kiểm tra xem user đã có mật khẩu chưa
        if (user.password) {
            return res.status(400).json({ message: 'Tài khoản của bạn đã có mật khẩu. Vui lòng dùng chức năng "Thay đổi mật khẩu".' });
        }

        // Băm và đặt mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Đặt mật khẩu thành công. Lần đăng nhập tới bạn có thể dùng mật khẩu này.' });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};


/**
 * @desc    Change user's password when already logged in
 * @route   PUT /api/user/change-password
 * @access  Private (User must be logged in)
 */
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Lấy từ authMiddleware

    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ mật khẩu hiện tại và mật khẩu mới (ít nhất 6 ký tự).' });
    }

    try {
        // Lấy cả trường password về để so sánh
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        // Xử lý trường hợp user đăng ký bằng Google và chưa có mật khẩu
        if (!user.password) {
            return res.status(400).json({ message: 'Tài khoản của bạn chưa có mật khẩu. Vui lòng dùng chức năng "Đặt mật khẩu".' });
        }

        // So sánh mật khẩu hiện tại người dùng nhập với mật khẩu trong DB
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mật khẩu hiện tại không chính xác.' });
        }

        // Băm và cập nhật mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Thay đổi mật khẩu thành công.' });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};