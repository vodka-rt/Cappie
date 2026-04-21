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
  messages: Array
}));

async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });
  if (!user) user = new Convo({ userId, messages: [] });

  const systemPrompt = `
Você é um bot de Discord natural.

REGRAS IMPORTANTES:
- Responda APENAS em português do Brasil
- NUNCA traduza a resposta
- NUNCA repita a mesma frase em outro idioma
- NÃO misture idiomas
- NÃO continue respostas antigas automaticamente

COMPORTAMENTO:
- Responda somente a mensagem atual
- Use contexto apenas se for claramente necessário
- Ignore completamente assuntos antigos irrelevantes

ESTILO:
- Respostas curtas (1–2 frases)
- Sem emojis
- Fale como uma pessoa normal
`;

  // reset inteligente de contexto
  if (
    pergunta.toLowerCase().includes("boa tarde") ||
    pergunta.length < 5
  ) {
    user.messages = [];
  }

  user.messages.push({ role: "user", content: pergunta });

  // memória curta
  user.messages = user.messages.slice(-3);

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          ...user.messages
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

    // remove tradução bugada
    if (reply.includes("(") && reply.includes(")")) {
      reply = reply.split("(")[0].trim();
    }

    // salva resposta limpa
    if (reply && reply.length < 500) {
      user.messages.push({ role: "assistant", content: reply });
    }

    await user.save();

    return reply;

  } catch (err) {
    console.log("Erro IA:", err.response?.data || err.message);

    if (err.response?.status === 402) {
      return "Estou sem crédito no momento.";
    }

    if (err.response?.status === 404) {
      return "Modelo indisponível agora.";
    }

    return "Não consegui responder agora.";
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
  if (message.mentions.users.size > 1) return;
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

    message.reply(resposta);

  } catch {
    message.reply("erro");
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
