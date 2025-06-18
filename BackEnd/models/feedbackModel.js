const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FeedbackSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, collection: "feedbacks" }
);

module.exports = mongoose.model("Feedback", FeedbackSchema);
