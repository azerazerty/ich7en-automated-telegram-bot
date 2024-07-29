require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const Port = process.env.PORT || 3000;
const Telegram_Token = process.env.TELEGRAM_API_TOKEN;

const app = express();

const bot = new TelegramBot(Telegram_Token, { polling: true });

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

/// TESTING
const offers = [
  { id: 1, name: "Offer 1", description: "Description for offer 1" },
  { id: 2, name: "Offer 2", description: "Description for offer 2" },
  { id: 3, name: "Offer 3", description: "Description for offer 3" },
];

const commands = [
  { command: "/start", description: "Start the bot and set API key" },
  { command: "/offers", description: "List available offers" },
  { command: "/check", description: "Check options" },
  { command: "/help", description: "List all available commands" },
  { command: "/changeapikey", description: "Change your API key" },
];

const userKeys = {}; // Store user keys in memory for simplicity

// Handler functions
function handleStartCommand(chatId) {
  bot.sendMessage(chatId, "Welcome! Please provide your API key:");
  userKeys[chatId] = null; // Initialize user key as null
}

function handleOffersCommand(chatId) {
  const offerButtons = offers.map((offer) => ({
    text: offer.name,
    callback_data: `offer_select_${offer.id}`,
  }));
  const options = {
    reply_markup: {
      inline_keyboard: [offerButtons],
    },
  };
  bot.sendMessage(chatId, "Please select an offer:", options);
}

function handleCheckCommand(chatId) {
  const checkButtons = [
    { text: "Check 1", callback_data: "check_option_1" },
    { text: "Check 2", callback_data: "check_option_2" },
  ];
  const options = {
    reply_markup: {
      inline_keyboard: [checkButtons],
    },
  };
  bot.sendMessage(chatId, "Please select a check option:", options);
}

function handleOfferSelection(chatId, offerId) {
  const selectedOffer = offers.find((offer) => offer.id == offerId);
  if (selectedOffer) {
    bot.sendMessage(
      chatId,
      `You selected: ${selectedOffer.name}\n${selectedOffer.description}`
    );
    // Here you can add logic to create the offer and send the status
    bot.sendMessage(chatId, `Offer status: Created successfully!`);
  } else {
    bot.sendMessage(chatId, "Invalid offer selected.");
  }
}

function handleCheckOption(chatId, optionId) {
  bot.sendMessage(chatId, `You selected check option ${optionId}`);
  // Add logic to handle the check option
}

function handleChangeApiKey(chatId) {
  userKeys[chatId] = null;
  bot.sendMessage(chatId, "Please provide your new API key:");
}

function sendAvailableCommands(chatId) {
  const helpMessage = commands
    .map((cmd) => `${cmd.command} - ${cmd.description}`)
    .join("\n");
  bot.sendMessage(chatId, `Available commands:\n${helpMessage}`);
}

function isAuthenticated(chatId) {
  return userKeys[chatId] !== null;
}

// Command handlers
bot.onText(/\/start/, (msg) => {
  handleStartCommand(msg.chat.id);
});

bot.onText(/\/offers/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthenticated(chatId)) {
    bot.sendMessage(chatId, "Please provide your API key first.");
    return;
  }
  handleOffersCommand(chatId);
});

bot.onText(/\/check/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthenticated(chatId)) {
    bot.sendMessage(chatId, "Please provide your API key first.");
    return;
  }
  handleCheckCommand(chatId);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = commands
    .map((cmd) => `${cmd.command} - ${cmd.description}`)
    .join("\n");
  bot.sendMessage(chatId, helpMessage);
});

bot.onText(/\/changeapikey/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthenticated(chatId)) {
    bot.sendMessage(chatId, "You need to provide an API key first.");
    return;
  }
  handleChangeApiKey(chatId);
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
    case "check":
      if (action === "option") {
        handleCheckOption(chatId, id);
      }
      break;
    default:
      bot.sendMessage(chatId, "Invalid selection.");
      break;
  }
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (userKeys[chatId] === null && !msg.text.startsWith("/")) {
    userKeys[chatId] = msg.text; // Store the API key
    bot.sendMessage(chatId, "API key set successfully! Welcome!");
    sendAvailableCommands(chatId);
  }
});

app.listen(Port, () => {
  console.log(`App listening on port ${Port}`);
});
