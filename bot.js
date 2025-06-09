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
require('dotenv').config();

const db = require('./db'); // Aqui seu módulo adaptado para PostgreSQL

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// Configurações
const CARGOS_PERMITIDOS = ['1372769455406579730'];
const CARGO_RELATORIO_ID = '1372769455393734656'; // Cargo que pode ver relatorio geral
const CANAL_NOTIFICACOES_ID = '1372769457201610783';
const CATEGORIA_MONITORADA = '1372769457621172314';

// Comandos
const commands = [
  new SlashCommandBuilder().setName('painel').setDescription('Envia o painel para bater ponto').toJSON(),
  new SlashCommandBuilder().setName('ranking').setDescription('Mostra o ranking de horas batidas').toJSON(),
  new SlashCommandBuilder().setName('relatorio_geral').setDescription('Mostra o relatório completo de todos os usuários').toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Comandos registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();

// Dados em memória carregados do banco PostgreSQL
let pontos = {};

(async () => {
  pontos = await db.getPontos();
})();

async function salvarDados() {
  await db.salvarPontos(pontos);
}

// Temporizadores para monitorar mutados na call
const timersMutados = {};

// Eventos do Discord
client.on('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} está online!`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.inGuild()) return;

  const userId = interaction.user.id;
  const membro = interaction.guild.members.cache.get(userId);
  const canal = interaction.guild.channels.cache.get(CANAL_NOTIFICACOES_ID);

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'relatorio_geral') {
      if (!membro.roles.cache.has(CARGO_RELATORIO_ID)) {
        return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
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

    // Verifica se o usuário tem cargos permitidos
    if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
      return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
    }

   if (interaction.commandName === 'painel') {
        const embed = new EmbedBuilder()
            .setTitle(' BATE-PONTO - ROTA ')
            .setDescription(
                `⭐ Para abrir um ponto você precisa estar em uma call da categoria \`🔸・ᴘᴀᴛʀᴜʟʜᴀᴍᴇɴᴛᴏ\` e clicar em **ABRIR**.\n\n` +
                `⚠️ Caso aconteça um imprevisto, pode ficar despreocupado que o nosso sistema de bate-ponto irá lhe desconectar automaticamente!\n\n` +
                `✅ Após estar com o ponto aberto e quiser parar a patrulha, clique em **FECHAR** ou **saia da call**, que em dois minutos ele fechará automaticamente.\n\n` +
                `📊 Para consultar suas horas, clique em **HORAS**.`
            )

            .setColor('#000000')
            .setThumbnail('https://i.imgur.com/mcJJ0cG.png') // Substitua pelo seu logo real
            .setFooter({ text: 'Atenciosamente, ROTA ' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('entrada').setLabel('ABRIR').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('saida').setLabel('FECHAR').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('horas').setLabel('HORAS').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('comandos').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [embed],
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
  const voiceChannel = membro.voice.channel;

  if (!voiceChannel || voiceChannel.parentId !== CATEGORIA_MONITORADA) {
    return interaction.reply({
      content: '❌ Você precisa estar em uma call da categoria permitida para bater ponto!',
      ephemeral: true
    });
  }

  if (pontos[userId].entrada) {
    return interaction.reply({ content: 'Você já bateu entrada!', ephemeral: true });
  }

      pontos[userId].entrada = new Date().toISOString();
      await salvarDados();

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
      await salvarDados();

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
      return interaction.reply({ content: `Você acumulou ${horas}h ${minutos}m até agora.`, ephemeral: true });
    }

    if (interaction.customId === 'comandos') {
      return interaction.reply({
        content: `🔹 **COMANDOS DISPONÍVEIS**

/painel - Abre o painel de bate-ponto
/ranking - Mostra o ranking de horas
/relatorio_geral - Relatório completo (somente cargo específico)`,
        ephemeral: true
      });
    }
  }
});

// Monitoramento de usuários mutados na categoria monitorada

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.channelId && (!newState.channelId || newState.channelId !== oldState.channelId)) {
    if (oldState.channel?.parentId === CATEGORIA_MONITORADA) {
      clearTimeout(timersMutados[oldState.member.id]);
      delete timersMutados[oldState.member.id];

      const userId = oldState.member.id;
      const horarioSaida = new Date();

      const jsonData = {
        saida: horarioSaida.toISOString()
      };

      try {
        await pool.query(
          'INSERT INTO pontos (user_id, data) VALUES ($1, $2)',
          [userId, jsonData]
        );
        console.log(`✅ Saída registrada para ${userId} às ${horarioSaida.toLocaleTimeString('pt-BR')}`);
      } catch (err) {
        console.error('❌ Erro ao salvar ponto de saída:', err);
      }
    }
  }
  // resto do seu código continua...
});



client.login(process.env.TOKEN);
