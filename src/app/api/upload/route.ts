import { NextRequest, NextResponse } from "next/server";
import { pool, initDB } from "@/lib/db";
import { extractPremiosFromFile } from "@/lib/parse-premio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await initDB();
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "Nenhum ficheiro" }, { status: 400 });
    }

    const db = pool();
    const perFile: { ficheiro: string; extraidos: number; inseridos: number }[] = [];
    let totalInseridos = 0;

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const premios = extractPremiosFromFile(buf);

      let inseridos = 0;
      for (const p of premios) {
        const res = await db.query(
          `INSERT INTO premios (operador, nome, premio, data_premio, turno, ficheiro_origem)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [p.operador, p.nome, p.premio, p.dataPremio || null, p.turno || null, file.name]
        );
        if (res.rowCount && res.rowCount > 0) inseridos++;
      }
      totalInseridos += inseridos;
      perFile.push({ ficheiro: file.name, extraidos: premios.length, inseridos });
    }

    return NextResponse.json({ ok: true, totalInseridos, ficheiros: perFile });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Erro no upload" },
      { status: 500 }
    );
  }
}
