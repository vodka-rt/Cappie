require("dotenv").config();

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
const mongoose = require("mongoose");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

const OWNER_USERNAME = "vodka.idk";

const groq = new Groq({ apiKey: GROQ_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  nekocoins: { type: Number, default: 0 },
  lastDaily: { type: Number, default: 0 }
});

const EconomyUser = mongoose.model("EconomyUser", userSchema);

async function getUser(userId) {
  let user = await EconomyUser.findOne({ userId });

  if (!user) {
    user = await EconomyUser.create({
      userId,
      nekocoins: 0,
      lastDaily: 0
    });
  }

  return user;
}

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

Você pode usar palavras como "meow", "mrrp", "miau", "grr", "hmph" e "nya",
mas apenas ocasionalmente.

Você NÃO usa essas palavras em toda mensagem.
Você usa emojis raramente e de forma natural.
Você evita exagerar nos emojis ou nas expressões fofinhas.

Você conversa como uma gatinha calma e carinhosa.
Você não fala como IA.
Você não explica demais.
Você não escreve textos enormes.

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
      option.setName("usuario").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Mostra o banner de um usuário")
    .addUserOption(option =>
      option.setName("usuario").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Faz a Cappie falar uma mensagem")
    .addStringOption(option =>
      option.setName("mensagem").setDescription("Mensagem").setRequired(true)
    )
    .addChannelOption(option =>
      option.setName("canal").setDescription("Canal").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("carteira")
    .setDescription("Mostra quantos nekocoins você tem")
    .addUserOption(option =>
      option.setName("usuario").setDescription("Usuário").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("apostar")
    .setDescription("Aposte seus nekocoins")
    .addStringOption(option =>
      option
        .setName("tipo")
        .setDescription("Tipo de aposta")
        .setRequired(true)
        .addChoices(
          { name: "cara", value: "cara" },
          { name: "coroa", value: "coroa" },
          { name: "dado", value: "dado" },
          { name: "slots", value: "slots" }
        )
    )
    .addIntegerOption(option =>
      option
        .setName("valor")
        .setDescription("Valor da aposta")
        .setRequired(true)
        .setMinValue(100)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
  try {
    console.log("Registrando comandos globais...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: comandos });
    console.log("Comandos globais registrados!");
  } catch (error) {
    console.error("Erro ao registrar comandos:", error);
  }
}

client.once("clientReady", async () => {
  console.log(`Cappie online como ${client.user.tag}`);

  let index = 0;

  function atualizarStatus() {
    client.user.setActivity(statusList[index], {
      type: ActivityType.Custom
    });

    index++;
    if (index >= statusList.length) index = 0;
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
    const canal = interaction.options.getChannel("canal") || interaction.channel;

    const isAdmin = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    const isOwner =
      interaction.user.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

    if (!isAdmin && !isOwner) {
      return interaction.reply({
        content: "grr... você não pode usar isso.",
        ephemeral: true
      });
    }

    await canal.send(mensagem);

    return interaction.reply({
      content: "Mensagem enviada pela Cappie.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "carteira") {
    const target = interaction.options.getUser("usuario") || interaction.user;
    const user = await getUser(target.id);

    const embed = new EmbedBuilder()
      .setTitle(`Carteira de ${target.username}`)
      .setDescription(`🐾 **${user.nekocoins.toLocaleString("pt-BR")} nekocoins**`)
      .setColor("#ffb6d9");

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "apostar") {
    const tipo = interaction.options.getString("tipo");
    const valor = interaction.options.getInteger("valor");
    const user = await getUser(interaction.user.id);

    if (valor <= 0) {
      return interaction.reply({
        content: "Escolhe um valor válido.",
        ephemeral: true
      });
    }

    if (user.nekocoins < valor) {
      return interaction.reply({
        content: "Você não tem nekocoins suficientes.",
        ephemeral: true
      });
    }

    let ganhou = false;
    let premio = 0;
    let texto = "";

    if (tipo === "cara" || tipo === "coroa") {
      const resultado = Math.random() < 0.5 ? "cara" : "coroa";
      ganhou = resultado === tipo;
      premio = valor;

      texto = ganhou
        ? `Deu **${resultado}**. Você ganhou **${premio.toLocaleString("pt-BR")} nekocoins**.`
        : `Deu **${resultado}**. Você perdeu **${valor.toLocaleString("pt-BR")} nekocoins**.`;
    }

    if (tipo === "dado") {
      const dado = Math.floor(Math.random() * 6) + 1;
      ganhou = dado >= 4;
      premio = valor;

      texto = ganhou
        ? `O dado caiu em **${dado}**. Você ganhou **${premio.toLocaleString("pt-BR")} nekocoins**.`
        : `O dado caiu em **${dado}**. Você perdeu **${valor.toLocaleString("pt-BR")} nekocoins**.`;
    }

    if (tipo === "slots") {
      const icons = ["🍒", "🍋", "🔔", "⭐", "🐾"];
      const slot = [
        icons[Math.floor(Math.random() * icons.length)],
        icons[Math.floor(Math.random() * icons.length)],
        icons[Math.floor(Math.random() * icons.length)]
      ];

      const iguais = slot[0] === slot[1] && slot[1] === slot[2];
      const doisIguais =
        slot[0] === slot[1] || slot[0] === slot[2] || slot[1] === slot[2];

      if (iguais) {
        ganhou = true;
        premio = valor * 4;
      } else if (doisIguais) {
        ganhou = true;
        premio = Math.floor(valor * 1.5);
      } else {
        ganhou = false;
      }

      texto = ganhou
        ? `${slot.join(" | ")}\nVocê ganhou **${premio.toLocaleString("pt-BR")} nekocoins**.`
        : `${slot.join(" | ")}\nVocê perdeu **${valor.toLocaleString("pt-BR")} nekocoins**.`;
    }

    if (ganhou) {
      user.nekocoins += premio;
    } else {
      user.nekocoins -= valor;
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle("Aposta")
      .setDescription(`${texto}\n\nSaldo: **${user.nekocoins.toLocaleString("pt-BR")} nekocoins**`)
      .setColor(ganhou ? "#a8ffb0" : "#ff9aa8");

    return interaction.reply({ embeds: [embed] });
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === "?daily") {
    const user = await getUser(message.author.id);

    const agora = Date.now();
    const cooldownDaily = 24 * 60 * 60 * 1000;
    const tempoRestante = cooldownDaily - (agora - user.lastDaily);

    if (tempoRestante > 0) {
      const horas = Math.floor(tempoRestante / 1000 / 60 / 60);
      const minutos = Math.floor((tempoRestante / 1000 / 60) % 60);

      return message.reply(
        `Você já pegou seu daily. Volte em **${horas}h ${minutos}m**.`
      );
    }

    const ganho = Math.floor(Math.random() * 1001) + 1000;

    user.nekocoins += ganho;
    user.lastDaily = agora;
    await user.save();

    return message.reply(
      `Você recebeu **${ganho.toLocaleString("pt-BR")} nekocoins** no daily.`
    );
  }

  if (!message.mentions.has(client.user)) return;

  if (cooldown.has(message.author.id)) {
    return message.reply("espera um pouquinho antes de falar comigo de novo.");
  }

  cooldown.add(message.author.id);
  setTimeout(() => cooldown.delete(message.author.id), 5000);

  const pergunta = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!pergunta) {
    return message.reply("você me chamou?");
  }

  const memoriaId = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
  const historico = pegarMemoria(memoriaId);

  historico.push({
    role: "user",
    content: pergunta
  });

  if (historico.length > 10) historico.shift();

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
      "minha cabecinha bugou um pouco.";

    historico.push({
      role: "assistant",
      content: resposta
    });

    if (historico.length > 10) historico.shift();

    return message.reply(resposta.slice(0, 1900));
  } catch (error) {
    console.error("Erro na IA:", error);
    return message.reply("minha cabecinha travou agora.");
  }
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB conectado!");

    await registrarComandos();
    await client.login(TOKEN);
  } catch (error) {
    console.error("Erro ao iniciar:", error);
  }
}

start();
