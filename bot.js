const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('./db');

// Cliente do Discord
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// IDs dos cargos permitidos para bater ponto
const CARGOS_PERMITIDOS = ['1372769455406579730'];
const CANAL_NOTIFICACOES_ID = '1372769457201610783';

// Comandos de barra
const commands = [
  new SlashCommandBuilder().setName('painel').setDescription('Envia o painel para bater ponto').toJSON(),
  new SlashCommandBuilder().setName('ranking').setDescription('Mostra o ranking de horas batidas').toJSON(),
  new SlashCommandBuilder().setName('relatorio_geral').setDescription('Mostra o relatório completo de todos os usuários').toJSON(),
];

// Registro dos comandos
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Comandos registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();

// Arquivo de dados
const caminhoDados = path.join(__dirname, 'pontos.json');
let pontos = fs.existsSync(caminhoDados) ? JSON.parse(fs.readFileSync(caminhoDados)) : {};

function salvarDados() {
  fs.writeFileSync(caminhoDados, JSON.stringify(pontos, null, 2));
}

// Monitoramento de usuários mutados
const timersMutados = {};
const CATEGORIA_MONITORADA = '1372769457621172314';

client.on('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} está online!`);
});

client.on('interactionCreate', async (interaction) => {
  const userId = interaction.user.id;
  const membro = interaction.guild.members.cache.get(userId);
  const canal = interaction.guild.channels.cache.get(CANAL_NOTIFICACOES_ID);

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'relatorio_geral') {
      if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: 'Apenas o dono do servidor pode usar este comando.', ephemeral: true });
      }

      const agora = new Date();
      const hoje = agora.toISOString().slice(0, 10);
      const inicioSemana = new Date(agora);
      inicioSemana.setDate(agora.getDate() - agora.getDay());
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      let relatorio = '';
      for (const uid in pontos) {
        const user = await client.users.fetch(uid).catch(() => null);
        if (!user) continue;

        const registros = pontos[uid].registros || [];
        let hojeMs = 0, semanaMs = 0, mesMs = 0;

        for (const r of registros) {
          if (!r.entrada || !r.saida) continue;
          const entrada = new Date(r.entrada);
          const saida = new Date(r.saida);
          const tempo = saida - entrada;

          if (r.entrada.startsWith(hoje)) hojeMs += tempo;
          if (entrada >= inicioSemana) semanaMs += tempo;
          if (entrada >= inicioMes) mesMs += tempo;
        }

        const formatar = ms => `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
        relatorio += `👤 **${user.tag}**\nHoje: ${formatar(hojeMs)} | Semana: ${formatar(semanaMs)} | Mês: ${formatar(mesMs)} | Total: ${formatar(pontos[uid].acumuladoMs || 0)}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Relatório Geral de Todos os Usuários')
        .setColor(0x2ecc71)
        .setDescription(relatorio || 'Nenhum dado disponível.');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
      return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
    }

 if (interaction.commandName === 'painel') {
const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('entrada').setLabel('Abrir').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('saida').setLabel('Fechar').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('horas').setLabel('Horas').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('comandos').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
);


  return interaction.reply({
    content: `🔹 **Para abrir um ponto você precisa estar em uma call da categoria \`🔸・ᴘᴀᴛʀᴜʟʜᴀᴍᴇɴᴛᴏ\` e clicar em ABRIR.**

⚠️ Caso aconteça um imprevisto, pode ficar despreocupado que o nosso sistema de bate-ponto irá lhe desconectar automaticamente!

🔹 Após estar com o ponto aberto e quiser parar a patrulha, clique em FECHAR ou saia da call, que em dois minutos ele fechará automaticamente.

🔹 Para consultar suas horas, clique em HORAS.`,
    components: [row],
    ephemeral: false
  });
}

if (interaction.commandName === 'ranking') {
  const ranking = Object.entries(pontos)
    .filter(([_, d]) => d.acumuladoMs > 0)
    .sort((a, b) => b[1].acumuladoMs - a[1].acumuladoMs);

  if (ranking.length === 0)
    return interaction.reply({ content: 'Ninguém bateu ponto ainda.', ephemeral: true });

  const embed = new EmbedBuilder().setTitle('🏆 Ranking de Horas Batidas').setColor(0x00AE86);
  let desc = '';
  for (let i = 0; i < Math.min(ranking.length, 10); i++) {
    const [uid, data] = ranking[i];
    const horas = Math.floor(data.acumuladoMs / 3600000);
    const minutos = Math.floor((data.acumuladoMs % 3600000) / 60000);
    desc += `**${i + 1}** - <@${uid}>: ${horas}h ${minutos}m\n`;
  }
  embed.setDescription(desc);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

  }

  if (interaction.isButton()) {
    if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
      return interaction.reply({ content: '❌ Você não tem permissão para bater ponto.', ephemeral: true });
    }

    if (!pontos[userId]) pontos[userId] = { entrada: null, acumuladoMs: 0, registros: [] };

    if (interaction.customId === 'entrada') {
      if (pontos[userId].entrada) {
        return interaction.reply({ content: 'Você já bateu entrada!', ephemeral: true });
      }
      pontos[userId].entrada = new Date().toISOString();
      salvarDados();
      if (canal) canal.send(`📥 <@${userId}> bateu ponto de entrada às ${new Date(pontos[userId].entrada).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      return interaction.reply({ content: `Entrada registrada às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, ephemeral: true });
    }

   if (interaction.customId === 'saida') {
  if (!pontos[userId].entrada) {
    return interaction.reply({ content: 'Você precisa bater entrada antes!', ephemeral: true });
  }

  const agora = new Date();
  const entradaDate = new Date(pontos[userId].entrada);
  const tempo = agora - entradaDate;
  pontos[userId].acumuladoMs += tempo;
  pontos[userId].registros.push({ entrada: pontos[userId].entrada, saida: agora.toISOString() });
  pontos[userId].entrada = null;
  salvarDados();

  const horas = Math.floor(tempo / 3600000);
  const minutos = Math.floor((tempo % 3600000) / 60000);

  if (canal) {
    canal.send(`📤 <@${userId}> bateu ponto de saída às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Trabalhou ${horas}h ${minutos}m.`);
  }

  return interaction.reply({ content: `Saída registrada! Você trabalhou ${horas}h ${minutos}m.`, ephemeral: true });
}

if (interaction.customId === 'horas') {
  const total = pontos[userId]?.acumuladoMs || 0;
  const horas = Math.floor(total / 3600000);
  const minutos = Math.floor((total % 3600000) / 60000);

  return interaction.reply({
    content: `⏱️ Você acumulou **${horas}h ${minutos}m** em pontos registrados.`,
    ephemeral: true
  });
}

}

      const agora = new Date();
      const entradaDate = new Date(pontos[userId].entrada);
      const tempo = agora - entradaDate;
      pontos[userId].acumuladoMs += tempo;
      pontos[userId].registros.push({ entrada: pontos[userId].entrada, saida: agora.toISOString() });
      pontos[userId].entrada = null;
      salvarDados();

      const horas = Math.floor(tempo / 3600000);
      const minutos = Math.floor((tempo % 3600000) / 60000);

      if (canal) {
        canal.send(`📤 <@${userId}> bateu ponto de saída às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Trabalhou ${horas}h ${minutos}m.`);
      }

      return interaction.reply({ content: `Saída registrada! Você trabalhou ${horas}h ${minutos}m.`, ephemeral: true });
    }

    if (interaction.customId === 'comandos') {
      const embed = new EmbedBuilder()
        .setTitle('📖 Comandos Disponíveis')
        .setColor(0x3498db)
        .setDescription(`
**/painel** – Envia os botões para bater ponto.
**/ranking** – Exibe o ranking dos usuários com mais horas.
**/relatorio_geral** – Mostra o relatório completo de todos os usuários (somente para o dono do servidor).
⚙️ Use os botões do painel para **registrar entrada e saída**.
⏰ Saída automática após 5 minutos mutado e surdo na call.
        `);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
});

async function baterSaidaAutomatica(userId) {
  if (!pontos[userId] || !pontos[userId].entrada) return;

  const agora = new Date();
  const entradaDate = new Date(pontos[userId].entrada);
  const tempo = agora - entradaDate;
  pontos[userId].acumuladoMs += tempo;

  if (!pontos[userId].registros) pontos[userId].registros = [];
  pontos[userId].registros.push({ entrada: pontos[userId].entrada, saida: agora.toISOString() });
  pontos[userId].entrada = null;
  salvarDados();

  const user = await client.users.fetch(userId).catch(() => null);
  const guild = client.guilds.cache.first();
  const canal = guild?.channels.cache.get(CANAL_NOTIFICACOES_ID);

  if (user && canal) {
    canal.send(`⏰ <@${userId}> teve saída automática registrada após inatividade.`);
  }
}

// Monitorar estado dos usuários
// Monitorar estado dos usuários
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;

  // Se o usuário saiu da call
  if (!newState.channel) {
    if (pontos[userId]?.entrada) {
      setTimeout(() => baterSaidaAutomatica(userId), 2 * 60 * 1000); // 2 minutos após sair da call
    }
    clearTimeout(timersMutados[userId]);
    delete timersMutados[userId];
    return;
  }

  // Checar se a call está na categoria monitorada
  if (newState.channel?.parentId !== CATEGORIA_MONITORADA) return;

  const estaMutado = newState.selfMute || newState.mute;
  const estaSurdo = newState.selfDeaf || newState.deaf;

  if (estaMutado && estaSurdo) {
    if (!timersMutados[userId]) {
      timersMutados[userId] = setTimeout(() => {
        baterSaidaAutomatica(userId);
        delete timersMutados[userId];
      }, 5 * 60 * 1000); // 5 minutos
    }
  } else {
    clearTimeout(timersMutados[userId]);
    delete timersMutados[userId];
  }
});


client.login(process.env.TOKEN);
