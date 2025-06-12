const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // descomente se necessário
});

// Busca os pontos (registro de entrada e saída) do usuário no banco
async function getPontos(usuarioId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT data FROM pontos WHERE user_id = $1', [usuarioId]);
    const dados = result.rows[0]?.data || {};
    return typeof dados === 'string' ? JSON.parse(dados) : dados;
  } catch (err) {
    console.error(`[ERRO] ao buscar pontos do usuário ${usuarioId}:`, err);
    return {};
  } finally {
    client.release();
  }
}

// Salva um ponto (entrada ou saída) do usuário no banco
async function salvarPontos(usuarioId, tipo) {
  const client = await pool.connect();
  try {
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    const res = await client.query('SELECT data FROM pontos WHERE user_id = $1', [usuarioId]);
    let dados = res.rows[0]?.data || {};

    if (typeof dados === 'string') {
      dados = JSON.parse(dados);
    }

    if (!dados[hoje]) {
      dados[hoje] = {};
    }

    dados[hoje][tipo] = horaAgora;

    await client.query(
      `INSERT INTO pontos (user_id, data)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET data = EXCLUDED.data`,
      [usuarioId, dados]
    );

    return dados[hoje];
  } catch (err) {
    console.error(`[ERRO] ao salvar ponto do tipo ${tipo} do usuário ${usuarioId}:`, err);
    return null;
  } finally {
    client.release();
  }
}

// Fecha o ponto do usuário (coloca saída com hora atual)
async function fecharPontoDoUsuario(userId, guild) {
  const client = await pool.connect();
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    const res = await client.query('SELECT data FROM pontos WHERE user_id = $1', [userId]);
    let dados = res.rows[0]?.data || {};

    if (typeof dados === 'string') {
      dados = JSON.parse(dados);
    }

    if (!dados[hoje] || !dados[hoje].entrada || dados[hoje].saida) {
      console.log(`[DEBUG] Nenhum ponto aberto para fechar do usuário ${userId}.`);
      return;
    }

    dados[hoje].saida = horaAgora;

    await client.query(
      `UPDATE pontos SET data = $1 WHERE user_id = $2`,
      [dados, userId]
    );

    console.log(`[DEBUG] Ponto fechado do usuário ${userId} às ${horaAgora}.`);

    const canal = guild.channels.cache.get('1372769457201610783'); // seu canal de notificações fixo
    if (canal) {
      canal.send(`🕔 <@${userId}> teve o ponto encerrado automaticamente às ${horaAgora}.`);
    }
  } catch (err) {
    console.error(`[ERRO] Falha ao fechar ponto do usuário ${userId}:`, err);
  } finally {
    client.release();
  }
}

// Pega todos os pontos de todos os usuários
async function getTodosPontos() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT user_id, data FROM pontos');
    const todosDados = {};
    for (const row of res.rows) {
      todosDados[row.user_id] = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    }
    return todosDados;
  } catch (err) {
    console.error('[ERRO] ao buscar todos os pontos:', err);
    return {};
  } finally {
    client.release();
  }
}

// Função para calcular tempo trabalhado com base em entrada e saída (string HH:mm:ss)
function calcularTempoTrabalhado(dadosDia) {
  if (!dadosDia || !dadosDia.entrada || !dadosDia.saida) return null;

  // Parse das strings para Date usando hoje como base
  const hojeStr = new Date().toISOString().split('T')[0];
  const entrada = new Date(`${hojeStr}T${dadosDia.entrada}`);
  const saida = new Date(`${hojeStr}T${dadosDia.saida}`);

  let diffMs = saida - entrada;
  if (diffMs < 0) diffMs = 0; // não negativo

  const horas = Math.floor(diffMs / 3600000);
  const minutos = Math.floor((diffMs % 3600000) / 60000);
  const segundos = Math.floor((diffMs % 60000) / 1000);

  return { totalMs: diffMs, horas, minutos, segundos };
}

module.exports = {
  getPontos,
  salvarPontos,
  fecharPontoDoUsuario,
  getTodosPontos,
  calcularTempoTrabalhado,
};
