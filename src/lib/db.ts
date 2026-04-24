import { Pool } from "pg";

let _pool: Pool | null = null;
let _initialized = false;

export function pool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não definido no .env");
    }
    _pool = new Pool({ connectionString });
  }
  return _pool;
}

export async function initDB(): Promise<void> {
  if (_initialized) return;
  const db = pool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS premios (
      id SERIAL PRIMARY KEY,
      operador TEXT NOT NULL,
      nome TEXT NOT NULL,
      premio NUMERIC(10, 2) NOT NULL,
      data_premio DATE,
      turno TEXT,
      ficheiro_origem TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_premios_operador ON premios (operador);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_premios_data ON premios (data_premio);`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_premios_dedup
    ON premios (operador, premio, COALESCE(data_premio, '1900-01-01'::date), COALESCE(turno, ''));
  `);
  _initialized = true;
}
