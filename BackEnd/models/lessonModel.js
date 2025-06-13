const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LessonSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    title: String,
    content: String,
    videoUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lesson", LessonSchema);
