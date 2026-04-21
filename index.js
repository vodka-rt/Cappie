if (global.botStarted) process.exit();
global.botStarted = true;

const {
  Client,
  GatewayIntentBits
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

// 🔥 MODELOS (FUNCIONAM)
const MODELS = [
  "nousresearch/nous-hermes-2-mixtral",
  "openai/gpt-3.5-turbo"
];

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, lastReply: "" });

  const systemPrompt = `
Você é um bot de Discord natural.

REGRAS:
- Sempre responda em português do Brasil
- Respostas curtas (máx 2 frases)
- Não invente assunto
- Não repita respostas
- Seja direto e natural

EMOJIS:
Você pode usar emojis SOMENTE nesse formato:

<:OguriSmile:1496200764153139401> (feliz)
<:OguriUpset:1496200839423856651> (triste)
<:OguriBless:1496200908952965321> (amor)
<:OguriAnxious:1496200706841907423> (ansiedade)
<:OguriAnnoyed:1496200280314744842> (irritado)
<:OguriMunch:1496200598318743674> (comida)

REGRAS DE EMOJI:
- Use no máximo 1 emoji
- Não use sempre
- Só use se fizer sentido
- NUNCA escreva :emoji:
`;

  for (let model of MODELS) {
    try {
      console.log("Tentando:", model);

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

      let reply = res.data.choices?.[0]?.message?.content;
      if (!reply) continue;

      // remove tradução bugada
      if (reply.includes("(") && reply.includes(")")) {
        reply = reply.split("(")[0].trim();
      }

      // evita repetir
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
      }
    }
  }

  return "Não consegui responder agora.";
}

client.once("ready", () => {
  console.log("Bot online:", client.user.tag);
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
