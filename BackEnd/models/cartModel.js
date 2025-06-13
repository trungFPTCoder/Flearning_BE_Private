const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CartSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  courseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CartSchema.index({ userId: 1 });

module.exports = mongoose.model("Cart", CartSchema);
