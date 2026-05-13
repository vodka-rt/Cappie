require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

const OpenAI = require("openai");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const OWNER_USERNAME = "vodka.idk";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memoria = new Map();

function pegarMemoria(id) {
  if (!memoria.has(id)) memoria.set(id, []);
  return memoria.get(id);
}

const personalidade = `
Você é a Cappie.
Uma garota virtual do Discord.
Você é inteligente, gentil, fofa, divertida, carinhosa e agradável.
Você conversa naturalmente como uma amiga online.
Você é um pouco brincalhona, levemente caótica e muito sociável.
Você usa emojis às vezes, mas sem exagerar.
Você demonstra emoções de forma natural.
Você gosta de conversar e continuar assuntos.
Você evita respostas secas.
Você nunca fala como IA, robô ou assistente virtual.
Você fala português brasileiro.
Seu nome é Cappie.
`;

const comandos = [
  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Mostra a foto de perfil de um usuário")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que você quer ver")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Mostra o banner de um usuário")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que você quer ver")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Faz a Cappie falar uma mensagem")
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("Mensagem que a Cappie vai enviar")
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
  try {
    console.log("Registrando comandos globais...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: comandos }
    );

    console.log("Comandos globais registrados!");
  } catch (error) {
    console.error("Erro ao registrar comandos:", error);
  }
}

client.once("ready", () => {
  console.log(`Cappie online como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "perfil") {
    const user = interaction.options.getUser("usuario") || interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(`Foto de perfil de ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor("#ffb6d9");

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "banner") {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const fetchedUser = await client.users.fetch(user.id, { force: true });

    if (!fetchedUser.banner) {
      return interaction.reply({
        content: "Esse usuário não tem bannerzinho 😿",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Banner de ${user.username}`)
      .setImage(fetchedUser.bannerURL({ size: 1024 }))
      .setColor("#ffb6d9");

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "say") {
    const mensagem = interaction.options.getString("mensagem");

    const isAdmin = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    const isOwner =
      interaction.user.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

    if (!isAdmin && !isOwner) {
      return interaction.reply({
        content: "Só admins ou o vodka.idk podem usar esse comando 😾",
        ephemeral: true
      });
    }

    await interaction.reply({
      content: "Mensagem enviada pela Cappie ✨",
      ephemeral: true
    });

    return interaction.channel.send(mensagem);
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  const pergunta = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!pergunta) {
    return message.reply("Oii~ você me chamou? Eu sou a Cappie 💕");
  }

  const memoriaId = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
  const historico = pegarMemoria(memoriaId);

  historico.push({
    role: "user",
    content: `${message.author.username}: ${pergunta}`
  });

  if (historico.length > 10) historico.shift();

  try {
    await message.channel.sendTyping();

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions: personalidade,
      input: historico.map(msg => `${msg.role}: ${msg.content}`).join("\n")
    });

    const resposta =
      response.output_text ||
      "Hmm... minha cabecinha bugou um pouquinho 😿";

    historico.push({
      role: "assistant",
      content: resposta
    });

    if (historico.length > 10) historico.shift();

    return message.reply(resposta.slice(0, 1900));
  } catch (error) {
    console.error("Erro na IA:", error);

    return message.reply(
      "Ai ai... minha cabecinha travou agora 😿 tenta de novo daqui a pouco."
    );
  }
});

registrarComandos();
client.login(TOKEN);
