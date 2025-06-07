// pontoService.js
const db = require('./db');

async function baterEntrada(userId) {
    const res = await db.query('SELECT entrada FROM pontos WHERE user_id = $1', [userId]);
    if (res.rows.length && res.rows[0].entrada) {
        throw new Error('Você já bateu ponto de entrada!');
    }

    const entradaAgora = new Date();
    await db.query(`
    INSERT INTO pontos (user_id, entrada)
    VALUES ($1, $2)
    ON CONFLICT (user_id)
    DO UPDATE SET entrada = EXCLUDED.entrada
  `, [userId, entradaAgora]);

    return entradaAgora;
}

async function baterSaida(userId) {
    const res = await db.query('SELECT entrada, acumulado_ms, registros FROM pontos WHERE user_id = $1', [userId]);
    if (!res.rows.length || !res.rows[0].entrada) {
        throw new Error('Você precisa bater entrada antes!');
    }

    const entrada = res.rows[0].entrada;
    const acumuladoMs = res.rows[0].acumulado_ms || 0;
    const registros = res.rows[0].registros || [];

    const saidaAgora = new Date();
    const tempo = saidaAgora - entrada;

    registros.push({ entrada, saida: saidaAgora });

    await db.query(`
    UPDATE pontos
    SET acumulado_ms = $1, registros = $2, entrada = NULL
    WHERE user_id = $3
  `, [acumuladoMs + tempo, JSON.stringify(registros), userId]);

    return tempo;
}

async function consultarHoras(userId) {
    const res = await db.query('SELECT acumulado_ms FROM pontos WHERE user_id = $1', [userId]);
    if (!res.rows.length) return 0;
    return res.rows[0].acumulado_ms || 0;
}

module.exports = {
    baterEntrada,
    baterSaida,
    consultarHoras,
};
