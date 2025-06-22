const Wishlist = require('../models/wishlistModel');
require('../models/courseModel'); 
const wishlistController = {
    // Xem danh sách yêu thích: Lấy danh sách các khóa học trong wishlist.
    // just students can view their own wishlist
    // GET /api/wishlist/:userId
    viewWishlist: async (req, res) => {
        try {
            const userId = req.params.userId;
            let wishlist = await Wishlist.findOne({ userId }).populate('courseIds');
            if (!wishlist) { // NOTE: If no wishlist exists for the user, create a new one (check in frontend if courseIds.length === 0 => show empty wishlist)
                wishlist = new Wishlist({ userId, courseIds: [] });
                await wishlist.save();
            }
            res.status(200).json(wishlist);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
    // Thêm vào yêu thích: Thêm một khóa học vào wishlist.
    // just students can add courses to their own wishlist
    // POST /api/wishlist
    addToWishlist: async (req, res) => {
        try {
            const { userId, courseId } = req.body;
            if (!courseId) {
                return res.status(400).json({ message: 'Course ID is required.' });
            }
            let wishlist = await Wishlist.findOne({ userId });
            if (!wishlist) {
                wishlist = new Wishlist({ userId, courseIds: [] });
            }
            if (wishlist.courseIds.includes(courseId)) {
                return res.status(400).json({ message: 'Course already exists in the wishlist.', courseId });
            }
            wishlist.courseIds.push(courseId);
            await wishlist.save();
            res.status(200).json({ message: 'Course added to wishlist successfully.', courseId });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
    // Xóa khỏi yêu thích: Xóa một khóa học khỏi wishlist.
    // just students can remove courses from their own wishlist
    // DELETE /api/wishlist/?userId=<userId>&courseId=<courseId>
    removeFromWishlist: async (req, res) => {
        try {
            const { userId, courseId } = req.query;
            let wishlist = await Wishlist.findOne({ userId });
            if (!wishlist) {
                return res.status(404).json({ message: 'Wishlist not found.' });
            }
            if (!wishlist.courseIds.includes(courseId)) {
                return res.status(400).json({ message: 'Course not found in the wishlist.', courseId });
            }
            wishlist.courseIds = wishlist.courseIds.filter(id => id.toString() !== courseId);
            await wishlist.save();
            res.status(200).json({ message: 'Course removed from wishlist successfully.', courseId });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
module.exports = wishlistController;