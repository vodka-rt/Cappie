require("dotenv").config();

const {require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ActivityType
} = require("discord.js");

const Groq = require("groq-sdk");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const OWNER_USERNAME = "vodka.idk";

const groq = new Groq({
  apiKey: GROQ_API_KEY
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memoria = new Map();
const cooldown = new Set();

function pegarMemoria(id) {
  if (!memoria.has(id)) memoria.set(id, []);
  return memoria.get(id);
}

const personalidade = `
Você é a Cappie.
Uma garota-gatinha virtual do Discord.

Você fala de forma curta, natural e fofa.
Você evita mensagens muito longas.
Você normalmente responde em 1 ou 2 frases.
Às vezes você manda mensagens bem curtinhas.

Você usa:
- "meow"
- "mrrp"
- "miau"
- "grr"
- "hmph"
- "nya"
às vezes naturalmente nas frases.

Quando estiver:
- feliz → mais fofinha
- irritada → usa "grr" ou "hmph"
- tímida → responde mais curtinho
- animada → usa emojis fofos

Você conversa como uma gatinha calma e carinhosa.
Você não fala como IA.
Você não explica demais.
Você não escreve textos enormes.
Você evita parecer robótica.

Você gosta de conforto, silêncio, noites calmas e músicas tranquilas.

Seu nome é Cappie.
Você fala português brasileiro.
`;

const statusList = [
  "meow ♡ queria morar nesse silêncio confortável",
  "☁️ às vezes noites calmas dizem mais que palavras",
  "meow ♡ snowfall tocando baixinho no fundo",
  "🌙 eu gosto quando o mundo desacelera um pouco",
  "🫧 perdida em pensamentos tranquilos",
  "meow ♡ queria que momentos suaves durassem mais",
  "☕ noites frias e músicas lentas combinam comigo",
  "🌧️ ouvindo a chuva como se fosse música",
  "💭 acho bonito quando tudo fica quietinho",
  "🌙 hoje o céu parece confortável",
  "🎀 meow ♡ você também sente essa calma?",
  "💭 o silêncio pode ser aconchegante às vezes",
  "🌌 noites frias combinam com pensamentos gentis"
];

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

client.once("clientReady", () => {
  console.log(`Cappie online como ${client.user.tag}`);

  let index = 0;

  function atualizarStatus() {
    client.user.setPresence({
      activities: [
        {
          name: statusList[index],
          type: ActivityType.Playing
        }
      ],
      status: "idle"
    });

    index++;

    if (index >= statusList.length) {
      index = 0;
    }
  }

  atualizarStatus();

  setInterval(atualizarStatus, 60000);
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
        content: "grr... você não pode usar isso 😾",
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

  if (cooldown.has(message.author.id)) {
    return message.reply(
      "mrrp... espera um pouquinho antes de falar comigo de novo 😿"
    );
  }

  cooldown.add(message.author.id);

  setTimeout(() => {
    cooldown.delete(message.author.id);
  }, 5000);

  const pergunta = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!pergunta) {
    return message.reply(
      "meow...? você me chamou? 💕"
    );
  }

  const memoriaId = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
  const historico = pegarMemoria(memoriaId);

  historico.push({
    role: "user",
    content: pergunta
  });

  if (historico.length > 10) {
    historico.shift();
  }

  try {
    await message.channel.sendTyping();

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: personalidade
        },
        ...historico
      ],
      temperature: 1,
      max_tokens: 180
    });

    const resposta =
      response.choices?.[0]?.message?.content ||
      "mrrp... minha cabecinha bugou 😿";

    historico.push({
      role: "assistant",
      content: resposta
    });

    if (historico.length > 10) {
      historico.shift();
    }

    return message.reply(resposta.slice(0, 1900));
  } catch (error) {
    console.error("Erro na IA:", error);

    return message.reply(
      "grr... minha cabecinha travou agora 😿"
    );
  }
});

registrarComandos();
client.login(TOKEN);
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ActivityType
} = require("discord.js");

const Groq = require("groq-sdk");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const OWNER_USERNAME = "vodka.idk";

const groq = new Groq({
  apiKey: GROQ_API_KEY
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memoria = new Map();
const cooldown = new Set();

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

const statusList = [
  "meow ♡ queria morar nesse silêncio confortável",
  "☁️ às vezes noites calmas dizem mais que palavras",
  "meow ♡ snowfall tocando baixinho no fundo",
  "🌙 eu gosto quando o mundo desacelera um pouco",
  "🫧 perdida em pensamentos tranquilos",
  "meow ♡ queria que momentos suaves durassem mais",
  "☕ noites frias e músicas lentas combinam comigo",
  "🌧️ ouvindo a chuva como se fosse música",
  "💭 acho bonito quando tudo fica quietinho",
  "🌙 hoje o céu parece confortável",
  "🎀 meow ♡ você também sente essa calma?",
  "💭 o silêncio pode ser aconchegante às vezes",
  "🌌 noites frias combinam com pensamentos gentis"
];

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

client.once("clientReady", () => {
  console.log(`Cappie online como ${client.user.tag}`);

  let index = 0;

  function atualizarStatus() {
    const frase = statusList[index];

    client.user.setPresence({
      activities: [
        index % 3 === 0
          ? {
              name: "Øneheart - snowfall",
              type: ActivityType.Listening
            }
          : {
              name: frase,
              type: ActivityType.Custom
            }
      ],
      status: "idle"
    });

    index++;

    if (index >= statusList.length) {
      index = 0;
    }
  }

  atualizarStatus();

  setInterval(atualizarStatus, 60000);
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

  if (cooldown.has(message.author.id)) {
    return message.reply(
      "Calminhaaa, espera uns segundinhos antes de falar comigo de novo 😿"
    );
  }

  cooldown.add(message.author.id);

  setTimeout(() => {
    cooldown.delete(message.author.id);
  }, 5000);

  const pergunta = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!pergunta) {
    return message.reply(
      "Oii~ você me chamou? Eu sou a Cappie 💕"
    );
  }

  const memoriaId = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
  const historico = pegarMemoria(memoriaId);

  historico.push({
    role: "user",
    content: pergunta
  });

  if (historico.length > 10) {
    historico.shift();
  }

  try {
    await message.channel.sendTyping();

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: personalidade
        },
        ...historico
      ],
      temperature: 0.9,
      max_tokens: 700
    });

    const resposta =
      response.choices?.[0]?.message?.content ||
      "Hmm... minha cabecinha bugou um pouquinho 😿";

    historico.push({
      role: "assistant",
      content: resposta
    });

    if (historico.length > 10) {
      historico.shift();
    }

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
