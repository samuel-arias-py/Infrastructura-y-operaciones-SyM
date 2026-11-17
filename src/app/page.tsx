'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Play,
  Download,
  Copy,
  Check,
  Sparkles,
  KeyRound,
  Link2,
  GitBranch,
  Globe,
  Hash,
  FileCode2,
  FileJson,
  Table as TableIcon,
  AlertTriangle,
  RotateCcw,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { ECOMMERCE_SAMPLE_SQL, LOCALE_OPTIONS } from '@/lib/sample-schemas';
import { generateSyntheticDataset } from '@/lib/data-generator';
import { GenerationResult, SupportedLocale } from '@/types/schema';

type ViewMode = 'table' | 'sql' | 'json';

export default function SeedForgeWorkspace() {
  // Estado del panel izquierdo (Configuración y DDL)
  const [sqlInput, setSqlInput] = useState<string>(ECOMMERCE_SAMPLE_SQL);
  const [locale, setLocale] = useState<SupportedLocale>('es_CO');
  const [rowsPerTable, setRowsPerTable] = useState<number>(12);
  const [seed, setSeed] = useState<number>(42);
  const [useAiEnrichment, setUseAiEnrichment] = useState<boolean>(false);

  // Estado del panel derecho (Resultados y Vista Previa)
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [activeTable, setActiveTable] = useState<string>('users');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'sql' | 'json' | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Si el usuario activa enriquecimiento IA, consultamos el endpoint /api/generate;
      // también soportamos ejecución instantánea en cliente para latencia cero.
      if (useAiEnrichment) {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: sqlInput,
            locale,
            rowsPerTable,
            seed,
            useAiEnrichment,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Error al generar datos.');
        }
        setResult(payload);
        if (
          payload.schema.executionOrder.length > 0 &&
          !payload.schema.executionOrder.includes(activeTable)
        ) {
          setActiveTable(payload.schema.executionOrder[0]);
        }
      } else {
        const generated = generateSyntheticDataset({
          sql: sqlInput,
          locale,
          rowsPerTable,
          seed,
          useAiEnrichment: false,
        });
        setResult(generated);
        if (
          generated.schema.executionOrder.length > 0 &&
          !generated.schema.executionOrder.includes(activeTable)
        ) {
          setActiveTable(generated.schema.executionOrder[0]);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al parsear el esquema SQL. Verifica la sintaxis CREATE TABLE.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [sqlInput, locale, rowsPerTable, seed, useAiEnrichment, activeTable]);

  // Generar vista previa inicial al montar el componente
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadFile = (format: 'sql' | 'json') => {
    if (!result) return;
    const content = format === 'sql' ? result.sqlOutput : result.jsonOutput;
    const mimeType =
      format === 'sql' ? 'application/sql;charset=utf-8;' : 'application/json;charset=utf-8;';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `seedforge_${locale}_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyContent = async (format: 'sql' | 'json') => {
    if (!result) return;
    const content = format === 'sql' ? result.sqlOutput : result.jsonOutput;
    await navigator.clipboard.writeText(content);
    setCopiedType(format);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const currentTableMeta = result?.schema.tables.find((t) => t.name === activeTable);
  const currentTableRows = result?.data[activeTable] ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-zinc-100">
      {/* Barra Superior (Header Estilo Supabase / Vercel) */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-800/80 bg-[#09090b]/90 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Database className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-zinc-100">SeedForge</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-400">
              v0.1 MVP
            </span>
          </div>
          <span className="hidden text-xs text-zinc-500 md:inline-block">
            PostgreSQL Synthetic Data &amp; Topological FK Engine
          </span>
        </div>

        {result && (
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <div className="hidden items-center gap-1.5 sm:flex">
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              <span>{result.stats.totalTables} tablas</span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>{result.stats.totalForeignKeys} Foreign Keys íntegras</span>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900/80 px-2 py-1 font-mono text-[11px] text-zinc-300">
              {result.stats.executionTimeMs} ms
            </div>
          </div>
        )}
      </header>

      {/* Contenedor Principal Dividido en 2 Paneles */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        {/* ==================== PANEL IZQUIERDO: SQL & CONTROLES ==================== */}
        <section className="flex flex-col border-b border-zinc-800/80 bg-[#0c0c0f] lg:col-span-5 lg:border-b-0 lg:border-r">
          {/* Cabecera del Editor SQL */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Esquema PostgreSQL (DDL)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSqlInput(ECOMMERCE_SAMPLE_SQL);
                setSeed((s) => s + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            >
              <RotateCcw className="h-3 w-3" />
              Restaurar Demo E-Commerce
            </button>
          </div>

          {/* Textarea de Código SQL */}
          <div className="relative flex-1 p-4">
            <textarea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              spellCheck={false}
              placeholder="Pega tus sentencias CREATE TABLE de PostgreSQL aquí..."
              className="h-[340px] w-full resize-none rounded-lg border border-zinc-800 bg-[#070709] p-4 font-mono text-xs leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 lg:h-[400px]"
            />
          </div>

          {/* Controles de Configuración */}
          <div className="space-y-4 border-t border-zinc-800/80 bg-[#101014] p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Selector de País / Localización */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                  <Globe className="h-3.5 w-3.5 text-emerald-400" />
                  País / Localización
                </label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as SupportedLocale)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.flag} {opt.label} ({opt.currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cantidad de Filas por Tabla */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-1.5 font-medium text-zinc-300">
                    <Hash className="h-3.5 w-3.5 text-emerald-400" />
                    Filas por tabla
                  </label>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                    {rowsPerTable} filas
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={100}
                  value={rowsPerTable}
                  onChange={(e) => setRowsPerTable(Number(e.target.value))}
                  className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500"
                />
              </div>
            </div>

            {/* Semilla Determinística + Toggle de IA */}
            <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Seed determinístico (Reproducibilidad)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 1)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 99999))}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    title="Nueva semilla aleatoria"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => setUseAiEnrichment((v) => !v)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                    useAiEnrichment
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    AI Structured Outputs
                  </span>
                  <span className="font-mono text-[10px] uppercase">
                    {useAiEnrichment ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Mensaje de Error si el SQL falla */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón Principal de Ejecución */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {isGenerating
                ? 'Resolviendo DAG y generando datos...'
                : 'Generar Datos Sintéticos (Staging)'}
            </button>
          </div>
        </section>

        {/* ==================== PANEL DERECHO: VISTA PREVIA & EXPORTACIÓN ==================== */}
        <section className="flex flex-col bg-[#09090b] lg:col-span-7">
          {/* Barra de Orden Topológico (DAG Pipeline) */}
          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-[#0d0d11] px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                  <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
                  Orden Topológico (FK Safe):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {result.schema.executionOrder.map((tableName, idx) => (
                    <React.Fragment key={tableName}>
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                        <span className="text-emerald-400">{idx + 1}.</span>
                        {tableName}
                      </span>
                      {idx < result.schema.executionOrder.length - 1 && (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Botones de Descarga (.sql / .json) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile('sql')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar .SQL
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile('json')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                >
                  <FileJson className="h-3.5 w-3.5 text-amber-400" />
                  Exportar .JSON
                </button>
              </div>
            </div>
          )}

          {/* Selector de Tablas y Modo de Vista (Tabla / SQL / JSON) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-5 py-2.5">
            {/* Pestañas de Tablas */}
            <div className="flex flex-wrap items-center gap-1.5">
              {result?.schema.tables.map((table) => {
                const isSelected = table.name === activeTable && viewMode === 'table';
                return (
                  <button
                    key={table.name}
                    type="button"
                    onClick={() => {
                      setActiveTable(table.name);
                      setViewMode('table');
                    }}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs transition ${
                      isSelected
                        ? 'bg-zinc-800 font-semibold text-emerald-400 ring-1 ring-emerald-500/40'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    {table.name}
                    <span className="rounded bg-zinc-950 px-1.5 py-0.2 text-[10px] text-zinc-400">
                      {result.data[table.name]?.length ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Conmutador de Vista: Tabla | Sentencias SQL | JSON */}
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-md px-2.5 py-1 transition ${
                  viewMode === 'table'
                    ? 'bg-zinc-800 font-medium text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tabla
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sql')}
                className={`rounded-md px-2.5 py-1 font-mono transition ${
                  viewMode === 'sql'
                    ? 'bg-zinc-800 font-medium text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                INSERT .SQL
              </button>
              <button
                type="button"
                onClick={() => setViewMode('json')}
                className={`rounded-md px-2.5 py-1 font-mono transition ${
                  viewMode === 'json'
                    ? 'bg-zinc-800 font-medium text-amber-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                .JSON
              </button>
            </div>
          </div>

          {/* Área de Contenido de Vista Previa */}
          <div className="flex-1 overflow-auto p-5">
            {!result ? (
              <div className="flex h-64 items-center justify-center text-xs text-zinc-500">
                Ejecuta el generador para previsualizar las filas sintéticas...
              </div>
            ) : viewMode === 'table' && currentTableMeta ? (
              <div className="space-y-3">
                {/* Metadatos de Relaciones de la Tabla Activa */}
                {currentTableMeta.foreignKeys.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2 text-xs text-emerald-300">
                    <Link2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-medium">Integridad Referencial Activa:</span>
                    {currentTableMeta.foreignKeys.map((fk) => (
                      <span
                        key={fk.columnName}
                        className="rounded border border-emerald-500/30 bg-zinc-950/90 px-2 py-0.5 font-mono text-[11px]"
                      >
                        {currentTableMeta.name}.{fk.columnName} → {fk.referencedTable}.
                        {fk.referencedColumn}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tabla de Datos Generados */}
                <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#0d0d10]">
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/70 text-[11px] text-zinc-400">
                        {currentTableMeta.columns.map((col) => (
                          <th key={col.name} className="whitespace-nowrap px-3.5 py-2.5 font-semibold">
                            <div className="flex items-center gap-1.5">
                              {col.isPrimaryKey && (
                                <span
                                  title="Primary Key"
                                  className="inline-flex items-center rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-400"
                                >
                                  <KeyRound className="h-3 w-3" />
                                </span>
                              )}
                              {col.foreignKey && (
                                <span
                                  title={`Foreign Key -> ${col.foreignKey.table}.${col.foreignKey.column}`}
                                  className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400"
                                >
                                  <Link2 className="h-3 w-3" />
                                  FK
                                </span>
                              )}
                              <span className="text-zinc-200">{col.name}</span>
                              <span className="text-[10px] font-normal text-zinc-500">
                                {col.dataType}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {currentTableRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="transition-colors hover:bg-zinc-900/50"
                        >
                          {currentTableMeta.columns.map((col) => {
                            const val = row[col.name];
                            return (
                              <td
                                key={col.name}
                                className="max-w-[260px] truncate whitespace-nowrap px-3.5 py-2 text-zinc-300"
                              >
                                {val === null ? (
                                  <span className="italic text-zinc-600">NULL</span>
                                ) : typeof val === 'boolean' ? (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                                      val
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {String(val)}
                                  </span>
                                ) : col.foreignKey ? (
                                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                                    {String(val)}
                                  </span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Vista Previa de Código Crudo (.SQL o .JSON) */
              <div className="relative rounded-lg border border-zinc-800 bg-[#070709]">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                  <span className="font-mono text-xs text-zinc-400">
                    {viewMode === 'sql'
                      ? `seedforge_${locale}_inserts.sql`
                      : `seedforge_${locale}_dataset.json`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyContent(viewMode === 'sql' ? 'sql' : 'json')}
                    className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    {copiedType === viewMode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar al portapapeles
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-300">
                  {viewMode === 'sql' ? result.sqlOutput : result.jsonOutput}
                </pre>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
