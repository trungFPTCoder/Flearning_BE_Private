const Category = require("../models/categoryModel");
const CategoryController = {
    /**
     * @desc    Lấy danh mục hàng đầu: Lấy danh sách các danh mục phổ biến nhất. (limit 12 categories)
     * @route   GET /api/categories/top
     * @access  Public
     */
    getTopCategories: async (req, res) => {
        try {
            const categories = await Category.aggregate([
                {
                    $lookup: {
                        from: "courses",
                        localField: "_id",
                        foreignField: "categoryId",
                        as: "courses",
                    },
                },
                {
                    $addFields: {
                        courseCount: { $size: "$courses" },
                    },
                },
                {
                    $sort: {
                        courseCount: -1,
                    },
                },
                {
                    $limit: 12,
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,          // Name of the category
                        courseCount: 1,   // Number of courses
                    },
                },
            ]);
            if (!categories || categories.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy danh mục nào" });
            }

            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
};

module.exports = CategoryController;