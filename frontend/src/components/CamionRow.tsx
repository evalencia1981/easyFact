import { useEffect, useState } from "react";
import {
  listarConductores,
  conductoresDeCentro,
  asignarConductor,
  desasignarConductor,
  type Centro,
  type Conductor,
  type ConductorAsignado,
} from "../db";

// Fila de un camión: placa/alias + conductores asignados (para que ellos suban
// facturas). Se asigna eligiendo de la LISTA de conductores ya registrados.
export default function CamionRow({ centro, onDelete }: { centro: Centro; onDelete: () => void }) {
  const [asignados, setAsignados] = useState<ConductorAsignado[] | null>(null);
  const [disponibles, setDisponibles] = useState<Conductor[]>([]);
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [asignando, setAsignando] = useState(false);

  const cargar = () =>
    conductoresDeCentro(centro.id)
      .then(setAsignados)
      .catch((e) => setMsg(e.message));

  useEffect(() => {
    cargar();
    listarConductores()
      .then(setDisponibles)
      .catch((e) => setMsg(e.message));
  }, [centro.id]);

  // Conductores que aún no están asignados a este camión.
  const sinAsignar = disponibles.filter((d) => !(asignados ?? []).some((a) => a.conductor_id === d.id));

  const asignar = async () => {
    if (!sel) return;
    setAsignando(true);
    setMsg(null);
    try {
      await asignarConductor(centro.id, sel);
      setSel("");
      await cargar();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setAsignando(false);
    }
  };

  const quitar = async (id: string) => {
    setMsg(null);
    try {
      await desasignarConductor(centro.id, id);
      await cargar();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <li className="rounded-lg border border-plum-700 bg-plum-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-haze-100">
          <span className="font-mono">{centro.identificador || "(sin placa)"}</span>
          {centro.alias && <span className="text-haze-400"> · {centro.alias}</span>}
        </span>
        <button onClick={onDelete} className="text-xs text-haze-500 transition hover:text-pending" title="Eliminar camión">
          ✕
        </button>
      </div>

      {/* Conductores asignados */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {asignados === null ? (
          <span className="text-[11px] text-haze-600">Cargando conductores…</span>
        ) : asignados.length === 0 ? (
          <span className="text-[11px] text-haze-500">Sin conductor asignado</span>
        ) : (
          asignados.map((c) => (
            <span
              key={c.conductor_id}
              className="inline-flex items-center gap-1 rounded-full bg-iris/15 px-2 py-0.5 text-[11px] text-iris"
              title={c.email}
            >
              👤 {c.nombre || c.email}
              <button onClick={() => quitar(c.conductor_id)} className="text-iris/70 hover:text-pending" title="Quitar">
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      {/* Asignar eligiendo de los conductores registrados */}
      {sinAsignar.length > 0 ? (
        <div className="mt-2 flex gap-2">
          <select
            className="w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition focus:border-iris focus:shadow-glow"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            <option value="">— elige un conductor —</option>
            {sinAsignar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre ? `${d.nombre} · ${d.email}` : d.email}
              </option>
            ))}
          </select>
          <button
            onClick={asignar}
            disabled={asignando || !sel}
            className="shrink-0 rounded-lg border border-plum-600 px-3 text-sm text-iris transition hover:border-iris disabled:opacity-50"
          >
            {asignando ? "…" : "Asignar"}
          </button>
        </div>
      ) : (
        asignados !== null && (
          <p className="mt-2 text-[11px] text-haze-600">
            {disponibles.length === 0
              ? "No hay conductores registrados todavía."
              : "Todos los conductores registrados ya están asignados a este camión."}
          </p>
        )
      )}

      {msg && <p className="mt-1.5 text-[11px] text-pending">{msg}</p>}
    </li>
  );
}
