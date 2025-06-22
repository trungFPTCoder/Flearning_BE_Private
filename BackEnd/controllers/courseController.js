/**
 * Home Page & General 
 * PIC: Trung
 **/
const Course = require('../models/courseModel');
const Discount = require('../models/discountModel');
const section = require('../models/sectionModel');
const Category = require('../models/categoryModel');
const courseController = {
    // Lấy danh sách khóa học: Hỗ trợ lọc, sắp xếp và phân trang. Dùng cho các use case: View Courses, Filter, Sort.
    // everybody can access this route 
    // 
    getAllCourses: async (req, res) => {
        try {
            const courses = await Course.find()
                .populate('categoryId') // Lấy toàn bộ thông tin category
                .populate('discountId')
                .populate('sections');
            if (!courses || courses.length === 0) {
                return res.status(404).json({ message: 'Not found courses' });
            }
            res.status(200).json(courses)
        } catch (error) {
            res.status(500).json({ message: error.message })
        }
    },
    // Tìm kiếm khóa học: Trả về danh sách khóa học dựa trên từ khóa.(title and description)
    // everybody can access this route
    searchCourses: async (req, res) => {
        try {
            const { keyword } = req.query;
            const courses = await Course.find({
                $or: [
                    { title: { $regex: keyword, $options: 'i' } },
                    { 'detail.description': { $regex: keyword, $options: 'i' } }
                ]
            })
                .populate('categoryId')
                .populate('discountId')
                .populate('sections');
            if (!courses || courses.length === 0) {
                return res.status(404).json({ message: 'Not found courses' });
            }
            res.status(200).json(courses);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
    // Lấy khóa học bán chạy: Lấy danh sách các khóa học hàng đầu.
    // everybody can access this route
    // api/courses/top-selling?limit=...
    getTopCourses: async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 5; // Default to 5 if not provided
            const courses = await Course.aggregate([
                {
                    $addFields: {
                        studentsCount: { $size: { $ifNull: ["$studentsEnrolled", []] } }
                    }
                },
                { $sort: { studentsCount: -1 } },// Sort by number of students enrolled desc
                { $limit: limit } // Limit to top N courses
            ]);
            // Populate all fields after aggregate
            const populatedCourses = await Course.populate(courses, [
                { path: 'categoryId' },
                { path: 'discountId' },
                { path: 'sections' }
            ]);
            if (!populatedCourses || populatedCourses.length === 0) {
                return res.status(404).json({ message: 'Not found top courses' });
            }
            res.status(200).json(populatedCourses);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
    // Lấy khóa học mới: Lấy danh sách các khóa học được thêm gần đây.
    // everybody can access this route
    // api/courses/recently-added?limit=...
    getNewCourses: async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 5; // Default to 5 if not provided
            const courses = await Course.find()
                .sort({ createdAt: -1 }) // Sort by creation date desc
                .limit(limit)
                .populate('categoryId')
                .populate('discountId')
                .populate('sections');
            if (!courses || courses.length === 0) {
                return res.status(404).json({ message: 'Not found new courses' });
            }
            res.status(200).json(courses);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
    


}
module.exports = courseController;