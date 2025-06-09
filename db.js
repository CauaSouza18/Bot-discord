const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getPontos() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT user_id, data FROM pontos');
    const pontos = {};
    res.rows.forEach(row => {
      pontos[row.user_id] = row.data;
    });
    return pontos;
  } finally {
    client.release();
  }
}

async function salvarPontos(pontos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const userId in pontos) {
      const data = pontos[userId];
      await client.query(
        `INSERT INTO pontos (user_id, data) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data`,
        [userId, data]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const CANAL_NOTIFICACOES_ID = '1372769457201610783';

async function fecharPontoDoUsuario(userId, guild) {
  const client = await pool.connect();
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    const res = await client.query('SELECT data FROM pontos WHERE user_id = $1', [userId]);
    let dados = res.rows[0]?.data || {};

    if (!dados[hoje] || !dados[hoje].entrada || dados[hoje].saida) {
      console.log(`[DEBUG] Nenhum ponto aberto para fechar do usuário ${userId}.`);
      return;
    }

    dados[hoje].saida = horaAgora;

    await client.query('UPDATE pontos SET data = $1 WHERE user_id = $2', [dados, userId]);

    console.log(`[DEBUG] Ponto fechado do usuário ${userId} às ${horaAgora}.`);

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
  fecharPontoDoUsuario,
};
