const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userChatId: { type: Number, required: true },
    orderName: { type: String, required: true },
    playerId: { type: Number, required: true },
    itemId: { type: Number, required: true },
    price: { type: Number, required: true },
    orderNumber: { type: Number, required: true, unique: true },
    invoiceNumber: { type: Number, required: true, unique: true },
    status: {
      type: String,
      default: "Pending",
      set: (string) => {
        return string.charAt(0).toUpperCase() + string.slice(1);
      },
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
