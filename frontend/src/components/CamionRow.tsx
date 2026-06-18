import { useEffect, useState } from "react";
import {
  conductoresDeCentro,
  buscarConductor,
  asignarConductor,
  desasignarConductor,
  type Centro,
  type ConductorAsignado,
} from "../db";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Fila de un camión: placa/alias + conductores asignados (para que ellos suban
// facturas). Asignar es por correo; el conductor debe estar registrado.
export default function CamionRow({ centro, onDelete }: { centro: Centro; onDelete: () => void }) {
  const [conductores, setConductores] = useState<ConductorAsignado[] | null>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [asignando, setAsignando] = useState(false);

  const cargar = () =>
    conductoresDeCentro(centro.id)
      .then(setConductores)
      .catch((e) => setMsg(e.message));

  useEffect(() => {
    cargar();
  }, [centro.id]);

  const asignar = async () => {
    if (!email.trim()) return;
    setAsignando(true);
    setMsg(null);
    try {
      const c = await buscarConductor(email);
      if (!c) {
        setMsg("Ese correo no está registrado como Conductor. Pídele que cree su cuenta (rol Conductor).");
        return;
      }
      await asignarConductor(centro.id, c.id);
      setEmail("");
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
        {conductores === null ? (
          <span className="text-[11px] text-haze-600">Cargando conductores…</span>
        ) : conductores.length === 0 ? (
          <span className="text-[11px] text-haze-500">Sin conductor asignado</span>
        ) : (
          conductores.map((c) => (
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

      {/* Asignar por correo */}
      <div className="mt-2 flex gap-2">
        <input
          className={inputCls}
          type="email"
          placeholder="correo del conductor (registrado)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={asignar}
          disabled={asignando}
          className="shrink-0 rounded-lg border border-plum-600 px-3 text-sm text-iris transition hover:border-iris disabled:opacity-50"
        >
          {asignando ? "…" : "Asignar"}
        </button>
      </div>

      {msg && <p className="mt-1.5 text-[11px] text-pending">{msg}</p>}
    </li>
  );
}
