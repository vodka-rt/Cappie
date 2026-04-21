// ===== PROTEÇÃO =====
if (global.__botRunning) process.exit();
global.__botRunning = true;

const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== BANCO =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo OK"))
  .catch(err => console.log("Erro Mongo:", err.message));

// ===== MODELS =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  messages: { type: Array, default: [] }
}));

const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const systemPrompt = {
    role: "system",
    content: `
Você é Cappie, uma garota amigável.

REGRAS:
- Responda em português
- Máx 2 frases
- Seja natural

EMOJIS:
<:OguriSmile:1496200764153139401>
<:OguriUpset:1496200839423856651>
<:OguriBless:1496200908952965321>
<:OguriAnxious:1496200706841907423>
<:OguriAnnoyed:1496200280314744842>
<:OguriMunch:1496200598318743674>

Use no máximo 1 emoji e não sempre.
`
  };

  user.messages.push({ role: "user", content: pergunta });

  if (user.messages.length > 10) {
    user.messages = user.messages.slice(-10);
  }

  try {
    console.log("Chamando OpenRouter...");

    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-3-8b-instruct",
        max_tokens: 120,
        messages: [systemPrompt, ...user.messages]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let reply = res.data?.choices?.[0]?.message?.content;

    if (!reply) {
      console.log("Resposta vazia");
      return "Não consegui responder agora.";
    }

    user.messages.push({ role: "assistant", content: reply });
    await user.save();

    return reply;

  } catch (err) {
    console.log("ERRO OPENROUTER:");
    console.log(err.response?.data || err.message);
    return "Tive um probleminha pra responder agora.";
  }
}

// ===== READY =====
client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log("Mensagem:", message.content);

  // 🔒 anti duplicação
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  // teste
  if (message.content === "!ping") {
    return message.channel.send("pong");
  }

  // 🚫 bloqueios
  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;

  // ✅ DETECÇÃO REAL DE MENÇÃO (FIX)
  if (!message.content.includes(client.user.id)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    console.log("Resposta:", resposta);

    return message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    return message.channel.send("erro");
  }
});

client.login(process.env.TOKEN);
