require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const User = require("./Models/userModel");
const Order = require("./Models/orderModel");
const cron = require("node-cron");

const { v4: uuidv4, validate: validateUUID } = require("uuid");

const Port = process.env.PORT || 3000;
const Telegram_Token = process.env.TELEGRAM_API_TOKEN;
const MongoDB_URI = process.env.MONGODB_URI;
const ICH7EN_API_BASE_URL = process.env.ICH7EN_API_BASE_URL;

const app = express();
const bot = new TelegramBot(Telegram_Token, { polling: true });

let BOT_WAITING_FOR_RESPONSE = false;

// Connect to MongoDB
mongoose
  .connect(MongoDB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

app.use(express.json());
app.use(cors());
//azez

app.get("/", (req, res) => {
  res.send("Hello World!");
});

/// TESTING
const offers = [
  {
    id: 33,
    name: "💎 100 + 10  💎",
    description: "_Total Price To Pay:_  💵* 1.00 $*",
    price: 1.0,
  },
  {
    id: 34,
    name: "💎 310 + 31 💎",
    description: "_Total Price To Pay:_  💵* 3.00 $*",
    price: 3.0,
  },
  {
    id: 49,
    name: "💎 520 + 52 💎",
    description: "_Total Price To Pay:_  💵* 5.00 $*",
    price: 5.0,
  },
  {
    id: 51,
    name: "💎 1060 + 106 💎",
    description: "_Total Price To Pay:_  💵* 10.00 $*",
    price: 10.0,
  },
  {
    id: 64,
    name: "💎 2180 + 218 💎",
    description: "_Total Price To Pay:_  💵* 20.00 $*",
    price: 20.0,
  },
  {
    id: 77,
    name: "👑 BOOYAH Pass 👑",
    description: "_Total Price To Pay:_  💵* 3.00 $*",
    price: 3.0,
  },
  {
    id: 75,
    name: "📆 Weekly Membership 📆",
    description: "_Total Price To Pay:_  💵* 2.00 $*",
    price: 2.0,
  },
  {
    id: 76,
    name: "📆 Monthly Membership 📆",
    description: "_Total Price To Pay:_  💵* 10.00 $*",
    price: 10.0,
  },
  // { id: 2, name: "Offer 2", description: "Description for offer 2" },
  // { id: 3, name: "Offer 3", description: "Description for offer 3" },
];

const commands = [
  { command: "/start", description: "Start the bot and set API key" },
  { command: "/offers", description: "List available offers" },
  { command: "/balance", description: "List available offers" },
  { command: "/recent", description: "List recent orders" },
  // { command: "/check", description: "Check options" },
  { command: "/help", description: "List all available commands" },
  { command: "/key", description: "Set/Change your API key" },
];

// Handler functions
function handleStartCommand(chatId) {
  // bot.sendMessage(chatId, "Welcome! Please provide your API key:");
  bot.sendMessage(chatId, "Welcome", {
    reply_markup: {
      keyboard: [
        ["🔑 Set/Change Api Key"],
        ["💰 Balance", "📦 Recent Orders"],
        ["🏷️ TopUp Free Fire Gems"],
      ],
      resize_keyboard: true,

      one_time_keyboard: false,
    },
  });

  // userKeys[chatId] = null; // Initialize user key as null
}

async function handleOffersCommand(chatId) {
  if (!(await isAuthenticated(chatId))) {
    bot.sendMessage(chatId, "Please provide your API key first.");
    return;
  }
  const offerButtons = offers.map((offer) => [
    {
      text: offer.name,
      callback_data: `offer_select_${offer.id}`,
    },
  ]);
  const options = {
    reply_markup: {
      inline_keyboard: [...offerButtons],
    },
  };
  bot.sendMessage(chatId, "Please select an offer:", options);
}

async function handleOfferSelection(chatId, offerId) {
  const selectedOffer = offers.find((offer) => offer.id == offerId);
  if (selectedOffer) {
    bot.sendMessage(
      chatId,
      `You selected: ${selectedOffer.name}\n\n${selectedOffer.description}`,
      {
        parse_mode: "MARKDOWN",
      }
    );
    // Here you can add logic to create the offer and send the status
    await PlaceOrder(
      chatId,
      selectedOffer.id,
      selectedOffer.price,
      selectedOffer.name
    );

    // bot.sendMessage(chatId, `Offer status: Created successfully!`);
  } else {
    bot.sendMessage(chatId, "Invalid offer selected.");
  }
}

async function handleKeyCommand(chatId) {
  if (!(await isAuthenticated(chatId))) {
    bot.sendMessage(chatId, "Please enter your API key:");
    handleUpdateKey(chatId);
  } else {
    const user = await User.findOne({ chatId });
    bot.sendMessage(
      chatId,
      `Your Current Api key is : \n \`${user.apiKey}\` \n Please enter your new Api Key: `,
      {
        parse_mode: "MARKDOWN",
      }
    );
    handleUpdateKey(chatId);
  }
}

async function handleBalanceCommand(chatId) {
  if (!(await isAuthenticated(chatId))) {
    bot.sendMessage(chatId, "Please provide your API key first.");
    return;
  }
  handleBalance(chatId);
  // bot.sendMessage(chatId, "Balance : 10.25 $");
  return;
}

async function handleRecentCommand(chatId) {
  if (!(await isAuthenticated(chatId))) {
    bot.sendMessage(chatId, "Please provide your API key first.");
    return;
  }
  handleRecentOrders(chatId);
  return;
}

function sendAvailableCommands(chatId) {
  const helpMessage = commands
    .map((cmd) => `${cmd.command} - ${cmd.description}`)
    .join("\n");
  bot.sendMessage(chatId, `Available commands:\n${helpMessage}`);
}

async function isAuthenticated(chatId) {
  const user = await User.findOne({ chatId });
  return user !== null;
}

async function handleUpdateKey(chatId) {
  // switch to wait for response
  BOT_WAITING_FOR_RESPONSE = true;

  bot.once("message", async (msg) => {
    if (BOT_WAITING_FOR_RESPONSE) {
      const apiKey = msg.text;

      if (validateUUID(apiKey)) {
        axios
          .get(`${ICH7EN_API_BASE_URL}/profile`, {
            headers: {
              "api-token": `${apiKey}`,
            },
          })
          .then(async () => {
            // bot.sendMessage(chatId, "API key updated successfully!");
            // Save the valid API key here
            try {
              const user = await User.findOneAndUpdate(
                { chatId },
                { apiKey },
                { upsert: true, new: true }
              );
              // bot.sendMessage(chatId, "API key set successfully!");
              bot.sendMessage(chatId, "API key updated successfully!");

              sendAvailableCommands(chatId);
            } catch (err) {
              console.error("Error saving API key:", err);
              bot.sendMessage(
                chatId,
                "Failed to save API key. Please try again."
              );
              handleUpdateKey(chatId);
            }
          })
          .catch((error) => {
            console.log("CheckAPIError :", error.message);
            bot.sendMessage(
              chatId,
              "Invalid API key. Please enter a valid API key."
            );
            handleUpdateKey(chatId);
            return;
          });
      } else {
        bot.sendMessage(
          chatId,
          "Invalid API key Format. Please enter a valid API key."
        );
        // Prompt the user again for the API key
        handleUpdateKey(chatId);
      }
    }
  });
}

async function handleBalance(chatId) {
  try {
    const user = await User.findOne({ chatId });
    axios
      .get(`${ICH7EN_API_BASE_URL}/profile`, {
        headers: {
          "api-token": `${user.apiKey}`,
        },
      })
      .then((response) => {
        bot.sendMessage(
          chatId,
          // `
          // 💰  <b>Your current Balance:</b>   💵   <code>${response.data.data.balance}</code></br></br>
          // ☎️  <em>Reach Out To Make Deposit:</em>  <a href="https://wa.me/213659791718">Send Message On Whatsapp</a>
          // `,
          `💰 *Your current Balance:*   💵   \`${response.data.data.balance}\` \n\n☎️  _Reach Out To Make Deposit:_  [Send Message On Whatsapp](https://wa.me/213659791718)  `,
          {
            parse_mode: "MARKDOWN",
          }
        );
        return;
      })
      .catch((error) => {
        console.log("GetProfile Error : ", error.message);
        bot.sendMessage(chatId, "Failed to Get User Balance.");
      });
  } catch (error) {
    console.log("HandleBalance Error : ", error.message);
    bot.sendMessage(chatId, "Failed to Get User Balance.");
  }
}

async function PlaceOrder(chatId, id, price, name) {
  // switch to wait for response
  BOT_WAITING_FOR_RESPONSE = true;
  let playerId;
  bot.sendMessage(chatId, "enter Player ID:");

  bot.once("message", async (msg) => {
    if (BOT_WAITING_FOR_RESPONSE) {
      playerId = msg.text;
      bot.sendMessage(
        chatId,
        `Confirm by Typing *YES* \n_Note:If You Type anything else , your order will be Canceled._ `,
        {
          parse_mode: "Markdown",
        }
      );
      bot.once("message", async (msg) => {
        if (BOT_WAITING_FOR_RESPONSE && playerId) {
          if (msg.text.toLowerCase() === "yes") {
            try {
              const user = await User.findOne({ chatId });
              axios
                .post(
                  `${ICH7EN_API_BASE_URL}/order`,
                  {
                    playerId,
                    itemId: id,
                    quantity: 1,
                    referenceId: uuidv4(),
                  },
                  {
                    headers: {
                      "api-token": `${user.apiKey}`,
                    },
                  }
                )
                .then(async (response) => {
                  //save order in db
                  await Order.create({
                    userChatId: chatId,
                    orderName: name,
                    playerId,
                    itemId: id,
                    price,
                    orderNumber: response.data.data.orderNumber,
                    invoiceNumber: response.data.data.invoiceNumber,
                  });
                  const newBalance = await axios
                    .get(`${ICH7EN_API_BASE_URL}/profile`, {
                      headers: {
                        "api-token": `${user.apiKey}`,
                      },
                    })
                    .then((response) => {
                      return response.data.data.balance;
                    });
                  bot.sendMessage(
                    chatId,
                    `Your Order Has been Created successfully! \n
                    📦  _Order Number :_ \`${response.data.data.orderNumber}\` \n
                    💰  _Your Current Balance:_ \`${newBalance}\`
                    `,
                    {
                      parse_mode: "MARKDOWN",
                    }
                  );
                  //excute order status function

                  return;
                })
                .catch((error) => {
                  console.log("GetProfile Error : ", error.message);
                  bot.sendMessage(
                    chatId,
                    `Failed to TopUp: \n _${error.response.data.text}_`,
                    {
                      parse_mode: "MARKDOWN",
                    }
                  );
                });
            } catch (error) {
              console.log("PlaceOrder Error : ", error.message);
              bot.sendMessage(chatId, "Failed to TopUp.");
            }
          } else {
            bot.sendMessage(chatId, "Your Order Has Been Canceled.");
          }
          return;
        }
      });
    }
    return;
  });
}

async function handleRecentOrders(chatId) {
  try {
    Order.find({ userChatId: chatId })
      .sort({ createdAt: -1 })
      .limit(10)
      .then((orders) => {
        if (orders.length > 0) {
          bot.sendMessage(
            chatId,
            "_Note: Tap on Order to see order Status and other Details_",
            { parse_mode: "Markdown" }
          );

          const ordersButtons = orders.map((order) => [
            {
              text: `🛒 `
                .concat(" ")
                .concat(
                  `OrderNumber : =>  ${[...order.orderNumber.toString()].join(
                    " "
                  )}`
                )
                .concat(" ")
                .concat(` 🛒`),
              callback_data: `order_select_${order.orderNumber}`,
            },
          ]);
          const options = {
            reply_markup: {
              inline_keyboard: [...ordersButtons],
            },
            parse_mode: "MARKDOWN",
          };
          bot.sendMessage(chatId, "*Recent Orders :*", options);

          return;
        }
        bot.sendMessage(chatId, "Recent Orders : You have no orders Yet");
        return;
      })
      .catch((error) => {
        console.log("BalanceOrders Error : ", error.message);
        bot.sendMessage(chatId, "Failed to Get Recent Orders.");
      });
  } catch (error) {
    console.log("HandleBalanceOrders Error : ", error.message);
    bot.sendMessage(chatId, "Failed to Get Recent Orders.");
  }
}

async function CheckOrder(chatId, orderNumber) {
  try {
    const user = await User.findOne({ chatId });
    axios
      .post(
        `${ICH7EN_API_BASE_URL}/status`,
        {
          orderNumber,
        },
        {
          headers: {
            "api-token": `${user.apiKey}`,
          },
        }
      )
      .then(async (response) => {
        //save order in db
        const newOrder = await Order.findOneAndUpdate(
          {
            orderNumber,
          },
          {
            status: response.data.data.status,
          },
          {
            new: true,
          }
        );
        let statusPoint = "🟡";
        switch (newOrder.status) {
          case "Complete":
            statusPoint = "🟢";
            break;
          case "Cancelled":
            statusPoint = "🔴";
            break;
          default:
            break;
        }

        bot.sendMessage(
          chatId,
          `
    *STATUS:*  ${statusPoint}  *${newOrder.status}*\n\n             
    🏷️ _TopUp Offer:_  *${newOrder.orderName}*\n
    👤 _Player Id:_  \`${newOrder.playerId}\`\n
    💵 _Total Price:_  \`${parseFloat(newOrder.price.toString())} $\`\n
    📦 _Order Number:_  \`${newOrder.orderNumber}\`\n 
    \n\n                   
                    `,
          {
            parse_mode: "MARKDOWN",
          }
        );
        //excute order status function

        return;
      })
      .catch((error) => {
        console.log("GetOrder Error : ", error.message);
        bot.sendMessage(chatId, "Failed to Get Order Details.");
      });
  } catch (error) {
    console.log("CheckOrder Error : ", error.message);
    bot.sendMessage(chatId, "Failed to Get Order Details.");
  }
}

// Command handlers
bot.onText(/\/start/, (msg) => {
  BOT_WAITING_FOR_RESPONSE = false;
  handleStartCommand(msg.chat.id);
});

bot.onText(/\/offers/, (msg) => {
  BOT_WAITING_FOR_RESPONSE = false;
  const chatId = msg.chat.id;
  handleOffersCommand(chatId);
});

bot.onText(/\/balance/, (msg) => {
  BOT_WAITING_FOR_RESPONSE = false;
  const chatId = msg.chat.id;
  handleBalanceCommand(chatId);
});

bot.onText(/\/recent/, (msg) => {
  BOT_WAITING_FOR_RESPONSE = false;
  const chatId = msg.chat.id;
  handleRecentCommand(chatId);
});

bot.onText(/\/help/, (msg) => {
  BOT_WAITING_FOR_RESPONSE = false;
  const chatId = msg.chat.id;
  const helpMessage = commands
    .map((cmd) => `${cmd.command} - ${cmd.description}`)
    .join("\n");
  bot.sendMessage(chatId, helpMessage);
});

bot.onText(/\/key/, async (msg) => {
  BOT_WAITING_FOR_RESPONSE = false;
  const chatId = msg.chat.id;
  handleKeyCommand(chatId);
});

// Callback query handler
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data.split("_");
  const command = data[0];
  const action = data[1];
  const id = data[2];

  switch (command) {
    case "offer":
      if (action === "select") {
        handleOfferSelection(chatId, id);
      }
      break;
    case "order":
      if (action === "select") {
        CheckOrder(chatId, id);
      }
      break;
    default:
      bot.sendMessage(chatId, "Invalid selection.");
      break;
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.text.startsWith("/")) {
    if (msg.text.indexOf("💰 Balance") === 0) {
      BOT_WAITING_FOR_RESPONSE = false;
      handleBalanceCommand(chatId);
    }
    if (msg.text.indexOf("📦 Recent Orders") === 0) {
      BOT_WAITING_FOR_RESPONSE = false;
      handleRecentCommand(chatId);
    }
    if (msg.text.indexOf("🏷️ TopUp Free Fire Gems") === 0) {
      BOT_WAITING_FOR_RESPONSE = false;

      handleOffersCommand(chatId);
      return;
    }
    ///
    if (msg.text.indexOf("🔑 Set/Change Api Key") === 0) {
      BOT_WAITING_FOR_RESPONSE = false;
      handleKeyCommand(chatId);
    }
  }
});

///THIS IS ADDED TO PREVENT RENDER FROM SPINNING OFF
function reloadWebsite() {
  const url = `https://ich7en-automated-telegram-bot.onrender.com/`; // Replace with your Render URL
  const interval = 30000; // Interval in milliseconds (30 seconds)
  axios
    .get(url)
    .then((response) => {
      console.log(
        `Reloaded at ${new Date().toISOString()}: Status Code ${
          response.status
        }`
      );
    })
    .catch((error) => {
      console.error(
        `Error reloading at ${new Date().toISOString()}:`,
        error.message
      );
    });
}

cron.schedule("* * * * *", () => {
  reloadWebsite();
});

app.listen(Port, () => {
  console.log(`App listening on port ${Port}`);
});
