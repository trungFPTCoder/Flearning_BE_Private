const User = require("../models/userModel");
const Enrollment = require("../models/enrollmentModel");

/**
 * @desc    Get all users with search and filtering
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
exports.getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      status = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query object
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const users = await User.find(query)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("enrolledCourses", "title");

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(totalUsers / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Get enrollment count for each user
    const usersWithEnrollmentCount = await Promise.all(
      users.map(async (user) => {
        const enrollmentCount = await Enrollment.countDocuments({
          userId: user._id,
        });
        const userObj = user.toObject();
        return {
          ...userObj,
          enrollmentCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: usersWithEnrollmentCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error in getUsers:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get user statistics
 * @route   GET /api/admin/users/stats
 * @access  Private (Admin only)
 */
exports.getUserStats = async (req, res) => {
  try {
    // Get current date and start of day/month
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Basic user counts
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ status: "verified" });
    const unverifiedUsers = await User.countDocuments({ status: "unverified" });
    const bannedUsers = await User.countDocuments({ status: "banned" });
    const students = await User.countDocuments({ role: "student" });
    const admins = await User.countDocuments({ role: "admin" });

    // Get users enrolled in at least one course
    const enrolledUsers = await User.countDocuments({
      enrolledCourses: { $exists: true, $ne: [] },
    });

    // Get users registered today
    const usersRegisteredToday = await User.countDocuments({
      createdAt: { $gte: startOfToday },
    });

    // Get users registered this month
    const usersRegisteredThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
    });

    // Get daily registration data for the last 7 days (for chart)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
      );

      const count = await User.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      });

      last7Days.push({
        date: startOfDay.toISOString().split("T")[0],
        count,
      });
    }

    // Get monthly registration data for the last 6 months (for chart)
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const count = await User.countDocuments({
        createdAt: { $gte: startOfMonth, $lt: endOfMonth },
      });

      last6Months.push({
        month: startOfMonth.toISOString().slice(0, 7), // YYYY-MM format
        count,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        bannedUsers,
        students,
        admins,
        enrolledUsers,
        usersRegisteredToday,
        usersRegisteredThisMonth,
        registrationTrends: {
          last7Days,
          last6Months,
        },
      },
    });
  } catch (error) {
    console.error("Error in getUserStats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get user by ID with detailed information
 * @route   GET /api/admin/users/:id
 * @access  Private (Admin only)
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password")
      .populate("enrolledCourses", "title subTitle thumbnail price");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get enrollment count
    const enrollmentCount = await Enrollment.countDocuments({ userId: id });

    // Get user's enrollment details
    const enrollments = await Enrollment.find({ userId: id }).populate(
      "courseId",
      "title subTitle thumbnail price"
    );

    const userData = {
      ...user.toObject(),
      enrollmentCount,
      enrollments,
    };

    res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Update user status (ban/unban)
 * @route   PUT /api/admin/users/:id/status
 * @access  Private (Admin only)
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["unverified", "verified", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error in updateUserStatus:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
