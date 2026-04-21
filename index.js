// ===== PROTEÇÃO =====
if (global.botStarted) process.exit();
global.botStarted = true;

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
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
  .catch(err => console.log("❌ Mongo erro:", err));

// ===== SCHEMA =====
const convoSchema = new mongoose.Schema({
  userId: String,
  messages: Array
});

const Convo = mongoose.model("Convo", convoSchema);

// ===== IA =====
async function perguntarIA(userId, pergunta) {
  let user = await Convo.findOne({ userId });

  if (!user) {
    user = new Convo({ userId, messages: [] });
  }

  // 💖 PERSONALIDADE LEVE
  const systemPrompt = `
Você é um bot de Discord gentil e levemente carinhoso.

COMPORTAMENTO:
- Respostas curtas e naturais
- Use no máximo uma expressão: "meu bem", "meu amor" ou "minha vida"
- Seja educado e tranquilo

REGRAS:
- NÃO usar emojis
- NÃO escrever textos longos
- Máximo de 2 frases
`;

  user.messages.push({ role: "user", content: pergunta });
  user.messages = user.messages.slice(-10);

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-3.5-turbo",
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

  const reply = response.data.choices[0].message.content;

  user.messages.push({ role: "assistant", content: reply });
  await user.save();

  return reply;
}

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Ver banner do usuário")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Usuário")
    ),

  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Ver perfil do usuário")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Usuário")
    ),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Falar com IA")
    .addStringOption(opt =>
      opt.setName("msg")
        .setDescription("Mensagem")
        .setRequired(true)
    )
];

// ===== REGISTRAR SLASH =====
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deployCommands() {
  try {
    console.log("🔄 Registrando slash commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log("✅ Slash commands registrados");
  } catch (err) {
    console.log("❌ Erro ao registrar slash:", err);
  }
}

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`🤖 Online como ${client.user.tag}`);
  await deployCommands();
});

// ===== MENSAGENS =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // !say
  if (message.content.startsWith("!say ")) {
    return message.channel.send(
      message.content.replace("!say ", "")
    );
  }

  // !saybox
  if (message.content.startsWith("!saybox ")) {
    return message.channel.send(
      "```" + message.content.replace("!saybox ", "") + "```"
    );
  }

  // ===== BLOQUEIOS =====
  if (message.mentions.everyone) return;
  if (message.mentions.roles.size > 0) return;
  if (message.mentions.users.size > 1) return;

  // ===== RESPONDE SÓ SE MARCAR =====
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!pergunta) return;

  try {
    await message.channel.sendTyping();

    let resposta = await perguntarIA(
      message.author.id,
      pergunta
    );

    if (resposta.length > 2000) {
      resposta = resposta.slice(0, 1990) + "...";
    }

    message.reply(resposta);

  } catch (err) {
    console.log(err);
    message.reply("❌ erro na IA");
  }
});

// ===== SLASH HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.options.getUser("user") || interaction.user;

  if (interaction.commandName === "banner") {
    return interaction.reply("Usuário não possui banner ou API limitada.");
  }

  if (interaction.commandName === "perfil") {
    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "ID", value: user.id },
        { name: "Conta criada", value: `<t:${parseInt(user.createdTimestamp / 1000)}:R>` }
      );

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "ia") {
    const msg = interaction.options.getString("msg");

    await interaction.deferReply();

    try {
      let resposta = await perguntarIA(interaction.user.id, msg);

      if (resposta.length > 2000) {
        resposta = resposta.slice(0, 1990) + "...";
      }

      interaction.editReply(resposta);

    } catch (err) {
      console.log(err);
      interaction.editReply("❌ erro na IA");
    }
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
