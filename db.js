const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // se precisar de SSL, descomente
});

const CANAL_NOTIFICACOES_ID = '1372769457201610783'; // ID do canal de notificações

async function fecharPontoDoUsuario(userId, guild) {
  const client = await pool.connect();
  try {
    const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    // Busca o ponto do usuário no banco
    const res = await client.query('SELECT data FROM pontos WHERE user_id = $1', [userId]);

    let dados = res.rows[0]?.data || {};

    // Se vier como string, converte para objeto
    if (typeof dados === 'string') {
      dados = JSON.parse(dados);
    }

    // Verifica se existe ponto aberto para hoje (entrada sem saída)
    if (!dados[hoje] || !dados[hoje].entrada || dados[hoje].saida) {
      console.log(`[DEBUG] Nenhum ponto aberto para fechar do usuário ${userId}.`);
      return;
    }

    // Fecha o ponto marcando a saída
    dados[hoje].saida = horaAgora;

    // Atualiza o banco com o ponto fechado
    await client.query(
      `UPDATE pontos SET data = $1 WHERE user_id = $2`,
      [dados, userId]
    );

    console.log(`[DEBUG] Ponto fechado do usuário ${userId} às ${horaAgora}.`);

    // Envia notificação no canal, se existir
    const canal = guild.channels.cache.get(CANAL_NOTIFICACOES_ID);
    if (canal) {
      canal.send(`🕔 <@${userId}> teve o ponto encerrado automaticamente às ${horaAgora}.`);
    }
  } catch (err) {
    console.error(`[ERRO] Falha ao fechar ponto do usuário ${userId}:`, err);
  } finally {
    client.release();
  }
}

module.exports = {
  getPontos,
  salvarPontos,
  fecharPontoDoUsuario, // Exporta a nova função também
};



