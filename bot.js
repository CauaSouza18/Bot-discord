// Bot de Ponto com Painel e Monitoramento de Voz (Versão Final)
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
    if (interaction.isChatInputCommand()) {
        const membro = interaction.member;

        if (interaction.commandName === 'relatorio_geral') {
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: 'Apenas o dono do servidor pode usar este comando.', flags: 64 });
            }

            const agora = new Date();
            const hoje = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
.split('T')[0];
            const inicioSemana = new Date(agora);
            inicioSemana.setDate(agora.getDate() - agora.getDay());
            const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

            let relatorio = '';

            for (const userId in pontos) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (!user) continue;

                const registros = pontos[userId].registros || [];
                let hojeMs = 0, semanaMs = 0, mesMs = 0;

                for (const r of registros) {
                    if (!r.entrada || !r.saida) continue;
                    const entrada = new Date(r.entrada);
                    const saida = new Date(r.saida);
                    const tempo = saida - entrada;

                    if (entrada.toISOString().startsWith(hoje)) hojeMs += tempo;
                    if (entrada >= inicioSemana) semanaMs += tempo;
                    if (entrada >= inicioMes) mesMs += tempo;
                }

                const formatar = ms => `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;

                relatorio += `👤 **${user.tag}**\nHoje: ${formatar(hojeMs)} | Semana: ${formatar(semanaMs)} | Mês: ${formatar(mesMs)} | Total: ${formatar(pontos[userId].acumuladoMs || 0)}\n\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('📊 Relatório Geral de Todos os Usuários')
                .setColor(0x2ecc71)
                .setDescription(relatorio || 'Nenhum dado disponível.');

            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
            return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', flags: 64 });
        }

        if (interaction.commandName === 'painel') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('entrada').setLabel('Bater Entrada').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('saida').setLabel('Bater Saída').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: 'Clique nos botões para bater ponto:', components: [row] });
        }

        if (interaction.commandName === 'ranking') {
            const ranking = Object.entries(pontos).filter(([_, d]) => d.acumuladoMs > 0).sort((a, b) => b[1].acumuladoMs - a[1].acumuladoMs);
            if (ranking.length === 0) return interaction.reply('Ninguém bateu ponto ainda.');

            const embed = new EmbedBuilder().setTitle('🏆 Ranking de Horas Batidas').setColor(0x00AE86);
            let desc = '';
            for (let i = 0; i < Math.min(ranking.length, 10); i++) {
                const [userId, data] = ranking[i];
                const horas = Math.floor(data.acumuladoMs / 3600000);
                const minutos = Math.floor((data.acumuladoMs % 3600000) / 60000);
                desc += `**${i + 1}** - <@${userId}>: ${horas}h ${minutos}m\n`;
            }
            embed.setDescription(desc);
            return interaction.reply({ embeds: [embed] });
        }
    }

    if (interaction.isButton()) {
        const userId = interaction.user.id;
        const membro = interaction.guild.members.cache.get(userId);
        const canal = interaction.guild.channels.cache.get(CANAL_NOTIFICACOES_ID);

        if (!membro.roles.cache.some(role => CARGOS_PERMITIDOS.includes(role.id))) {
            return interaction.reply({ content: '❌ Você não tem permissão para bater ponto.', flags: 64 });
        }

        if (!pontos[userId]) pontos[userId] = { entrada: null, acumuladoMs: 0, registros: [] };

        if (interaction.customId === 'entrada') {
            if (pontos[userId].entrada) {
                return interaction.reply({ content: 'Você já bateu entrada!', flags: 64 });
            }
            pontos[userId].entrada = new Date().toISOString();
            salvarDados();
            if (canal) canal.send(`📥 <@${userId}> bateu ponto de entrada às ${new Date(pontos[userId].entrada).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}`);
            return interaction.reply({ content: `Entrada registrada às ${new Date(pontos[userId].entrada).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })

        }

        if (interaction.customId === 'saida') {
            if (!pontos[userId].entrada) {
                return interaction.reply({ content: 'Você precisa bater entrada antes!', flags: 64 });
            }
            const agora = new Date();
            const entradaDate = new Date(pontos[userId].entrada);
            const tempo = agora - entradaDate;
            pontos[userId].acumuladoMs += tempo;
            if (!pontos[userId].registros) pontos[userId].registros = [];
            pontos[userId].registros.push({ entrada: pontos[userId].entrada, saida: agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
 ;
            pontos[userId].entrada = null;
            salvarDados();

            const horas = Math.floor(tempo / 3600000);
            const minutos = Math.floor((tempo % 3600000) / 60000);
          if (canal) {
  canal.send(`📤 <@${userId}> bateu ponto de saída às ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
}

. Trabalhou ${horas}h ${minutos}m.`);
            return interaction.reply({ content: `Saída registrada! Você trabalhou ${horas}h ${minutos}m.`, flags: 64 });
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
        const horas = Math.floor(tempo / 3600000);
        const minutos = Math.floor((tempo % 3600000) / 60000);
        canal.send(`⏱️ ${user} foi desconectado por inatividade. Saída automática registrada: ${horas}h ${minutos}m.`);
    }
}

client.on('voiceStateUpdate', async (oldState, newState) => {
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const userId = newState.id;

    const canalMonitorado = c => c && c.parentId === CATEGORIA_MONITORADA;
    const mudouCategoria = canalMonitorado(oldChannel) !== canalMonitorado(newChannel);

    if (mudouCategoria || (oldChannel && newChannel && oldChannel.id !== newChannel.id)) {
        if (canalMonitorado(newChannel)) {
            if (!pontos[userId]) pontos[userId] = { entrada: null, acumuladoMs: 0, registros: [] };
            checkMuteTimer(newState);
        } else {
            await baterSaidaAutomatica(userId);
            if (timersMutados[userId]) clearTimeout(timersMutados[userId]);
            delete timersMutados[userId];
        }
    } else if (canalMonitorado(newChannel)) {
        checkMuteTimer(newState);
    }
});

function checkMuteTimer(state) {
    const userId = state.id;
    if (!state.selfMute && !state.selfDeaf) {
        if (timersMutados[userId]) {
            clearTimeout(timersMutados[userId]);
            delete timersMutados[userId];
        }
    } else {
        if (!timersMutados[userId]) {
            timersMutados[userId] = setTimeout(() => {
                baterSaidaAutomatica(userId);
                delete timersMutados[userId];
            }, 5 * 60 * 1000);
        }
    }
}

client.login(process.env.TOKEN);
