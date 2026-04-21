// ===== PROTEÇÃO GLOBAL =====
if (global.__botRunning) {
  console.log("Já está rodando, encerrando duplicado");
  process.exit(0);
}
global.__botRunning = true;

// ===== IMPORTS =====
const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const axios = require("axios");

// ===== CLIENT =====
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

// ===== MODEL =====
const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  lastReply: String
}));

// ===== LOCK GLOBAL (ANTI DUPLICAÇÃO) =====
const Lock = mongoose.model("Lock", new mongoose.Schema({
  _id: String,
  createdAt: { type: Date, default: Date.now, expires: 30 }
}));

// ===== MODELOS FUNCIONAIS =====
const MODELS = [
  "openai/gpt-3.5-turbo",
  "meta-llama/llama-3-8b-instruct"
];

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, lastReply: "" });

  const systemPrompt = `
Você é um bot de Discord.

REGRAS:
- Responda em português
- Máximo 2 frases
- Seja direto
- Não invente assunto
- Não repita resposta
`;

  for (let model of MODELS) {
    try {
      console.log("Tentando modelo:", model);

      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          max_tokens: 120,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: pergunta }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      let reply = res.data?.choices?.[0]?.message?.content;
      if (!reply) continue;

      // evita repetir resposta
      if (reply === user.lastReply) {
        reply = "Pode reformular?";
      }

      user.lastReply = reply;
      await user.save();

      return reply; // 🔥 retorna e para aqui

    } catch (err) {
      console.log("Erro modelo:", model);

      if (err.response) {
        console.log("DATA:", err.response.data);
      } else {
        console.log(err.message);
      }
    }
  }

  return "Não consegui responder agora.";
}

// ===== READY =====
client.once("ready", () => {
  console.log("Bot online:", client.user.tag);
});

// ===== LISTENER ÚNICO =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔒 trava duplicação entre instâncias
  try {
    await Lock.create({ _id: message.id });
  } catch {
    return;
  }

  console.log("Mensagem:", message.content);

  // só responde se marcar o bot
  if (!message.mentions.has(client.user)) return;

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

// ===== LOGIN =====
client.login(process.env.TOKEN);
