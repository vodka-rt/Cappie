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
const EMOJIS = {
  feliz: "<:OguriSmile:1496200764153139401>",
  triste: "<:OguriUpset:1496200839423856651>",
  carinho: "<:OguriBless:1496200908952965321>",
  ansioso: "<:OguriAnxious:1496200706841907423>",
  irritado: "<:OguriAnnoyed:1496200280314744842>",
  comida: "<:OguriMunch:1496200598318743674>"
};

function escolherEmoji(texto) {
  texto = texto.toLowerCase();

  if (texto.includes("triste")) return EMOJIS.triste;
  if (texto.includes("feliz") || texto.includes("bom")) return EMOJIS.feliz;
  if (texto.includes("amor") || texto.includes("obrigado")) return EMOJIS.carinho;
  if (texto.includes("ansioso") || texto.includes("nervoso")) return EMOJIS.ansioso;
  if (texto.includes("raiva") || texto.includes("irritado")) return EMOJIS.irritado;
  if (texto.includes("comida") || texto.includes("comer")) return EMOJIS.comida;

  return "";
}

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId });

  const systemPrompt = {
    role: "system",
    content: `
Você é Cappie, uma garota amigável e inteligente.

REGRAS:
- Responda APENAS o que foi perguntado
- Máx 2 frases
- Português natural
- Não invente assunto
- Não use emojis escritos tipo :emoji:
`
  };

  user.messages.push({ role: "user", content: pergunta });

  if (user.messages.length > 10) {
    user.messages = user.messages.slice(-10);
  }

  try {
    console.log("Chamando IA...");

    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        max_tokens: 120,
        messages: [systemPrompt, ...user.messages]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    let reply = res.data?.choices?.[0]?.message?.content;

    if (!reply) return "Não consegui responder agora.";

    // remove qualquer emoji fake
    reply = reply.replace(/:.*?:/g, "");

    const emoji = escolherEmoji(reply);

    user.messages.push({ role: "assistant", content: reply });
    await user.save();

    return emoji ? `${reply} ${emoji}` : reply;

  } catch (err) {
    console.log("ERRO IA:");
    console.log(err.code || err.message);
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

  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  if (message.content === "!ping") {
    return message.channel.send("pong");
  }

  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;

  if (!message.mentions.users.has(client.user.id)) return;

  console.log("MENÇÃO DETECTADA");

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  if (pergunta.length > 200) {
    return message.channel.send("Mensagem muito grande 😵");
  }

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
