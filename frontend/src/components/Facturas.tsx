import { useEffect, useMemo, useState } from "react";
import {
  listFacturas,
  listClientes,
  listCentros,
  listLiquidaciones,
  setFacturaDeducible,
  type FacturaRow,
  type Cliente,
  type Centro,
  type LiquidacionRow,
} from "../db";
import { pesos } from "../api";
import { useAuth } from "../auth";

const inputCls =
  "rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition focus:border-iris focus:shadow-glow";

// Lista de facturas guardadas (RLS filtra según el rol del usuario) + filtros
// por cliente/camión y total acumulado del resultado.
export default function Facturas() {
  const { profile } = useAuth();
  // La deducibilidad es trabajo contable: solo el contador la ve y la marca.
  const esContador = (profile?.role ?? "contador") === "contador";
  const [rows, setRows] = useState<FacturaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<FacturaRow | null>(null);

  const toggleDeducible = async (f: FacturaRow) => {
    if (!esContador) return;
    const nuevo = !f.deducible;
    try {
      await setFacturaDeducible(f.id, nuevo);
      setRows((rs) => (rs ?? []).map((x) => (x.id === f.id ? { ...x, deducible: nuevo } : x)));
      setDetalle((d) => (d && d.id === f.id ? { ...d, deducible: nuevo } : d));
    } catch (e: any) {
      setError(e.message);
    }
  };
  const [liqMap, setLiqMap] = useState<Map<string, LiquidacionRow>>(new Map());

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [centroFiltro, setCentroFiltro] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [dedFiltro, setDedFiltro] = useState<"todos" | "si" | "no">("todos");

  // Atajo: rango = mes actual (offset 0) o mes pasado (offset -1).
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const presetMes = (offset: number) => {
    const now = new Date();
    setDesde(ymd(new Date(now.getFullYear(), now.getMonth() + offset, 1)));
    setHasta(ymd(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)));
  };
  const limpiar = () => {
    setClienteFiltro("");
    setCentroFiltro("");
    setDesde("");
    setHasta("");
    setDedFiltro("todos");
  };
  const hayFiltro = clienteFiltro || centroFiltro || desde || hasta || dedFiltro !== "todos";

  useEffect(() => {
    listFacturas().then(setRows).catch((e) => setError(e.message));
    listClientes().then(setClientes).catch(() => {});
    // Liquidación por viaje (anticipo/gastos) para cruzar en cada factura.
    listLiquidaciones()
      .then((ls) => setLiqMap(new Map(ls.map((l) => [l.manifiesto_id, l]))))
      .catch(() => {});
  }, []);

  // Camiones del cliente filtrado (para el segundo desplegable).
  useEffect(() => {
    setCentroFiltro("");
    if (!clienteFiltro) {
      setCentros([]);
      return;
    }
    listCentros(clienteFiltro).then(setCentros).catch(() => {});
  }, [clienteFiltro]);

  const filtradas = useMemo(
    () =>
      (rows ?? []).filter((f) => {
        if (clienteFiltro && f.cliente_id !== clienteFiltro) return false;
        if (centroFiltro && f.centro_costos_id !== centroFiltro) return false;
        if (dedFiltro === "si" && !f.deducible) return false;
        if (dedFiltro === "no" && f.deducible) return false;
        const d = f.created_at.slice(0, 10); // YYYY-MM-DD
        if (desde && d < desde) return false;
        if (hasta && d > hasta) return false;
        return true;
      }),
    [rows, clienteFiltro, centroFiltro, desde, hasta, dedFiltro]
  );

  const total = filtradas.reduce((s, f) => s + (f.total || 0), 0);
  const totalDeducible = filtradas.filter((f) => f.deducible).reduce((s, f) => s + (f.total || 0), 0);
  const totalNoDeducible = total - totalDeducible;
  const monedaResumen = filtradas[0]?.moneda || "COP";

  // Desglose por cliente (solo cuando se ven todos los clientes).
  const porCliente = useMemo(() => {
    if (clienteFiltro) return [];
    const map = new Map<string, { id: string; nombre: string; total: number; count: number }>();
    for (const f of filtradas) {
      const cur = map.get(f.cliente_id) ?? {
        id: f.cliente_id,
        nombre: f.cliente?.nombre || "—",
        total: 0,
        count: 0,
      };
      cur.total += f.total || 0;
      cur.count += 1;
      map.set(f.cliente_id, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtradas, clienteFiltro]);

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Facturas guardadas</h1>
      <p className="mt-1 text-sm text-haze-400">Lo que tú y tu equipo han capturado.</p>

      {/* Filtros */}
      {rows && rows.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-plum-700 bg-plum-900/50 p-3">
          {/* Fila 1: cliente y camión */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className={`${inputCls} flex-1`}
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <select
              className={`${inputCls} flex-1`}
              value={centroFiltro}
              onChange={(e) => setCentroFiltro(e.target.value)}
              disabled={!clienteFiltro}
            >
              <option value="">{clienteFiltro ? "Todos los camiones" : "— elige cliente —"}</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.identificador || c.alias || "(sin placa)"}
                </option>
              ))}
            </select>
          </div>

          {/* Fila 2: rango de fechas + atajos */}
          <div className="flex flex-wrap items-center gap-2 border-t border-plum-700/60 pt-3">
            <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span className="text-xs text-haze-500">a</span>
            <input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <button
              onClick={() => presetMes(0)}
              className="rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-1.5 text-xs text-haze-300 transition hover:border-iris hover:text-iris"
            >
              Este mes
            </button>
            <button
              onClick={() => presetMes(-1)}
              className="rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-1.5 text-xs text-haze-300 transition hover:border-iris hover:text-iris"
            >
              Mes pasado
            </button>

            {/* Filtro deducible (solo contador) */}
            {esContador && (
              <div className="inline-flex rounded-lg border border-plum-600 bg-plum-950/60 p-0.5">
                {([
                  ["todos", "Todas"],
                  ["si", "Deducibles"],
                  ["no", "No deducibles"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setDedFiltro(v)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      dedFiltro === v ? "bg-iris text-plum-950" : "text-haze-400 hover:text-iris"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {hayFiltro && (
              <button onClick={limpiar} className="ml-auto text-xs text-haze-400 transition hover:text-iris hover:underline">
                limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Total: "contabilidad" (todos) o de un cliente; con desglose por cliente */}
      {rows && rows.length > 0 && (
        <div className="mt-3 rounded-xl border border-iris/30 bg-iris/5 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-haze-200">
              {clienteFiltro ? "Total cliente" : "Total contabilidad"}
              <span className="ml-2 text-xs text-haze-500">
                {filtradas.length} {filtradas.length === 1 ? "factura" : "facturas"}
              </span>
            </span>
            <span className="text-base font-semibold text-iris">{pesos(total, monedaResumen)}</span>
          </div>

          {/* Desglose deducible / no deducible (solo contador) */}
          {esContador && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-iris/15 pt-2 text-xs">
              <span className="text-matched">Deducible: {pesos(totalDeducible, monedaResumen)}</span>
              <span className="text-pending">No deducible: {pesos(totalNoDeducible, monedaResumen)}</span>
            </div>
          )}

          {!clienteFiltro && porCliente.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1 border-t border-iris/15 pt-2.5">
              {porCliente.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-haze-400">
                    {c.nombre} <span className="text-haze-600">· {c.count}</span>
                  </span>
                  <span className="shrink-0 font-medium text-haze-200">{pesos(c.total, monedaResumen)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      {!rows && !error && (
        <div className="mt-10 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-plum-700 px-4 py-10 text-center text-sm text-haze-500">
          Aún no hay facturas guardadas. Captura una en la pestaña “Capturar”.
        </p>
      )}

      {rows && rows.length > 0 && filtradas.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-plum-700 px-4 py-8 text-center text-sm text-haze-500">
          Ninguna factura coincide con el filtro.
        </p>
      )}

      {filtradas.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2.5">
          {filtradas.map((f) => (
            <li
              key={f.id}
              className="animate-rise rounded-xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-haze-50">{f.tercero || "Sin tercero"}</p>
                  <p className="mt-0.5 truncate text-xs text-haze-400">
                    {f.cliente?.nombre || "—"}
                    {f.centro_costos?.identificador ? ` · 🚚 ${f.centro_costos.identificador}` : ""}
                    {f.concepto ? ` · ${f.concepto}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-haze-600">
                    {f.fecha || new Date(f.created_at).toLocaleDateString("es-CO")}
                    {f.medio_pago ? ` · ${f.medio_pago}` : ""}
                    {f.numero ? ` · #${f.numero}` : ""}
                  </p>
                  {f.manifiesto_id && liqMap.get(f.manifiesto_id) && (
                    <p className="mt-1 text-[11px] text-iris">
                      🧾 Viaje #{liqMap.get(f.manifiesto_id)!.numero} · gastado{" "}
                      {pesos(liqMap.get(f.manifiesto_id)!.total_gastos)} de{" "}
                      {pesos(liqMap.get(f.manifiesto_id)!.anticipo)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="font-semibold text-iris">{pesos(f.total || 0, f.moneda)}</p>
                  {esContador && (
                    <button
                      onClick={() => toggleDeducible(f)}
                      title="Marcar deducible / no deducible"
                      className={`rounded-full px-2 py-0.5 text-[10px] transition hover:opacity-80 ${
                        f.deducible ? "bg-matched/15 text-matched" : "bg-pending/15 text-pending"
                      }`}
                    >
                      {f.deducible ? "Deducible" : "No deducible"}
                    </button>
                  )}
                  <button
                    onClick={() => setDetalle(f)}
                    className="rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-1 text-xs text-haze-200 transition hover:border-iris hover:text-iris"
                  >
                    Detalle
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {detalle && (
        <DetalleModal
          f={detalle}
          liq={detalle.manifiesto_id ? liqMap.get(detalle.manifiesto_id) : undefined}
          esContador={esContador}
          onToggleDeducible={() => toggleDeducible(detalle)}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Modal de detalle de una factura
// --------------------------------------------------------------------------- //
function DetalleModal({
  f,
  liq,
  esContador,
  onToggleDeducible,
  onClose,
}: {
  f: FacturaRow;
  liq?: LiquidacionRow;
  esContador: boolean;
  onToggleDeducible: () => void;
  onClose: () => void;
}) {
  const items = f.items ?? [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-plum-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg animate-rise rounded-2xl border border-plum-700 bg-plum-900 p-6 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg font-semibold text-haze-50">
              {f.tercero || "Sin tercero"}
            </h2>
            <p className="text-sm text-haze-400">{pesos(f.total || 0, f.moneda)}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-haze-400 transition hover:text-iris" title="Cerrar">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Deducible / no deducible (solo el contador) */}
        {esContador && (
          <button
            onClick={onToggleDeducible}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-80 ${
              f.deducible ? "bg-matched/15 text-matched" : "bg-pending/15 text-pending"
            }`}
            title="Cambiar deducible / no deducible"
          >
            {f.deducible ? "✓ Deducible" : "✕ No deducible"}
            <span className="text-[10px] opacity-70">(cambiar)</span>
          </button>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <Dato k="Tipo" v={f.tipo} />
          <Dato k="Fecha" v={f.fecha} />
          <Dato k="Documento (NIT)" v={f.documento} />
          <Dato k="Número" v={f.numero} />
          <Dato k="Cliente / flota" v={f.cliente?.nombre} />
          <Dato
            k="Camión"
            v={f.centro_costos ? `${f.centro_costos.identificador}${f.centro_costos.alias ? ` · ${f.centro_costos.alias}` : ""}` : f.centro_costos_txt}
          />
          <Dato k="Concepto" v={f.concepto} span />
          <Dato k="Medio de pago" v={f.medio_pago} />
          <Dato k="Confianza" v={f.confianza ? `${Math.round(f.confianza * 100)}%` : ""} />
        </dl>

        {/* Ítems */}
        {items.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-haze-500">Ítems</span>
            <ul className="mt-2 flex flex-col gap-1">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 rounded-lg border border-plum-700 bg-plum-950/40 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-haze-200">
                    {it.descripcion}
                    {it.cantidad ? <span className="text-haze-500"> ×{it.cantidad}</span> : null}
                  </span>
                  {typeof it.total_linea === "number" && (
                    <span className="shrink-0 text-haze-300">{pesos(it.total_linea, f.moneda)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Totales */}
        <div className="mt-4 space-y-1 border-t border-plum-700 pt-3 text-sm">
          <Total k="Subtotal" v={pesos(f.subtotal || 0, f.moneda)} />
          <Total k="Impuestos" v={pesos(f.impuestos || 0, f.moneda)} />
          <Total k="Total" v={pesos(f.total || 0, f.moneda)} fuerte />
        </div>

        {/* Liquidación del viaje al que pertenece la factura */}
        {liq && (
          <div className="mt-4 rounded-lg border border-iris/30 bg-iris/5 p-3">
            <p className="text-xs font-semibold text-haze-200">
              Viaje #{liq.numero}
              {(liq.origen || liq.destino) && (
                <span className="font-normal text-haze-400">
                  {" "}· {liq.origen || "—"} → {liq.destino || "—"}
                </span>
              )}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-[11px] text-haze-500">Anticipo</p>
                <p className="font-medium text-haze-100">{pesos(liq.anticipo)}</p>
              </div>
              <div>
                <p className="text-[11px] text-haze-500">Gastado</p>
                <p className="font-medium text-haze-100">{pesos(liq.total_gastos)}</p>
              </div>
              <div>
                <p className="text-[11px] text-haze-500">{liq.saldo < 0 ? "Sobregirado" : "Disponible"}</p>
                <p className={`font-semibold ${liq.saldo < 0 ? "text-pending" : "text-matched"}`}>
                  {pesos(Math.abs(liq.saldo))}
                </p>
              </div>
            </div>
          </div>
        )}

        {f.notas && (
          <p className="mt-3 rounded-lg border border-plum-700 bg-plum-950/40 px-3 py-2 text-xs text-haze-300">
            <span className="text-haze-500">Notas: </span>
            {f.notas}
          </p>
        )}

        {f.texto_crudo && (
          <details className="mt-3 rounded-lg border border-plum-700 bg-plum-950/40">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-haze-400">
              Transcripción literal
            </summary>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-3 font-mono text-xs text-haze-300">
              {f.texto_crudo}
            </pre>
          </details>
        )}

        <p className="mt-3 text-right text-[11px] text-haze-600">
          Capturada el {new Date(f.created_at).toLocaleString("es-CO")}
        </p>
      </div>
    </div>
  );
}

function Dato({ k, v, span }: { k: string; v?: string | null; span?: boolean }) {
  if (!v) return null;
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="text-[11px] text-haze-500">{k}</dt>
      <dd className="text-haze-100">{v}</dd>
    </div>
  );
}

function Total({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-haze-500">{k}</span>
      <span className={fuerte ? "font-semibold text-iris" : "text-haze-200"}>{v}</span>
    </div>
  );
}
