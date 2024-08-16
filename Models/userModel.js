const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  apiKey: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
