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

module.exports = router;
