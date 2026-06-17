import { useEffect, useMemo, useState } from "react";
import {
  listFacturas,
  listClientes,
  listCentros,
  type FacturaRow,
  type Cliente,
  type Centro,
} from "../db";
import { pesos } from "../api";

const inputCls =
  "rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition focus:border-iris focus:shadow-glow";

// Lista de facturas guardadas (RLS filtra según el rol del usuario) + filtros
// por cliente/camión y total acumulado del resultado.
export default function Facturas() {
  const [rows, setRows] = useState<FacturaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<FacturaRow | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [centroFiltro, setCentroFiltro] = useState("");

  useEffect(() => {
    listFacturas().then(setRows).catch((e) => setError(e.message));
    listClientes().then(setClientes).catch(() => {});
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
      (rows ?? []).filter(
        (f) =>
          (!clienteFiltro || f.cliente_id === clienteFiltro) &&
          (!centroFiltro || f.centro_costos_id === centroFiltro)
      ),
    [rows, clienteFiltro, centroFiltro]
  );

  const total = filtradas.reduce((s, f) => s + (f.total || 0), 0);
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
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-plum-700 bg-plum-900/50 p-3 sm:flex-row sm:items-center">
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
          {(clienteFiltro || centroFiltro) && (
            <button
              onClick={() => {
                setClienteFiltro("");
                setCentroFiltro("");
              }}
              className="shrink-0 text-xs text-haze-400 transition hover:text-iris hover:underline"
            >
              limpiar
            </button>
          )}
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
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="font-semibold text-iris">{pesos(f.total || 0, f.moneda)}</p>
                  {f.tipo && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${
                        f.tipo === "compra" ? "bg-pending/15 text-pending" : "bg-matched/15 text-matched"
                      }`}
                    >
                      {f.tipo}
                    </span>
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

      {detalle && <DetalleModal f={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Modal de detalle de una factura
// --------------------------------------------------------------------------- //
function DetalleModal({ f, onClose }: { f: FacturaRow; onClose: () => void }) {
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
