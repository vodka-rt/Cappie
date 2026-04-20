// ===== PROTEÇÃO =====
if (global.botStarted) process.exit();
global.botStarted = true;

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
} = require("discord.js");

const mongoose = require("mongoose");
const axios = require("axios");

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ===== MONGODB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 Mongo conectado"))
  .catch(err => console.log(err));

// ===== SCHEMA =====
const convoSchema = new mongoose.Schema({
  userId: String,
  messages: Array
});

const Convo = mongoose.model("Convo", convoSchema);

// ===== IA (OPENROUTER) =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });

  if (!user) {
    user = new Convo({
      userId,
      messages: []
    });
  }

  user.messages.push({ role: "user", content: pergunta });

  // limita histórico
  user.messages = user.messages.slice(-10);

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-3.5-turbo",
      messages: user.messages
    },
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const reply = response.data.choices[0].message.content;

  user.messages.push({ role: "assistant", content: reply });
  await user.save();

  return reply;
}

// ===== READY =====
client.once("clientReady", () => {
  console.log(`🤖 Online como ${client.user.tag}`);
});

// ===== COMANDOS =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== !say =====
  if (message.content.startsWith("!say ")) {
    return message.channel.send(
      message.content.replace("!say ", "")
    );
  }

  // ===== !saybox =====
  if (message.content.startsWith("!saybox ")) {
    return message.channel.send(
      "```" + message.content.replace("!saybox ", "") + "```"
    );
  }

  // ===== IA POR MENÇÃO =====
  if (message.mentions.has(client.user)) {
    const pergunta = message.content.replace(
      `<@${client.user.id}>`,
      ""
    ).trim();

    if (!pergunta) return;

    try {
      await message.channel.sendTyping();

      let resposta = await perguntarIA(
        message.author.id,
        pergunta
      );

      // limitar 2000 chars
      if (resposta.length > 2000) {
        resposta = resposta.slice(0, 1990) + "...";
      }

      message.reply(resposta);

    } catch (err) {
      console.log(err);
      message.reply("❌ erro na IA");
    }
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
