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

const db = require('./db'); // módulo adaptado para PostgreSQL
const { fecharPontoDoUsuario } = require('./db'); //  db.js

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
  pontos = await db.getTodosPontos();
  console.log('Pontos carregados em memória:', Object.keys(pontos).length, 'usuários');
})();

async function salvarDados(userId, tipo) {
  await db.salvarPontos(userId, tipo);
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
        return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      }

      const agora = new Date();
      const hoje = agora.toISOString().slice(0, 10);
      const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - agora.getDay());
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const formatar = ms => `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;

      let relatorio = '';
      for (const uid in pontos) {
        const user = await client.users.fetch(uid).catch(() => null);
        if (!user) continue;

        let hojeMs = 0, semanaMs = 0, mesMs = 0;
        const registros = pontos[uid].registros || [];

        for (const r of registros) {
          if (!r.entrada || !r.saida) continue;
          const entrada = new Date(r.entrada), saida = new Date(r.saida);
          const tempo = saida - entrada;
          if (tempo <= 0) continue;
          if (r.entrada.startsWith(hoje)) hojeMs += tempo;
          if (entrada >= inicioSemana) semanaMs += tempo;
          if (entrada >= inicioMes) mesMs += tempo;
        }

        const totalMs = pontos[uid].acumuladoMs || 0;
        relatorio += `👤 **${user.tag}**\nHoje: ${formatar(hojeMs)} | Semana: ${formatar(semanaMs)} | Mês: ${formatar(mesMs)} | Total: ${formatar(totalMs)}\n\n`;
      }

      if (!relatorio) relatorio = 'Nenhum dado disponível.';
      const embed = new EmbedBuilder().setTitle('📊 Relatório Geral').setColor(0x2ecc71).setDescription(relatorio);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
      return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
    }

    if (interaction.commandName === 'painel') {
      const embed = new EmbedBuilder()
        .setTitle('BATE-PONTO - ROTA')
        .setDescription(`⭐ Clique em **ABRIR** para começar.\n⚠️ Será desconectado automaticamente se sair da call.\n📊 Use **HORAS** para ver seu progresso.`)
        .setColor('#000000')
        .setThumbnail('https://i.imgur.com/mcJJ0cG.png')
        .setFooter({ text: 'Atenciosamente, ROTA' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('entrada').setLabel('ABRIR').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('saida').setLabel('FECHAR').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('horas').setLabel('HORAS').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('comandos').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    }

    if (interaction.commandName === 'ranking') {
      const ranking = Object.entries(pontos)
        .filter(([_, d]) => d.acumuladoMs > 0)
        .sort((a, b) => b[1].acumuladoMs - a[1].acumuladoMs);

      if (!ranking.length) return interaction.reply({ content: 'Ninguém bateu ponto ainda.', ephemeral: true });

      const embed = new EmbedBuilder().setTitle('🏆 Ranking').setColor(0x00AE86);
      embed.setDescription(ranking.slice(0, 10).map(([uid, data], i) =>
        `**${i + 1}** - <@${uid}>: ${Math.floor(data.acumuladoMs / 3600000)}h ${Math.floor((data.acumuladoMs % 3600000) / 60000)}m`
      ).join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
      return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
    }

    if (!pontos[userId]) pontos[userId] = { entrada: null, acumuladoMs: 0, registros: [] };

    if (interaction.customId === 'entrada') {
      const voiceChannel = membro.voice.channel;
      if (!voiceChannel || voiceChannel.parentId !== CATEGORIA_MONITORADA) {
        return interaction.reply({ content: '❌ Entre em uma call da categoria permitida!', ephemeral: true });
      }

      if (pontos[userId].entrada) {
        return interaction.reply({ content: 'Você já bateu entrada!', ephemeral: true });
      }

      pontos[userId].entrada = new Date().toISOString();
      await salvarDados(userId, 'entrada');

      canal?.send(`📥 <@${userId}> bateu ponto de entrada às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      return interaction.reply({ content: 'Entrada registrada!', ephemeral: true });
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

      await salvarDados(userId, 'saida');

      const horas = Math.floor(tempo / 3600000);
      const minutos = Math.floor((tempo % 3600000) / 60000);
      canal?.send(`📤 <@${userId}> bateu saída às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Trabalhou ${horas}h ${minutos}m.`);
      return interaction.reply({ content: `Saída registrada! ${horas}h ${minutos}m trabalhados.`, ephemeral: true });
    }

    if (interaction.customId === 'horas') {
      const total = pontos[userId]?.acumuladoMs || 0;
      const horas = Math.floor(total / 3600000);
      const minutos = Math.floor((total % 3600000) / 60000);
      return interaction.reply({ content: `Você acumulou ${horas}h ${minutos}m.`, ephemeral: true });
    }

    if (interaction.customId === 'comandos') {
      return interaction.reply({
        content: `🔹 **COMANDOS DISPONÍVEIS**\n/painel - Painel de ponto\n/ranking - Ranking de horas\n/relatorio_geral - Relatório geral (restrito)`,
        ephemeral: true
      });
    }
  }
});


const fechandoPonto = {}; // controle para evitar duplicidade de fechamento

client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = oldState.id;
  const membro = await oldState.guild.members.fetch(userId).catch(() => null);
  const canal = oldState.guild.channels.cache.get(CANAL_NOTIFICACOES_ID);

  // Verifica se saiu de uma call da categoria monitorada
  if (oldState.channelId && (!newState.channelId || newState.channelId !== oldState.channelId)) {
    if (oldState.channel?.parentId === CATEGORIA_MONITORADA) {
      console.log(`[DEBUG] Usuário ${userId} saiu da call monitorada.`);

      // Limpa temporizador de mudo, se existir
      if (timersMutados[userId]) {
        clearTimeout(timersMutados[userId]);
        delete timersMutados[userId];
      }
      if (fechandoPonto[userId]) return; // já está fechando para esse usuário

      // Se havia ponto aberto
      if (pontos[userId]?.entrada) {
        fechandoPonto[userId] = true;
        try {
          const agora = new Date();
          const entradaDate = new Date(pontos[userId].entrada);

          if (isNaN(entradaDate)) {
            console.warn(`[AVISO] Data de entrada inválida para usuário ${userId}:`, pontos[userId].entrada);
            return;
          }

          const tempo = agora - entradaDate;

          // Validação para evitar tempos absurdos (maior que 12h)
          if (tempo > 12 * 60 * 60 * 1000) {
            console.warn(`[AVISO] Tempo excessivo detectado para usuário ${userId}: ${Math.floor(tempo / 3600000)}h. Ignorando ponto.`);
            return;
          }

          // Atualiza acumulado e registra ponto
          pontos[userId].acumuladoMs += tempo;
          pontos[userId].registros.push({
            entrada: pontos[userId].entrada,
            saida: agora.toISOString(),
          });

          pontos[userId].entrada = null;

          await salvarDados(userId, 'saida');

          const horas = Math.floor(tempo / 3600000);
          const minutos = Math.floor((tempo % 3600000) / 60000);

          if (canal) {
            canal.send(
              `📤 <@${userId}> foi desconectado da call e teve o ponto fechado automaticamente às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. ` +
              `Trabalhou ${horas}h ${minutos}m.`
            );
          }
        } finally {
          delete fechandoPonto[userId]; // libera trava
        }
      }
    }
  }
});


client.login(process.env.TOKEN);

