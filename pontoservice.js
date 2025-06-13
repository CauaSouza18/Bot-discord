const db = require('./db');

async function baterEntrada(userId) {
  // Pega o campo data JSON
  const res = await db.query('SELECT data FROM pontos WHERE user_id = $1', [userId]);
  
  let data = {};
  if (res.rows.length) {
    data = res.rows[0].data;
    if (data.entrada) {
      throw new Error('Você já bateu ponto de entrada!');
    }
  }

  data.entrada = new Date().toISOString();

  if (res.rows.length) {
    // Atualiza registro existente
    await db.query('UPDATE pontos SET data = $1 WHERE user_id = $2', [data, userId]);
  } else {
    // Insere novo registro
    await db.query('INSERT INTO pontos(user_id, data) VALUES ($1, $2)', [userId, data]);
  }

  return data.entrada;
}

async function baterSaida(userId) {
  const res = await db.query('SELECT data FROM pontos WHERE user_id = $1', [userId]);
  if (!res.rows.length) throw new Error('Nenhum registro encontrado para o usuário');
  
  const data = res.rows[0].data;
  
  if (!data.entrada) {
    throw new Error('Você precisa bater entrada antes!');
  }
  
  const entrada = new Date(data.entrada);
  const saidaAgora = new Date();
  const tempo = saidaAgora - entrada;
  
  data.acumulado_ms = (data.acumulado_ms || 0) + tempo;
  
  data.registros = data.registros || [];
  data.registros.push({ entrada: data.entrada, saida: saidaAgora.toISOString() });
  
  delete data.entrada; // remove entrada porque o ponto foi fechado
  
  await db.query('UPDATE pontos SET data = $1 WHERE user_id = $2', [data, userId]);
  
  return tempo;
}

async function consultarHoras(userId) {
  const res = await db.query('SELECT data FROM pontos WHERE user_id = $1', [userId]);
  if (!res.rows.length) return 0;
  
  const data = res.rows[0].data;
  return data.acumulado_ms || 0;
}

module.exports = {
  baterEntrada,
  baterSaida,
  consultarHoras,
};
