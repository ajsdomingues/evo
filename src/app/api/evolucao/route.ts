import { NextRequest, NextResponse } from "next/server";
import { pool, initDB } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Granularidade = "dia" | "semana" | "mes";

export async function GET(request: NextRequest) {
  try {
    await initDB();
    const db = pool();
    const sp = request.nextUrl.searchParams;
    const operador = sp.get("operador");
    const desde = sp.get("desde");
    const ate = sp.get("ate");
    const granRaw = (sp.get("granularidade") || "semana") as Granularidade;
    const gran: Granularidade = ["dia", "semana", "mes"].includes(granRaw) ? granRaw : "semana";

    const params: unknown[] = [];
    const where: string[] = ["data_premio IS NOT NULL"];
    if (operador) {
      params.push(operador);
      where.push(`operador = $${params.length}`);
    }
    if (desde) {
      params.push(desde);
      where.push(`data_premio >= $${params.length}`);
    }
    if (ate) {
      params.push(ate);
      where.push(`data_premio <= $${params.length}`);
    }

    const truncExpr =
      gran === "dia"
        ? "data_premio::timestamp"
        : gran === "mes"
        ? "date_trunc('month', data_premio)"
        : "date_trunc('week', data_premio)";

    const sql = `
      SELECT ${truncExpr} AS periodo,
             SUM(premio)::float AS total,
             COUNT(*)::int AS registos
      FROM premios
      WHERE ${where.join(" AND ")}
      GROUP BY periodo
      ORDER BY periodo
    `;

    const { rows } = await db.query(sql, params);

    const serie = rows.map((r) => ({
      periodo: (r.periodo as Date).toISOString().slice(0, 10),
      total: Number(r.total),
      registos: r.registos,
    }));

    let detalhes: Array<{ data: string; premio: number; turno: string | null; ficheiro: string | null }> = [];
    if (operador) {
      const det = await db.query(
        `SELECT data_premio, premio::float AS premio, turno, ficheiro_origem
         FROM premios
         WHERE operador = $1 ${desde ? "AND data_premio >= $2" : ""} ${ate ? `AND data_premio <= $${desde ? 3 : 2}` : ""}
         ORDER BY data_premio NULLS LAST, id`,
        [operador, ...(desde ? [desde] : []), ...(ate ? [ate] : [])]
      );
      detalhes = det.rows.map((r) => ({
        data: r.data_premio ? (r.data_premio as Date).toISOString().slice(0, 10) : "",
        premio: Number(r.premio),
        turno: r.turno,
        ficheiro: r.ficheiro_origem,
      }));
    }

    return NextResponse.json({ granularidade: gran, serie, detalhes });
  } catch (err) {
    console.error("evolucao error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
