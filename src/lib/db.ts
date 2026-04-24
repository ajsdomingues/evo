import { Pool } from "pg";

let _pool: Pool | null = null;
let _initPromise: Promise<void> | null = null;

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

async function runInit(): Promise<void> {
  const db = pool();
  try {
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
  } catch (err: unknown) {
    // CREATE TABLE IF NOT EXISTS racing between connections can raise 23505
    // on pg_type_typname_nsp_index. Safe to ignore if the table now exists.
    const code = (err as { code?: string }).code;
    if (code !== "23505") throw err;
  }
  await db.query(`CREATE INDEX IF NOT EXISTS idx_premios_operador ON premios (operador);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_premios_data ON premios (data_premio);`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_premios_dedup
    ON premios (operador, premio, COALESCE(data_premio, '1900-01-01'::date), COALESCE(turno, ''));
  `);
}

export function initDB(): Promise<void> {
  if (!_initPromise) {
    _initPromise = runInit().catch((err) => {
      _initPromise = null;
      throw err;
    });
  }
  return _initPromise;
}
