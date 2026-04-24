import * as XLSX from "xlsx";

export interface PremioInput {
  operador: string;
  nome: string;
  premio: number;
  dataPremio?: string;
  turno?: string | null;
}

const OPERADOR_KEYWORDS = ["operador", "numero", "número", "id", "matricula", "matrícula", "cod", "codigo", "código", "nº", "n.", "op"];
const NOME_KEYWORDS = ["nome", "name", "colaborador", "funcionario", "funcionário", "empregado", "trabalhador"];
const PREMIO_KEYWORDS = ["premio", "prémio", "valor", "bonus", "bónus", "value", "amount", "montante", "quantia", "total", "pagar"];
const DATA_KEYWORDS = ["data", "date", "mes", "mês", "periodo", "período", "month", "dia"];

function matchColumn(header: string, keywords: string[]): boolean {
  const h = header.toLowerCase().trim();
  return keywords.some((k) => h.includes(k));
}

function parseDateHeader(header: string): string | undefined {
  const str = header.trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  return undefined;
}

function parseDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  const fromHeader = parseDateHeader(str);
  if (fromHeader) return fromHeader;
  const num = Number(value);
  if (!isNaN(num) && num > 40000 && num < 50000) {
    const date = new Date((num - 25569) * 86400000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const monthMatch = str.match(/^([a-záéíóúâêôãõç]+)\s*(\d{4})$/i);
  if (monthMatch) {
    const months: Record<string, string> = {
      jan: "01", janeiro: "01", fev: "02", fevereiro: "02",
      mar: "03", marco: "03", março: "03",
      abr: "04", abril: "04", mai: "05", maio: "05",
      jun: "06", junho: "06", jul: "07", julho: "07",
      ago: "08", agosto: "08", set: "09", setembro: "09",
      out: "10", outubro: "10", nov: "11", novembro: "11",
      dez: "12", dezembro: "12",
    };
    const m = months[monthMatch[1].toLowerCase()];
    if (m) return `${monthMatch[2]}-${m}-01`;
  }
  return undefined;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (!value) return null;
  let str = String(value).trim();
  str = str.replace(/[€$\s]/g, "");
  if (str.includes(",") && str.includes(".")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function detectDateColumns(headers: string[]): { index: number; date: string }[] {
  const out: { index: number; date: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const date = parseDateHeader(headers[i]);
    if (date) out.push({ index: i, date });
  }
  return out;
}

interface WeekendColumn {
  index: number;
  date: string;
  turno: string | undefined;
}

function parseWeekendHeader(raw: string): { date: string; turno: string | undefined } | undefined {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const dateMatch = normalized.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!dateMatch) return undefined;
  const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  const timeMatch = normalized.match(/\((\d{2})\s*h?\s*-\s*(\d{2})\s*h?\)/i);
  if (timeMatch) return { date, turno: `${timeMatch[1]}-${timeMatch[2]}` };
  return { date, turno: undefined };
}

function detectWeekendColumns(headers: string[]): WeekendColumn[] {
  const cols: WeekendColumn[] = [];
  for (let i = 0; i < headers.length; i++) {
    const parsed = parseWeekendHeader(headers[i]);
    if (parsed) cols.push({ index: i, ...parsed });
  }
  return cols;
}

function isWeekendFormat(cols: WeekendColumn[]): boolean {
  return cols.length >= 1 && cols.some((c) => c.turno !== undefined);
}

function mergeHeaderRows(row0: unknown[], row1: unknown[], numCols: number): {
  headers: string[];
  dataStartRow: number;
} {
  const row1Normalized = row1.map((v) => String(v ?? "").trim());
  const hasSubHeader = row1Normalized.some((v) => /\(\s*\d{2}\s*h?\s*-\s*\d{2}\s*h?\)/i.test(v));
  if (!hasSubHeader) {
    const headers = Array.from({ length: numCols }, (_, i) => String(row0[i] ?? "").trim());
    return { headers, dataStartRow: 1 };
  }

  const filledRow0: string[] = [];
  let lastDate = "";
  for (let i = 0; i < numCols; i++) {
    const raw = String(row0[i] ?? "").trim();
    if (raw) {
      if (/\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(raw)) {
        lastDate = raw;
        filledRow0.push(raw);
      } else {
        lastDate = "";
        filledRow0.push(raw);
      }
    } else if (lastDate) {
      filledRow0.push(lastDate);
    } else {
      filledRow0.push("");
    }
  }

  const headers = filledRow0.map((h, i) => {
    const sub = row1Normalized[i] || "";
    return [h, sub].filter(Boolean).join(" ").trim();
  });
  return { headers, dataStartRow: 2 };
}

export function extractPremiosFromFile(buffer: Buffer): PremioInput[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const results: PremioInput[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
    if (rawRows.length < 2) continue;
    const numCols = rawRows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);

    const row0 = (rawRows[0] as unknown[]) || [];
    const row1 = (rawRows[1] as unknown[]) || [];
    const { headers, dataStartRow } = mergeHeaderRows(row0, row1, numCols);
    const headersLower = headers.map((h) => h.toLowerCase().trim());

    const rows: Record<string, unknown>[] = [];
    for (let r = dataStartRow; r < rawRows.length; r++) {
      const rawRow = rawRows[r] as unknown[] | undefined;
      const row: Record<string, unknown> = {};
      for (let c = 0; c < numCols; c++) {
        row[headers[c] || `__col_${c}__`] = rawRow?.[c] ?? null;
      }
      rows.push(row);
    }
    if (rows.length === 0) continue;

    let operadorIdx = headersLower.findIndex((h) => matchColumn(h, OPERADOR_KEYWORDS));
    const nomeIdx = headersLower.findIndex((h) => matchColumn(h, NOME_KEYWORDS));

    const weekendCols = detectWeekendColumns(headers);
    if (isWeekendFormat(weekendCols)) {
      if (operadorIdx === -1) {
        for (let i = 0; i < headers.length; i++) {
          if (weekendCols.some((c) => c.index === i)) continue;
          if (i === nomeIdx) continue;
          const firstVal = String(rows[0][headers[i]] || "").trim();
          if (/^\d+$/.test(firstVal)) {
            operadorIdx = i;
            break;
          }
        }
      }
      if (operadorIdx === -1) continue;

      for (const row of rows) {
        const operador = String(row[headers[operadorIdx]] || "").trim().replace(/^0+/, "") || "0";
        if (!operador || operador === "0") continue;
        const nome = nomeIdx !== -1 ? String(row[headers[nomeIdx]] || "").trim() || "N/A" : "N/A";

        for (const col of weekendCols) {
          const val = parseNumber(row[headers[col.index]]);
          if (val === null || val === 0) continue;
          results.push({
            operador,
            nome,
            premio: val,
            dataPremio: col.date,
            turno: col.turno ?? "sábado",
          });
        }
      }
      continue;
    }

    const dateColumns = detectDateColumns(headers);
    if (dateColumns.length >= 1) {
      if (operadorIdx === -1) {
        for (let i = 0; i < headers.length; i++) {
          const isDateCol = dateColumns.some((dc) => dc.index === i);
          if (!isDateCol && i !== nomeIdx) {
            operadorIdx = i;
            break;
          }
        }
      }
      if (operadorIdx === -1) continue;

      for (const row of rows) {
        const operador = String(row[headers[operadorIdx]] || "").trim();
        if (!operador) continue;
        const nome = nomeIdx !== -1 ? String(row[headers[nomeIdx]] || "").trim() : "N/A";
        for (const dc of dateColumns) {
          const val = parseNumber(row[headers[dc.index]]);
          if (val === null || val === 0) continue;
          results.push({ operador, nome, premio: val, dataPremio: dc.date });
        }
      }
    } else {
      let premioIdx = headersLower.findIndex((h) => matchColumn(h, PREMIO_KEYWORDS));
      const dataIdx = headersLower.findIndex((h) => matchColumn(h, DATA_KEYWORDS));

      if (premioIdx === -1) {
        for (let i = 0; i < headers.length; i++) {
          if (i === operadorIdx || i === nomeIdx || i === dataIdx) continue;
          const firstVal = rows[0][headers[i]];
          if (typeof firstVal === "number" || (firstVal && parseNumber(firstVal) !== null)) {
            premioIdx = i;
            break;
          }
        }
      }

      if (operadorIdx === -1) {
        for (let i = 0; i < headers.length; i++) {
          if (i === nomeIdx || i === premioIdx || i === dataIdx) continue;
          const firstVal = String(rows[0][headers[i]] || "").trim();
          if (/^\d+$/.test(firstVal)) {
            operadorIdx = i;
            break;
          }
        }
      }

      if (operadorIdx === -1 || premioIdx === -1) continue;

      for (const row of rows) {
        const operador = String(row[headers[operadorIdx]] || "").trim();
        const premioVal = parseNumber(row[headers[premioIdx]]);
        if (!operador || premioVal === null) continue;
        const nome = nomeIdx !== -1 ? String(row[headers[nomeIdx]] || "").trim() : "N/A";
        const dataPremio = dataIdx !== -1 ? parseDate(row[headers[dataIdx]]) : undefined;
        results.push({ operador, nome, premio: premioVal, dataPremio });
      }
    }
  }

  return results;
}
