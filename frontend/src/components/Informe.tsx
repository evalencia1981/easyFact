import { useEffect, useMemo, useState } from "react";
import {
  listFacturas,
  listClientesAdmin,
  actualizarEmpresa,
  type FacturaRow,
  type ClienteAdmin,
} from "../db";
import { pesos } from "../api";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-2.5 py-1.5 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Una fila del informe = un dueño (empresa/flota) con su valor acumulado en el año.
interface Fila extends ClienteAdmin {
  valor_acumulado: number;
  deducible: number;
  no_deducible: number;
  num_facturas: number;
}

// INFORME ANUAL por dueño de camión: identificación de la empresa
// (NOMBRE, NIT, DIRECCION, CIUDAD, CODIGO) + VALOR ACUMULADO del año, con
// desglose deducible / no deducible. Exportable a CSV.
export default function Informe({ onVerFacturas }: { onVerFacturas: (clienteId: string, anio: number) => void }) {
  const [facturas, setFacturas] = useState<FacturaRow[] | null>(null);
  const [clientes, setClientes] = useState<ClienteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anio, setAnio] = useState<number>(new Date().getFullYear());

  const cargar = () =>
    Promise.all([listFacturas(), listClientesAdmin()])
      .then(([f, c]) => {
        setFacturas(f);
        setClientes(c);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    cargar();
  }, []);

  // Años con facturas reportadas (más el año actual), para el selector.
  const anios = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const f of facturas ?? []) set.add(new Date(f.created_at).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [facturas]);

  // Acumula por dueño las facturas del año (por fecha de reporte = created_at).
  const filas = useMemo<Fila[]>(() => {
    if (!facturas || !clientes) return [];
    const acc = new Map<string, { total: number; ded: number; noDed: number; n: number }>();
    for (const f of facturas) {
      if (new Date(f.created_at).getFullYear() !== anio) continue;
      const cur = acc.get(f.cliente_id) ?? { total: 0, ded: 0, noDed: 0, n: 0 };
      const monto = f.total || 0;
      cur.total += monto;
      if (f.deducible) cur.ded += monto;
      else cur.noDed += monto;
      cur.n += 1;
      acc.set(f.cliente_id, cur);
    }
    return clientes
      .map((c) => {
        const a = acc.get(c.id);
        return {
          ...c,
          valor_acumulado: a?.total ?? 0,
          deducible: a?.ded ?? 0,
          no_deducible: a?.noDed ?? 0,
          num_facturas: a?.n ?? 0,
        };
      })
      .sort((x, y) => y.valor_acumulado - x.valor_acumulado);
  }, [facturas, clientes, anio]);

  const totalGeneral = filas.reduce((s, f) => s + f.valor_acumulado, 0);
  const totalDed = filas.reduce((s, f) => s + f.deducible, 0);
  const totalNoDed = filas.reduce((s, f) => s + f.no_deducible, 0);

  // Guarda dirección/ciudad/NIT editados inline y refresca en memoria.
  const guardarDatos = async (id: string, datos: { nit?: string; direccion?: string; ciudad?: string }) => {
    await actualizarEmpresa(id, datos);
    setClientes((cs) => (cs ?? []).map((c) => (c.id === id ? { ...c, ...datos } : c)));
  };

  const exportarCsv = () => {
    const head = ["NOMBRE EMPRESA", "NIT", "DIRECCION", "CIUDAD", "CODIGO", "VALOR ACUMULADO", "DEDUCIBLE", "NO DEDUCIBLE"];
    const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lineas = filas.map((f) =>
      [f.nombre, f.nit, f.direccion, f.ciudad, "", f.valor_acumulado, f.deducible, f.no_deducible].map(esc).join(",")
    );
    const csv = [head.map(esc).join(","), ...lineas].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-anual-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cargando = facturas === null || clientes === null;

  return (
    <div className="mx-auto min-h-full w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-haze-50">Informe anual</h1>
          <p className="mt-1 text-sm text-haze-400">Valor acumulado por dueño de camión (empresa).</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={`${inputCls} w-auto`}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={exportarCsv}
            disabled={filas.length === 0}
            className="rounded-xl bg-iris px-4 py-2 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      {cargando && !error && (
        <div className="mt-10 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {!cargando && filas.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-plum-700 px-4 py-8 text-center text-sm text-haze-500">
          No hay clientes para reportar todavía.
        </p>
      )}

      {!cargando && filas.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-plum-700 bg-plum-900/50 shadow-panel">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-plum-700 text-left text-[11px] uppercase tracking-wide text-haze-500">
                <th className="px-3 py-2.5 font-semibold">Nombre empresa</th>
                <th className="px-3 py-2.5 font-semibold">NIT</th>
                <th className="px-3 py-2.5 font-semibold">Dirección</th>
                <th className="px-3 py-2.5 font-semibold">Ciudad</th>
                <th className="px-3 py-2.5 font-semibold">Código</th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor acumulado</th>
                <th className="px-3 py-2.5 text-right font-semibold">Deducible</th>
                <th className="px-3 py-2.5 text-right font-semibold">No deducible</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <FilaInforme
                  key={f.id}
                  fila={f}
                  onGuardar={guardarDatos}
                  onVerFacturas={() => onVerFacturas(f.id, anio)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-iris/30 bg-iris/5 font-semibold text-haze-100">
                <td className="px-3 py-2.5" colSpan={5}>
                  Total general · {filas.reduce((s, f) => s + f.num_facturas, 0)} facturas
                </td>
                <td className="px-3 py-2.5 text-right text-iris">{pesos(totalGeneral)}</td>
                <td className="px-3 py-2.5 text-right text-matched">{pesos(totalDed)}</td>
                <td className="px-3 py-2.5 text-right text-pending">{pesos(totalNoDed)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Fila editable: NIT/Dirección/Ciudad se pueden completar inline (faltan a menudo)
// --------------------------------------------------------------------------- //
function FilaInforme({
  fila,
  onGuardar,
  onVerFacturas,
}: {
  fila: Fila;
  onGuardar: (id: string, datos: { nit?: string; direccion?: string; ciudad?: string }) => Promise<void>;
  onVerFacturas: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nit, setNit] = useState(fila.nit);
  const [direccion, setDireccion] = useState(fila.direccion);
  const [ciudad, setCiudad] = useState(fila.ciudad);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const abrir = () => {
    setNit(fila.nit);
    setDireccion(fila.direccion);
    setCiudad(fila.ciudad);
    setErr(null);
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setErr(null);
    try {
      await onGuardar(fila.id, { nit, direccion, ciudad });
      setEditando(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <tr className="border-b border-plum-700/60 bg-plum-950/30">
        <td className="px-3 py-2 align-top font-medium text-haze-100">{fila.nombre}</td>
        <td className="px-3 py-2 align-top">
          <input className={inputCls} value={nit} onChange={(e) => setNit(e.target.value)} placeholder="NIT" />
        </td>
        <td className="px-3 py-2 align-top">
          <input className={inputCls} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección" />
        </td>
        <td className="px-3 py-2 align-top">
          <input className={inputCls} value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ciudad" />
        </td>
        <td className="px-3 py-2 align-top text-haze-600">—</td>
        <td className="px-3 py-2 align-top text-right text-haze-200">{pesos(fila.valor_acumulado)}</td>
        <td className="px-3 py-2 align-top" colSpan={2}>
          <div className="flex items-center justify-end gap-2">
            {err && <span className="text-[11px] text-pending">{err}</span>}
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-iris px-3 py-1 text-xs font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60"
            >
              {guardando ? "…" : "Guardar"}
            </button>
            <button onClick={() => setEditando(false)} className="text-xs text-haze-400 transition hover:text-iris">
              cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const falta = (v: string) => (v ? <span className="text-haze-200">{v}</span> : <span className="text-haze-600">—</span>);

  return (
    <tr className="border-b border-plum-700/60 transition hover:bg-plum-950/30">
      <td className="px-3 py-2.5 font-medium text-haze-50">
        {fila.nombre}
        {fila.num_facturas > 0 ? (
          <button
            onClick={onVerFacturas}
            title="Ver estas facturas"
            className="ml-2 rounded-md border border-plum-600 bg-plum-950/60 px-2 py-0.5 text-[11px] font-normal text-haze-400 transition hover:border-iris hover:text-iris"
          >
            {fila.num_facturas} {fila.num_facturas === 1 ? "factura" : "facturas"} →
          </button>
        ) : (
          <span className="ml-2 text-[11px] font-normal text-haze-600">sin facturas</span>
        )}
      </td>
      <td className="px-3 py-2.5">{falta(fila.nit)}</td>
      <td className="px-3 py-2.5">{falta(fila.direccion)}</td>
      <td className="px-3 py-2.5">{falta(fila.ciudad)}</td>
      <td className="px-3 py-2.5 text-haze-600">—</td>
      <td className="px-3 py-2.5 text-right font-semibold text-iris">{pesos(fila.valor_acumulado)}</td>
      <td className="px-3 py-2.5 text-right text-matched">{pesos(fila.deducible)}</td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-pending">{pesos(fila.no_deducible)}</span>
          <button
            onClick={abrir}
            title="Completar NIT / dirección / ciudad"
            className="rounded-md border border-plum-600 bg-plum-950/60 px-2 py-0.5 text-[11px] text-haze-400 transition hover:border-iris hover:text-iris"
          >
            editar
          </button>
        </div>
      </td>
    </tr>
  );
}
