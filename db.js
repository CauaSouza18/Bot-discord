const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Se precisar de SSL para conexão no servidor, configure aqui:
  // ssl: { rejectUnauthorized: false }
});

async function getPontos() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT user_id, data FROM pontos');
    // Monta o objeto pontos para o bot a partir do banco
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
      // Upsert (insert or update) a linha na tabela
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

module.exports = {
  getPontos,
  salvarPontos,
};

