const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const TOKEN = process.env.TOKEN || 'SEU_TOKEN_AQUI';
const LOG_CHANNEL_ID = '1372769457201610783'; // Substitua pelo ID do canal de log
const CARGO_PERMITIDO_ID = '1372769455406579730'; // Cargo permitido a usar o bot
const pontosPath = path.join(__dirname, 'pontos.json');

let pontos = fs.existsSync(pontosPath)
  ? JSON.parse(fs.readFileSync(pontosPath, 'utf8'))
  : {};

function salvarPontos() {
  fs.writeFileSync(pontosPath, JSON.stringify(pontos, null, 2));
}

client.once('ready', () => {
  console.log(`Bot está online como ${client.user.tag}`);
  setInterval(verificarInatividade, 60 * 1000); // Verifica a cada minuto
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const username = interaction.user.username;

  const member = await interaction.guild.members.fetch(userId);
  if (!member.roles.cache.has(CARGO_PERMITIDO_ID)) {
    return interaction.reply({
      content: '🚫 Você não tem permissão para usar o sistema de ponto.',
      ephemeral: true
    });
  }

  if (!pontos[userId]) {
    pontos[userId] = { entrada: null, saida: null };
  }

  const agora = new Date();

  if (interaction.customId === 'bater_ponto') {
    if (pontos[userId].entrada && !pontos[userId].saida) {
      return interaction.reply({
        content: 'Você já bateu o ponto de entrada. Para registrar a saída, clique em "Fechar Ponto".',
        flags: 64,
      });
    }

    pontos[userId].entrada = agora.toISOString();
    pontos[userId].saida = null;
    salvarPontos();

    interaction.reply({
      content: `Entrada registrada às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      flags: 64,
    });

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.type === ChannelType.GuildText) {
      logChannel.send(`✅ ${interaction.user.tag} bateu ponto às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    }

  } else if (interaction.customId === 'fechar_ponto') {
    if (!pontos[userId].entrada || pontos[userId].saida) {
      return interaction.reply({
        content: 'Você ainda não bateu o ponto de entrada ou já registrou a saída.',
        flags: 64,
      });
    }

    pontos[userId].saida = agora.toISOString();

    const entrada = new Date(pontos[userId].entrada);
    const diferenca = agora - entrada;
    const horas = Math.floor(diferenca / 1000 / 60 / 60);
    const minutos = Math.floor((diferenca / 1000 / 60) % 60);

    salvarPontos();

    interaction.reply({
      content: `Saída registrada! Você trabalhou ${horas}h ${minutos}m.`,
      flags: 64,
    });

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.type === ChannelType.GuildText) {
      logChannel.send(`🔴 ${interaction.user.tag} fechou ponto às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Trabalhou ${horas}h ${minutos}m.`);
    }
  }
});

client.on('ready', () => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bater_ponto')
      .setLabel('Bater Ponto')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('fechar_ponto')
      .setLabel('Fechar Ponto')
      .setStyle(ButtonStyle.Danger)
  );

  const canalId = 'ID_DO_CANAL_ONDE_FICAM_OS_BOTOES';
  const canal = client.channels.cache.get(canalId);
  if (canal && canal.type === ChannelType.GuildText) {
    canal.send({ content: 'Clique em um botão para bater ou fechar o ponto:', components: [row] });
  }
});

function verificarInatividade() {
  for (const userId in pontos) {
    const ponto = pontos[userId];
    if (ponto.entrada && !ponto.saida) {
      const entrada = new Date(ponto.entrada);
      const agora = new Date();
      const tempoDecorrido = agora - entrada;
      if (tempoDecorrido > 1000 * 60 * 60 * 12) { // 12 horas
        ponto.saida = agora.toISOString();
        const horas = Math.floor(tempoDecorrido / 1000 / 60 / 60);
        const minutos = Math.floor((tempoDecorrido / 1000 / 60) % 60);
        salvarPontos();

        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel && logChannel.type === ChannelType.GuildText) {
          logChannel.send(`⚠️ ${userId} foi desconectado automaticamente. Tempo de trabalho: ${horas}h ${minutos}m.`);
        }
      }
    }
  }
}

client.login(TOKEN);
