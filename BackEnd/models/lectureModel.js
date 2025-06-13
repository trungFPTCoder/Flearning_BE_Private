const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LectureSchema = new Schema(
  {
    video: String,
    caption: String,
    description: String,
    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lecture", LectureSchema);
