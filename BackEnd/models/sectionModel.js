const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SectionSchema = new Schema(
  {
    name: String,
    courseId: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true, collection: "course_sections" }
);

module.exports = mongoose.model("Section", SectionSchema);
