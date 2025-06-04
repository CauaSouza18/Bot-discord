const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect()
  .then(() => console.log("🟢 Conectado ao banco de dados PostgreSQL com sucesso"))
  .catch(err => console.error("🔴 Erro ao conectar no banco:", err));

module.exports = client;
