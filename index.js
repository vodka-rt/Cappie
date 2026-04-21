if (global.botStarted) process.exit();
global.botStarted = true;

const {
  Client,
  GatewayIntentBits,
  Partials,
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
  ],
  partials: [Partials.Channel]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo OK"))
  .catch(() => {});

const Convo = mongoose.model("Convo", new mongoose.Schema({
  userId: String,
  lastReply: String
}));

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, lastReply: "" });

  const systemPrompt = `
Você é um bot de Discord natural.

REGRAS:
- Sempre responda em português do Brasil
- Respostas curtas (máx 2 frases)
- Não invente assunto
- Não repita frases

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
- Use apenas se fizer sentido
- NUNCA escreva :emoji:
- Use exatamente o formato <:nome:id>
`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
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

    // remove bug de tradução
    if (reply.includes("(") && reply.includes(")")) {
      reply = reply.split("(")[0].trim();
    }

    // evita repetição
    if (reply === user.lastReply) {
      reply = "Pode falar de outro jeito?";
    }

    user.lastReply = reply;
    await user.save();

    return reply;

  } catch (err) {
    console.log("Erro IA:", err.response?.data || err.message);
    return "Erro ao responder.";
  }
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

  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    let resposta = await perguntarIA(message.author.id, pergunta);

    if (resposta.length > 2000) {
      resposta = resposta.slice(0, 1990);
    }

    // 🔥 SEM ERRO 403
    message.channel.send(`<@${message.author.id}> ${resposta}`);

  } catch {
    message.channel.send("erro");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ia") {
    const msg = interaction.options.getString("msg");

    await interaction.deferReply();

    let resposta = await perguntarIA(interaction.user.id, msg);

    if (resposta.length > 2000) {
      resposta = resposta.slice(0, 1990);
    }

    interaction.editReply(resposta);
  }
});

client.login(process.env.TOKEN);
