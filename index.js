if (global.botStarted) process.exit();
global.botStarted = true;

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const mongoose = require("mongoose");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo OK"))
  .catch(() => console.log("Erro Mongo"));

const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  lastReply: String
}));

// 🔥 MODELOS COM FALLBACK
const MODELS = [
  "google/gemma-7b-it:free",
  "mistralai/mistral-7b-instruct:free"
];

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, lastReply: "" });

  const systemPrompt = `
Responda em português, curto e direto.
No máximo 2 frases.
`;

  for (let model of MODELS) {
    try {
      console.log("Tentando modelo:", model);

      const response = await axios.post(
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

      let reply = response.data.choices[0].message.content;

      if (!reply) continue;

      if (reply === user.lastReply) {
        reply = "Pode explicar melhor?";
      }

      user.lastReply = reply;
      await user.save();

      return reply;

    } catch (err) {
      console.log("Erro no modelo:", model);

      if (err.response) {
        console.log("DATA:", err.response.data);
        console.log("STATUS:", err.response.status);
      } else {
        console.log(err.message);
      }
    }
  }

  return "Não consegui responder agora.";
}

const commands = [
  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Falar com IA")
    .addStringOption(o =>
      o.setName("msg").setDescription("Mensagem").setRequired(true)
    )
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deployCommands() {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands.map(c => c.toJSON()) }
  );
}

client.once("clientReady", async () => {
  console.log("Bot online:", client.user.tag);
  await deployCommands();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log("Mensagem:", message.content);

  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    const resposta = await perguntarIA(message.author.id, pergunta);

    console.log("Resposta:", resposta);

    await message.channel.send(resposta);

  } catch (err) {
    console.log("ERRO FINAL:", err);
    message.channel.send("erro");
  }
});

client.login(process.env.TOKEN);
