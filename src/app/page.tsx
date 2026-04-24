"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Operador = { operador: string; nome: string; registos: number };
type PontoSerie = { periodo: string; total: number; registos: number };
type Detalhe = { data: string; premio: number; turno: string | null; ficheiro: string | null };
type Granularidade = "dia" | "semana" | "mes";

export default function Home() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorSel, setOperadorSel] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [granularidade, setGranularidade] = useState<Granularidade>("semana");
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const [detalhes, setDetalhes] = useState<Detalhe[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregarOperadores = useCallback(async () => {
    const res = await fetch("/api/operadores");
    if (!res.ok) return;
    const data = await res.json();
    setOperadores(data.operadores || []);
  }, []);

  const carregarEvolucao = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (operadorSel) params.set("operador", operadorSel);
    if (desde) params.set("desde", desde);
    if (ate) params.set("ate", ate);
    params.set("granularidade", granularidade);
    const res = await fetch(`/api/evolucao?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setSerie(data.serie || []);
      setDetalhes(data.detalhes || []);
    }
    setLoading(false);
  }, [operadorSel, desde, ate, granularidade]);

  useEffect(() => {
    carregarOperadores();
  }, [carregarOperadores]);

  useEffect(() => {
    carregarEvolucao();
  }, [carregarEvolucao]);

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setUploadMsg("");
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadMsg(`Erro: ${data.error || "upload falhou"}`);
      } else {
        const det = (data.ficheiros as { ficheiro: string; extraidos: number; inseridos: number }[])
          .map((f) => `${f.ficheiro}: ${f.inseridos}/${f.extraidos}`)
          .join(" · ");
        setUploadMsg(`${data.totalInseridos} novos registos inseridos. ${det}`);
        await carregarOperadores();
        await carregarEvolucao();
      }
    } catch (e) {
      setUploadMsg(`Erro: ${(e as Error).message}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const operadoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return operadores;
    return operadores.filter(
      (o) => o.operador.toLowerCase().includes(q) || o.nome.toLowerCase().includes(q)
    );
  }, [operadores, busca]);

  const totalSerie = useMemo(() => serie.reduce((s, p) => s + p.total, 0), [serie]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Evo — Evolução de prémios</h1>
        <p className="text-sm text-gray-600">
          Carregue ficheiros xls de prémio (várias semanas) e filtre por operador para ver a evolução.
        </p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold mb-3">1. Carregar ficheiros xls</h2>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".xls,.xlsx"
          disabled={uploading}
          onChange={(e) => handleUpload(e.target.files)}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 file:cursor-pointer disabled:opacity-50"
        />
        {uploading && <p className="text-xs text-gray-500 mt-2">A processar...</p>}
        {uploadMsg && <p className="text-xs text-gray-700 mt-2">{uploadMsg}</p>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold mb-3">2. Filtros</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Operador</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por número ou nome..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <select
              value={operadorSel}
              onChange={(e) => setOperadorSel(e.target.value)}
              className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              size={6}
            >
              <option value="">— Todos —</option>
              {operadoresFiltrados.map((o) => (
                <option key={o.operador} value={o.operador}>
                  {o.operador} · {o.nome} ({o.registos})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <label className="block text-xs font-medium text-gray-600 mb-1 mt-3">Até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Granularidade</label>
            <select
              value={granularidade}
              onChange={(e) => setGranularidade(e.target.value as Granularidade)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            >
              <option value="dia">Dia</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
            <button
              onClick={() => {
                setBusca("");
                setOperadorSel("");
                setDesde("");
                setAte("");
                setGranularidade("semana");
              }}
              className="mt-3 w-full px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">3. Evolução</h2>
          <span className="text-xs text-gray-500">
            {loading ? "A carregar..." : `${serie.length} pontos · total ${totalSerie.toFixed(2)} €`}
          </span>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={serie} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="periodo" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(v: number) => `${v.toFixed(2)} €`}
                labelFormatter={(l) => `Período: ${l}`}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#D48E00"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {operadorSel && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold mb-3">Detalhes do operador {operadorSel}</h2>
          {detalhes.length === 0 ? (
            <p className="text-sm text-gray-500">Sem registos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Turno</th>
                    <th className="py-2 pr-4 text-right">Prémio (€)</th>
                    <th className="py-2 pr-4">Ficheiro</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhes.map((d, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 pr-4">{d.data}</td>
                      <td className="py-1.5 pr-4">{d.turno ?? ""}</td>
                      <td className="py-1.5 pr-4 text-right">{d.premio.toFixed(2)}</td>
                      <td className="py-1.5 pr-4 text-gray-500">{d.ficheiro ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
