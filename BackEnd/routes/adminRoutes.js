const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUserStats,
  getUserById,
  updateUserStatus,
  getAllCourses,
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  createSection,
  getCourseSections,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  getLesson,
} = require("../controllers/adminController");
const authorize = require("../middlewares/authMiddleware");

// All admin routes require admin authorization
router.use(authorize("admin"));

// User management routes
router.get("/users", getUsers);
router.get("/users/stats", getUserStats);
router.get("/users/:id", getUserById);
router.put("/users/:id/status", updateUserStatus);

// Course management routes
router.get("/courses", getAllCourses);
router.post("/courses", createCourse);
router.get("/courses/:courseId", getCourseById);
router.put("/courses/:courseId", updateCourse);
router.delete("/courses/:courseId", deleteCourse);

// Section management routes
router.post("/courses/:courseId/sections", createSection);
router.get("/courses/:courseId/sections", getCourseSections);
router.put("/courses/:courseId/sections/:sectionId", updateSection);
router.delete("/courses/:courseId/sections/:sectionId", deleteSection);

// Lesson management routes
router.post("/courses/:courseId/sections/:sectionId/lessons", createLesson);
router.put("/courses/:courseId/lessons/:lessonId", updateLesson);
router.delete("/courses/:courseId/lessons/:lessonId", deleteLesson);
router.get("/courses/:courseId/lessons/:lessonId", getLesson);

module.exports = router;
