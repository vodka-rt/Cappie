require("dotenv").config();

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} = require("discord.js");

const Groq = require("groq-sdk");
const mongoose = require("mongoose");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

const OWNER_USERNAME = "vodka.idk";

const app = express();

app.get("/", (req, res) => {
  res.send("Cappie está online.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor web fake rodando na porta ${PORT}`);
});

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

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  nekocoins: { type: Number, default: 0 },
  lastDaily: { type: Number, default: 0 }
});

const EconomyUser = mongoose.model("EconomyUser", userSchema);

async function getUser(userId) {
  return await EconomyUser.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        nekocoins: 0,
        lastDaily: 0
      }
    },
    {
      new: true,
      upsert: true
    }
  );
}

const memoria = new Map();
const cooldown = new Set();

function pegarMemoria(id) {
  if (!memoria.has(id)) memoria.set(id, []);
  return memoria.get(id);
}

function formatarCoins(valor) {
  return valor.toLocaleString("pt-BR");
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
    .setName("pay")
    .setDescription("Enviar nekocoins para outro usuário")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que vai receber")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("valor")
        .setDescription("Valor enviado")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("apostar")
    .setDescription("Aposte nekocoins")
    .addStringOption(option =>
      option
        .setName("tipo")
        .setDescription("Tipo da aposta")
        .setRequired(true)
        .addChoices(
          { name: "Cara ou Coroa", value: "coinflip" },
          { name: "Número", value: "numero" },
          { name: "Corrida de Cavalo", value: "cavalo" }
        )
    )
    .addIntegerOption(option =>
      option
        .setName("valor")
        .setDescription("Valor da aposta")
        .setRequired(true)
        .setMinValue(100)
    )
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Participante 2")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("usuario2")
        .setDescription("Participante 3")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("usuario3")
        .setDescription("Participante 4")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("usuario4")
        .setDescription("Participante 5")
        .setRequired(false)
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

client.once("clientReady", () => {
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

async function cobrarParticipantes(participantes, valor) {
  for (const user of participantes) {
    const db = await getUser(user.id);

    if (db.nekocoins < valor) {
      return {
        ok: false,
        user
      };
    }
  }

  for (const user of participantes) {
    const db = await getUser(user.id);
    db.nekocoins -= valor;
    await db.save();
  }

  return {
    ok: true
  };
}

async function pagarVencedores(vencedores, pote) {
  const premio = Math.floor(pote / vencedores.length);

  for (const user of vencedores) {
    const db = await getUser(user.id);
    db.nekocoins += premio;
    await db.save();
  }

  return premio;
}

function gerarMenuNumeros(customId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder("Escolha um número de 1 a 10")
      .addOptions(
        ...Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1}`,
          value: `${i + 1}`
        }))
      )
  );
}

function gerarMenuCavalos(customId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder("Escolha seu cavalo")
      .addOptions(
        { label: "Cavalo 1", value: "1", emoji: "🐴" },
        { label: "Cavalo 2", value: "2", emoji: "🐎" },
        { label: "Cavalo 3", value: "3", emoji: "🏇" },
        { label: "Cavalo 4", value: "4", emoji: "🐴" },
        { label: "Cavalo 5", value: "5", emoji: "🐎" }
      )
  );
}

async function coletarAceites(interaction, msg, criador, convidados, tipo, valor) {
  const aceitos = [criador];
  const recusados = [];

  if (convidados.length === 0) {
    return aceitos;
  }

  const rowAceitar = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("aceitar_aposta")
      .setLabel("Aceitar")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("recusar_aposta")
      .setLabel("Recusar")
      .setStyle(ButtonStyle.Danger)
  );

  const embedConvite = new EmbedBuilder()
    .setTitle("Aposta criada")
    .setDescription(
      `${criador} criou uma aposta de **${tipo}** valendo **${formatarCoins(valor)} nekocoins**.\n\n` +
      `Convidados:\n${convidados.map(u => `• ${u}`).join("\n")}\n\n` +
      `Vocês têm 60 segundos para aceitar.`
    )
    .setColor("#ffb6d9");

  await interaction.editReply({
    embeds: [embedConvite],
    components: [rowAceitar]
  });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000,
    filter: i => convidados.some(u => u.id === i.user.id)
  });

  collector.on("collect", async i => {
    if (i.customId === "aceitar_aposta") {
      if (!aceitos.some(u => u.id === i.user.id)) {
        aceitos.push(i.user);
      }

      await i.reply({
        content: "Você entrou na aposta.",
        ephemeral: true
      });
    }

    if (i.customId === "recusar_aposta") {
      if (!recusados.some(u => u.id === i.user.id)) {
        recusados.push(i.user);
      }

      await i.reply({
        content: "Você recusou a aposta.",
        ephemeral: true
      });
    }

    const pendentes = convidados.filter(
      u =>
        !aceitos.some(a => a.id === u.id) &&
        !recusados.some(r => r.id === u.id)
    );

    const embedAtualizado = new EmbedBuilder()
      .setTitle("Aposta criada")
      .setDescription(
        `${criador} criou uma aposta de **${tipo}** valendo **${formatarCoins(valor)} nekocoins**.\n\n` +
        `Aceitaram:\n${aceitos.map(u => `• ${u}`).join("\n")}\n\n` +
        `Pendentes:\n${pendentes.length ? pendentes.map(u => `• ${u}`).join("\n") : "ninguém"}`
      )
      .setColor("#ffb6d9");

    await interaction.editReply({
      embeds: [embedAtualizado],
      components: [rowAceitar]
    });
  });

  await new Promise(resolve => {
    collector.on("end", resolve);
  });

  await interaction.editReply({
    components: []
  });

  return aceitos;
}

async function apostaNumero(interaction, msg, participantes, valor) {
  const escolhas = new Map();

  for (const participante of participantes) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Aposta de número")
          .setDescription(`${participante}, escolha um número de **1 a 10**.`)
          .setColor("#ffb6d9")
      ],
      components: [gerarMenuNumeros(`numero_${participante.id}`)]
    });

    const escolha = await msg.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: i => i.user.id === participante.id
    });

    const numero = Number(escolha.values[0]);
    escolhas.set(participante.id, numero);

    await escolha.reply({
      content: `Você escolheu **${numero}**.`,
      ephemeral: true
    });
  }

  const cobranca = await cobrarParticipantes(participantes, valor);

  if (!cobranca.ok) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Aposta cancelada")
          .setDescription(`${cobranca.user} ficou sem saldo suficiente.`)
          .setColor("#ff9aa8")
      ],
      components: []
    });
  }

  const numeroSorteado = Math.floor(Math.random() * 10) + 1;
  const pote = valor * participantes.length;

  let menorDistancia = Infinity;

  for (const participante of participantes) {
    const numero = escolhas.get(participante.id);
    const distancia = Math.abs(numero - numeroSorteado);

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
    }
  }

  const vencedores = participantes.filter(participante => {
    const numero = escolhas.get(participante.id);
    return Math.abs(numero - numeroSorteado) === menorDistancia;
  });

  const premio = await pagarVencedores(vencedores, pote);

  const linhas = participantes
    .map(user => `${user}: **${escolhas.get(user.id)}**`)
    .join("\n");

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Resultado da aposta de número")
        .setDescription(
          `Número sorteado: **${numeroSorteado}**\n\n` +
          `${linhas}\n\n` +
          `Pote total: **${formatarCoins(pote)} nekocoins**\n` +
          `Vencedor(es): ${vencedores.map(u => `${u}`).join(", ")}\n` +
          `Prêmio por vencedor: **${formatarCoins(premio)} nekocoins**`
        )
        .setColor("#a8ffb0")
    ],
    components: []
  });
}

async function apostaCavalo(interaction, msg, participantes, valor) {
  const escolhas = new Map();

  for (const participante of participantes) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Corrida de Cavalos")
          .setDescription(`${participante}, escolha seu cavalo.`)
          .setColor("#ffb6d9")
      ],
      components: [gerarMenuCavalos(`cavalo_${participante.id}`)]
    });

    const escolha = await msg.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: i => i.user.id === participante.id
    });

    const cavalo = escolha.values[0];
    escolhas.set(participante.id, cavalo);

    await escolha.reply({
      content: `Você escolheu o cavalo **${cavalo}**.`,
      ephemeral: true
    });
  }

  const cobranca = await cobrarParticipantes(participantes, valor);

  if (!cobranca.ok) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Aposta cancelada")
          .setDescription(`${cobranca.user} ficou sem saldo suficiente.`)
          .setColor("#ff9aa8")
      ],
      components: []
    });
  }

  const cavaloVencedor = String(Math.floor(Math.random() * 5) + 1);
  const pote = valor * participantes.length;

  const vencedores = participantes.filter(
    user => escolhas.get(user.id) === cavaloVencedor
  );

  const linhas = participantes
    .map(user => `${user}: cavalo **${escolhas.get(user.id)}**`)
    .join("\n");

  if (vencedores.length === 0) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Corrida finalizada")
          .setDescription(
            `O cavalo vencedor foi o **${cavaloVencedor}**.\n\n` +
            `${linhas}\n\n` +
            `Ninguém acertou. Todos perderam **${formatarCoins(valor)} nekocoins**.`
          )
          .setColor("#ff9aa8")
      ],
      components: []
    });
  }

  const premio = await pagarVencedores(vencedores, pote);

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Resultado da corrida")
        .setDescription(
          `O cavalo vencedor foi o **${cavaloVencedor}**.\n\n` +
          `${linhas}\n\n` +
          `Pote total: **${formatarCoins(pote)} nekocoins**\n` +
          `Vencedor(es): ${vencedores.map(u => `${u}`).join(", ")}\n` +
          `Prêmio por vencedor: **${formatarCoins(premio)} nekocoins**`
        )
        .setColor("#a8ffb0")
    ],
    components: []
  });
}

async function apostaCoinflip(interaction, msg, participantes, valor) {
  if (participantes.length !== 2) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Aposta cancelada")
          .setDescription("Cara ou Coroa precisa ter exatamente 2 pessoas.")
          .setColor("#ff9aa8")
      ],
      components: []
    });
  }

  const [desafiante, desafiado] = participantes;

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("coinflip_lado")
      .setPlaceholder("Escolha seu lado")
      .addOptions(
        { label: "Cara", value: "cara", emoji: "🪙" },
        { label: "Coroa", value: "coroa", emoji: "👑" }
      )
  );

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Cara ou Coroa")
        .setDescription(`${desafiado}, escolha **cara** ou **coroa**.\n${desafiante} fica com o outro lado.`)
        .setColor("#ffb6d9")
    ],
    components: [menu]
  });

  const escolhaLado = await msg.awaitMessageComponent({
    componentType: ComponentType.StringSelect,
    time: 60000,
    filter: i => i.user.id === desafiado.id
  });

  const ladoDesafiado = escolhaLado.values[0];
  const ladoDesafiante = ladoDesafiado === "cara" ? "coroa" : "cara";

  await escolhaLado.reply({
    content: `Você escolheu **${ladoDesafiado}**.`,
    ephemeral: true
  });

  const cobranca = await cobrarParticipantes(participantes, valor);

  if (!cobranca.ok) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Aposta cancelada")
          .setDescription(`${cobranca.user} ficou sem saldo suficiente.`)
          .setColor("#ff9aa8")
      ],
      components: []
    });
  }

  const resultado = Math.random() < 0.5 ? "cara" : "coroa";
  const vencedor = resultado === ladoDesafiado ? desafiado : desafiante;
  const pote = valor * 2;

  await pagarVencedores([vencedor], pote);

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Resultado da aposta")
        .setDescription(
          `🪙 Caiu **${resultado}**.\n\n` +
          `${desafiado}: **${ladoDesafiado}**\n` +
          `${desafiante}: **${ladoDesafiante}**\n\n` +
          `Vencedor: ${vencedor}\n` +
          `Ganhou **${formatarCoins(pote)} nekocoins**.`
        )
        .setColor("#a8ffb0")
    ],
    components: []
  });
}

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
        content: "Esse usuário não tem bannerzinho.",
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
      .setDescription(`🐾 **${formatarCoins(user.nekocoins)} nekocoins**`)
      .setColor("#ffb6d9");

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "pay") {
    const target = interaction.options.getUser("usuario");
    const valor = interaction.options.getInteger("valor");

    if (target.bot || target.id === interaction.user.id) {
      return interaction.reply({
        content: "Transferência inválida.",
        ephemeral: true
      });
    }

    const sender = await getUser(interaction.user.id);
    const receiver = await getUser(target.id);

    if (sender.nekocoins < valor) {
      return interaction.reply({
        content: "Você não tem nekocoins suficientes.",
        ephemeral: true
      });
    }

    sender.nekocoins -= valor;
    receiver.nekocoins += valor;

    await sender.save();
    await receiver.save();

    const embed = new EmbedBuilder()
      .setTitle("Transferência enviada")
      .setDescription(`${interaction.user} enviou **${formatarCoins(valor)} nekocoins** para ${target}.`)
      .setColor("#ffb6d9");

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "apostar") {
    const tipo = interaction.options.getString("tipo");
    const valor = interaction.options.getInteger("valor");
    const criador = interaction.user;

    const convidadosRaw = [
      interaction.options.getUser("usuario"),
      interaction.options.getUser("usuario2"),
      interaction.options.getUser("usuario3"),
      interaction.options.getUser("usuario4")
    ].filter(Boolean);

    const participantesMap = new Map();

    participantesMap.set(criador.id, criador);

    for (const user of convidadosRaw) {
      if (!user.bot && user.id !== criador.id) {
        participantesMap.set(user.id, user);
      }
    }

    const convidados = [...participantesMap.values()].filter(
      user => user.id !== criador.id
    );

    if (tipo === "coinflip" && convidados.length !== 1) {
      return interaction.reply({
        content: "Cara ou Coroa precisa ter exatamente 2 pessoas: você e mais 1 usuário.",
        ephemeral: true
      });
    }

if ((tipo === "numero" || tipo === "cavalo") && participantesMap.size < 2) {
  return interaction.reply({
    content: "Você precisa de pelo menos 2 jogadores para apostar.",
    ephemeral: true
  });
}
    const nomes = {
      coinflip: "Cara ou Coroa",
      numero: "Número",
      cavalo: "Corrida de Cavalo"
    };

    const msg = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Preparando aposta")
          .setDescription("Só um momentinho...")
          .setColor("#ffb6d9")
      ],
      fetchReply: true
    });

    try {
      const aceitos = await coletarAceites(
        interaction,
        msg,
        criador,
        convidados,
        nomes[tipo],
        valor
      );

      if (tipo === "coinflip") {
        return await apostaCoinflip(interaction, msg, aceitos, valor);
      }

      if (tipo === "numero") {
        return await apostaNumero(interaction, msg, aceitos, valor);
      }

      if (tipo === "cavalo") {
        return await apostaCavalo(interaction, msg, aceitos, valor);
      }
    } catch (error) {
      console.error("Erro na aposta:", error);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Aposta cancelada")
            .setDescription("Demoraram demais para responder ou aconteceu um erro.")
            .setColor("#ff9aa8")
        ],
        components: []
      });
    }
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === "?daily") {
    const user = await getUser(message.author.id);

    const agora = Date.now();
    const cooldownDaily = 24 * 60 * 60 * 1000;

    const isOwner =
      message.author.username.toLowerCase() === OWNER_USERNAME.toLowerCase();

    if (!isOwner) {
      const tempoRestante = cooldownDaily - (agora - user.lastDaily);

      if (tempoRestante > 0) {
        const horas = Math.floor(tempoRestante / 1000 / 60 / 60);
        const minutos = Math.floor((tempoRestante / 1000 / 60) % 60);

        return message.reply(
          `Você já pegou seu daily. Volte em **${horas}h ${minutos}m**.`
        );
      }

      user.lastDaily = agora;
    }

    const ganho = Math.floor(Math.random() * 1001) + 1000;

    user.nekocoins += ganho;
    await user.save();

    return message.reply(
      `Você recebeu **${formatarCoins(ganho)} nekocoins**.`
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
