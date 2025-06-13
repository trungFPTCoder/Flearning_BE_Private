const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SectionSchema = new Schema(
  {
    name: String,
    lectures: [{ type: Schema.Types.ObjectId, ref: "Lecture" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Section", SectionSchema);
