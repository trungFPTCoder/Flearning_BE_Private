const Notification = require('../models/notificationModel');
const notificationController = {
    //Nhận thông báo: Lấy danh sách thông báo cho người dùng đã đăng nhập.
    // just student can access this route
    // api/notifications/:userId
    getNotifications: async (req, res) => {
        try {
            const userId = req.params.userId
            const notifications = await Notification.find({ userId })
            res.status(200).json(notifications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
module.exports = notificationController;