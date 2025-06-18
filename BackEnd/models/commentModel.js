const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CommentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Forum" },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    content: String,
  },
  { timestamps: true, collection: "comments" }
);

module.exports = mongoose.model("Comment", CommentSchema);
