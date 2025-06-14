const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
      .setName('painel')
      .setDescription('Envia o painel com os botões de ponto')
      .toJSON(),

  new SlashCommandBuilder()
      .setName('ranking')
      .setDescription('Mostra o ranking de horas batidas')
      .toJSON(),

  new SlashCommandBuilder()
  .setName('excluir')
  .setDescription('Exclui um usuário do sistema pelo ID')
  .addStringOption(option =>
    option.setName('userid')
      .setDescription('ID do usuário a ser excluído')
      .setRequired(true)
  )
  .toJSON(),

  new SlashCommandBuilder()
      .setName('relatorio_geral')
      .setDescription('Mostra o relatório completo de todos os usuários')
      .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🚀 Registrando comandos...');

    await rest.put(
        Routes.applicationCommands('1379188672657752214'),
        { body: commands },
    );

    console.log('✅ Comandos registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();
