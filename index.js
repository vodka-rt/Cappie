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

// ===== EMOJIS =====
const EMOJIS = [
  "<:OguriBless:1496200908952965321>",
  "<:OguriUpset:1496200839423856651>",
  "<:OguriSmile:1496200764153139401>",
  "<:OguriAnxious:1496200706841907423>",
  "<:OguriAnnoyed:1496200280314744842>",
  "<:OguriMunch:1496200598318743674>"
];

function escolherEmoji() {
  if (Math.random() > 0.4) return "";
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const systemPrompt = {
    role: "system",
    content: `
Você é Cappie.

REGRAS:
- Responda exatamente o que foi perguntado
- Se for cumprimento, responda só com cumprimento
- Não invente assunto
- Máx 1 frase
- Português natural
- Não use :emoji:
`
  };

  user.messages = [{ role: "user", content: pergunta }];

  try {
    console.log("Chamando IA...");

    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        max_tokens: 60,
        messages: [systemPrompt, ...user.messages]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 8000
      }
    );

    let reply = res.data?.choices?.[0]?.message?.content;

    if (!reply) return "Não consegui responder agora.";

    reply = reply.replace(/:.*?:/g, "");

    const emoji = escolherEmoji();

    user.messages.push({ role: "assistant", content: reply });
    await user.save();

    return emoji ? `${reply} ${emoji}` : reply;

  } catch (err) {
    console.log("ERRO IA:", err.code || err.message);
    return "Tô meio lenta agora 😵";
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

  // anti duplicação
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  // comando teste
  if (message.content === "!ping") {
    return message.reply("pong");
  }

  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;

  const mentionRegex = new RegExp(`<@!?${client.user.id}>`);

  if (!mentionRegex.test(message.content)) return;

  console.log("MENÇÃO DETECTADA");

  const pergunta = message.content
    .replace(mentionRegex, "")
    .trim();

  // evita crash
  if (!pergunta || pergunta.length < 2) {
    return message.reply("Fala algo pra eu responder 😭");
  }

  if (pergunta.length > 200) {
    return message.reply("Mensagem muito grande 😵");
  }

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    console.log("Resposta:", resposta);

    // 💥 RESPOSTA COM REPLY
    return message.reply({
      content: resposta,
      allowedMentions: { repliedUser: false }
    });

  } catch (err) {
    console.log("ERRO FINAL:", err);
    return message.reply("erro");
  }
});

client.login(process.env.TOKEN);
