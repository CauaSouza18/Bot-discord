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
        new ButtonBuilder().setCustomI


