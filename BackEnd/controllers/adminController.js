const User = require("../models/userModel");
const Enrollment = require("../models/enrollmentModel");
const Course = require("../models/courseModel");
const Category = require("../models/categoryModel");
const Discount = require("../models/discountModel");
const Section = require("../models/sectionModel");
const Lesson = require("../models/lessonModel");

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

/**
 * @desc    Get all courses with search and filtering (Admin)
 * @route   GET /api/admin/courses
 * @access  Private (Admin only)
 */
exports.getAllCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      categoryId = "",
      level = "",
      language = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query object
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { subTitle: { $regex: search, $options: "i" } },
        { "detail.description": { $regex: search, $options: "i" } },
      ];
    }

    // Filter by category
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // Filter by level
    if (level) {
      query.level = level;
    }

    // Filter by language
    if (language) {
      query.language = language;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const courses = await Course.find(query)
      .populate("categoryId", "name")
      .populate("discountId", "discountCode value type")
      .populate("sections", "name")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCourses = await Course.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCourses / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Get enrollment count for each course
    const coursesWithEnrollmentCount = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.countDocuments({
          courseId: course._id,
        });
        const courseObj = course.toObject();
        return {
          ...courseObj,
          enrollmentCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: coursesWithEnrollmentCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCourses,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error in getAllCourses:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Create a new course
 * @route   POST /api/admin/courses
 * @access  Private (Admin only)
 */
exports.createCourse = async (req, res) => {
  try {
    const {
      title,
      subTitle,
      message,
      detail,
      materials,
      thumbnail,
      trailer,
      categoryId,
      price,
      discountId,
      level,
      duration,
      language,
      subtitleLanguage,
    } = req.body;

    // Validate required fields
    if (!title || !subTitle || !detail?.description || !price) {
      return res.status(400).json({
        success: false,
        message: "Title, subtitle, description, and price are required",
      });
    }

    // Validate categoryId if provided
    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }
    }

    // Validate discountId if provided
    if (discountId) {
      const discount = await Discount.findById(discountId);
      if (!discount) {
        return res.status(400).json({
          success: false,
          message: "Invalid discount ID",
        });
      }
    }

    // Create new course
    const newCourse = new Course({
      title,
      subTitle,
      message: {
        welcome: message?.welcome || "",
        congrats: message?.congrats || "",
      },
      detail: {
        description: detail.description,
        willLearn: detail.willLearn || [],
        targetAudience: detail.targetAudience || [],
        requirement: detail.requirement || [],
      },
      materials: materials || [],
      thumbnail,
      trailer,
      categoryId,
      price: parseFloat(price),
      discountId,
      level: level || "beginner",
      duration,
      language: language || "vietnam",
      subtitleLanguage: subtitleLanguage || "vietnam",
      sections: [],
      studentsEnrolled: [],
    });

    const savedCourse = await newCourse.save();

    // Populate category and discount information
    const populatedCourse = await Course.findById(savedCourse._id)
      .populate("categoryId", "name")
      .populate("discountId", "discountCode value type");

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: populatedCourse,
    });
  } catch (error) {
    console.error("Error in createCourse:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get course by ID with detailed information
 * @route   GET /api/admin/courses/:courseId
 * @access  Private (Admin only)
 */
exports.getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId)
      .populate("categoryId", "name")
      .populate("discountId", "discountCode value type status")
      .populate("sections", "name")
      .populate("studentsEnrolled", "firstName lastName email");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get enrollment count
    const enrollmentCount = await Enrollment.countDocuments({
      courseId: courseId,
    });

    const courseData = {
      ...course.toObject(),
      enrollmentCount,
    };

    res.status(200).json({
      success: true,
      data: courseData,
    });
  } catch (error) {
    console.error("Error in getCourseById:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Update course by ID
 * @route   PUT /api/admin/courses/:courseId
 * @access  Private (Admin only)
 */
exports.updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    // Check if course exists
    const existingCourse = await Course.findById(courseId);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Validate categoryId if provided
    if (updateData.categoryId) {
      const category = await Category.findById(updateData.categoryId);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }
    }

    // Validate discountId if provided
    if (updateData.discountId) {
      const discount = await Discount.findById(updateData.discountId);
      if (!discount) {
        return res.status(400).json({
          success: false,
          message: "Invalid discount ID",
        });
      }
    }

    // Convert price to number if provided
    if (updateData.price) {
      updateData.price = parseFloat(updateData.price);
    }

    // Update the course
    const updatedCourse = await Course.findByIdAndUpdate(courseId, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("categoryId", "name")
      .populate("discountId", "discountCode value type")
      .populate("sections", "name");

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error("Error in updateCourse:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete course by ID
 * @route   DELETE /api/admin/courses/:courseId
 * @access  Private (Admin only)
 */
exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if there are any enrollments for this course
    const enrollmentCount = await Enrollment.countDocuments({
      courseId: courseId,
    });

    if (enrollmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course. There are ${enrollmentCount} students enrolled in this course.`,
      });
    }

    // Delete the course
    await Course.findByIdAndDelete(courseId);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteCourse:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Create a new section for a course
 * @route   POST /api/admin/courses/:courseId/sections
 * @access  Private (Admin only)
 */
exports.createSection = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name, order } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Section name is required",
      });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Create new section
    const newSection = new Section({
      name: name.trim(),
      courseId,
      order: order || 0,
      lessons: [],
    });

    const savedSection = await newSection.save();

    // Add section to course's sections array
    course.sections.push(savedSection._id);
    await course.save();

    res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: savedSection,
    });
  } catch (error) {
    console.error("Error in createSection:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get all sections for a course
 * @route   GET /api/admin/courses/:courseId/sections
 * @access  Private (Admin only)
 */
exports.getCourseSections = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get sections with lessons populated
    const sections = await Section.find({ courseId })
      .populate({
        path: "lessons",
        select:
          "title description lectureNotes videoUrl captions duration order",
        options: { sort: { order: 1 } },
      })
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: sections,
    });
  } catch (error) {
    console.error("Error in getCourseSections:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Update a section
 * @route   PUT /api/admin/courses/:courseId/sections/:sectionId
 * @access  Private (Admin only)
 */
exports.updateSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const { name, order } = req.body;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if section exists and belongs to the course
    const section = await Section.findOne({ _id: sectionId, courseId });
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    // Update section
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (order !== undefined) updateData.order = order;

    const updatedSection = await Section.findByIdAndUpdate(
      sectionId,
      updateData,
      { new: true, runValidators: true }
    ).populate({
      path: "lessons",
      select: "title content videoUrl duration order",
      options: { sort: { order: 1 } },
    });

    res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data: updatedSection,
    });
  } catch (error) {
    console.error("Error in updateSection:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a section
 * @route   DELETE /api/admin/courses/:courseId/sections/:sectionId
 * @access  Private (Admin only)
 */
exports.deleteSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if section exists and belongs to the course
    const section = await Section.findOne({ _id: sectionId, courseId });
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    // Check if section has lessons
    if (section.lessons.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete section. Please remove all lessons first.",
      });
    }

    // Remove section from course's sections array
    course.sections = course.sections.filter(
      (id) => id.toString() !== sectionId
    );
    await course.save();

    // Delete the section
    await Section.findByIdAndDelete(sectionId);

    res.status(200).json({
      success: true,
      message: "Section deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteSection:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Create a new lesson in a section
 * @route   POST /api/admin/courses/:courseId/sections/:sectionId/lessons
 * @access  Private (Admin only)
 */
exports.createLesson = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const {
      title,
      description,
      lectureNotes,
      videoUrl,
      captions,
      duration,
      order,
    } = req.body;

    // Validate required fields
    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Lesson title is required",
      });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if section exists and belongs to the course
    const section = await Section.findOne({ _id: sectionId, courseId });
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    // Create new lesson
    const newLesson = new Lesson({
      courseId,
      sectionId,
      title: title.trim(),
      description: description || "",
      lectureNotes: lectureNotes || "",
      videoUrl: videoUrl || "",
      captions: captions || "",
      duration: duration || 0,
      order: order || 0,
    });

    const savedLesson = await newLesson.save();

    // Add lesson to section's lessons array
    section.lessons.push(savedLesson._id);
    await section.save();

    res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      data: savedLesson,
    });
  } catch (error) {
    console.error("Error in createLesson:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Update a lesson
 * @route   PUT /api/admin/courses/:courseId/lessons/:lessonId
 * @access  Private (Admin only)
 */
exports.updateLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const {
      title,
      description,
      lectureNotes,
      videoUrl,
      captions,
      duration,
      order,
    } = req.body;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if lesson exists and belongs to the course
    const lesson = await Lesson.findOne({ _id: lessonId, courseId });
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Update lesson
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (lectureNotes !== undefined) updateData.lectureNotes = lectureNotes;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (captions !== undefined) updateData.captions = captions;
    if (duration !== undefined) updateData.duration = duration;
    if (order !== undefined) updateData.order = order;

    const updatedLesson = await Lesson.findByIdAndUpdate(lessonId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: updatedLesson,
    });
  } catch (error) {
    console.error("Error in updateLesson:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a lesson
 * @route   DELETE /api/admin/courses/:courseId/lessons/:lessonId
 * @access  Private (Admin only)
 */
exports.deleteLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if lesson exists and belongs to the course
    const lesson = await Lesson.findOne({ _id: lessonId, courseId });
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Remove lesson from section's lessons array
    const section = await Section.findById(lesson.sectionId);
    if (section) {
      section.lessons = section.lessons.filter(
        (id) => id.toString() !== lessonId
      );
      await section.save();
    }

    // Delete the lesson
    await Lesson.findByIdAndDelete(lessonId);

    res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteLesson:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get a specific lesson
 * @route   GET /api/admin/courses/:courseId/lessons/:lessonId
 * @access  Private (Admin only)
 */
exports.getLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get lesson with section information
    const lesson = await Lesson.findOne({ _id: lessonId, courseId }).populate(
      "sectionId",
      "name"
    );

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    console.error("Error in getLesson:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
