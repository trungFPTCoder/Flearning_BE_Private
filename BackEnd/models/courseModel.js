const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CourseSchema = new Schema(
  {
    title: String,
    subTitle: String,
    message: {
      welcome: String,
      congrats: String,
    },
    detail: {
      description: String,
      willLearn: [String],
      targetAudience: [String],
      requirement: [String],
    },
    materials: [String],
    studentsEnrolled: [{ type: Schema.Types.ObjectId, ref: "User" }],
    thumbnail: String,
    trailer: String,
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    price: Number,
    discountId: { type: Schema.Types.ObjectId, ref: "Discount" },
    rating: Number,
    level: { type: String, enum: ["beginner", "intermediate", "advanced"] },
    duration: String,
    language: { type: String, enum: ["vietnam", "english"] },
    subtitleLanguage: { type: String, enum: ["vietnam", "english"] },
    sections: [{ type: Schema.Types.ObjectId, ref: "Section" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);
