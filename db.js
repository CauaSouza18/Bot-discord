// db.js
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Railway normalmente exige SSL, mantenha assim
});

client.connect()
  .then(() => console.log('✅ Conectado ao PostgreSQL'))
  .catch(err => console.error('❌ Erro ao conectar ao PostgreSQL:', err));

async function getPonto(userId) {
  const res = await client.query('SELECT * FROM pontos WHERE user_id = $1', [userId]);
  if (res.rowCount === 0) {
    // Cria registro inicial para o usuário
    return { user_id: userId, entrada: null, acumuladoMs: 0, registros: [] };
  }
  return {
    user_id: res.rows[0].user_id,
    entrada: res.rows[0].entrada,
    acumuladoMs: parseInt(res.rows[0].acumulado_ms, 10),
    registros: res.rows[0].registros
  };
}

async function salvarPonto(ponto) {
  await client.query(`
    INSERT INTO pontos (user_id, entrada, acumulado_ms, registros)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) DO UPDATE SET
      entrada = EXCLUDED.entrada,
      acumulado_ms = EXCLUDED.acumulado_ms,
      registros = EXCLUDED.registros
  `, [
    ponto.user_id,
    ponto.entrada,
    ponto.acumuladoMs,
    JSON.stringify(ponto.registros)
  ]);
}

module.exports = {
  getPonto,
  salvarPonto
};

