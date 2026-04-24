import { NextResponse } from "next/server";
import { pool, initDB } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDB();
    const db = pool();
    const { rows } = await db.query(
      `SELECT operador, MAX(nome) AS nome, COUNT(*)::int AS registos
       FROM premios
       GROUP BY operador
       ORDER BY operador`
    );
    return NextResponse.json({ operadores: rows });
  } catch (err) {
    console.error("operadores error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
