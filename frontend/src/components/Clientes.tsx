import { useEffect, useState } from "react";
import {
  listClientesAdmin,
  listCentros,
  conectarDueno,
  desvincularContador,
  type ClienteAdmin,
  type Centro,
} from "../db";
import CamionRow from "./CamionRow";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Vista del CONTADOR: conecta a sus clientes (dueños de flota) por correo y ve
// la flota en SOLO LECTURA. El dueño administra sus camiones y conductores; el
// contador lleva la contabilidad y solo puede "quitar de mi gestión".
export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [emailDueno, setEmailDueno] = useState("");
  const [duenoMsg, setDuenoMsg] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  const cargar = () =>
    listClientesAdmin()
      .then(setClientes)
      .catch((e) => setError(e.message));

  useEffect(() => {
    cargar();
  }, []);

  const conectar = async () => {
    if (!emailDueno.trim()) return;
    setConectando(true);
    setDuenoMsg(null);
    try {
      const clienteId = await conectarDueno(emailDueno);
      if (!clienteId) {
        setDuenoMsg("Ese correo no está registrado como Dueño. Pídele que cree su cuenta (rol Dueño).");
        return;
      }
      setEmailDueno("");
      await cargar();
      setExpandido(clienteId);
    } catch (e: any) {
      setDuenoMsg(e?.code === "23505" ? "Ese dueño ya tiene una flota asignada." : e.message);
    } finally {
      setConectando(false);
    }
  };

  const desvincular = async (id: string) => {
    if (!confirm("¿Quitar este cliente de tu gestión? Seguirá existiendo para su dueño.")) return;
    setError(null);
    try {
      await desvincularContador(id);
      setClientes((xs) => (xs ?? []).filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Clientes</h1>
      <p className="mt-1 text-sm text-haze-400">
        Conecta a tus clientes (dueños de flota) por correo. Ellos administran sus camiones y
        conductores; tú llevas su contabilidad.
      </p>

      {/* Conectar un dueño */}
      <div className="mt-6 rounded-xl border border-iris/30 bg-iris/5 p-4">
        <h2 className="text-sm font-semibold text-haze-100">Conectar un cliente</h2>
        <p className="mt-0.5 text-xs text-haze-500">
          Escribe el correo del dueño (registrado). Se conecta a su flota y verás sus camiones.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className={inputCls}
            type="email"
            placeholder="correo del dueño"
            value={emailDueno}
            onChange={(e) => setEmailDueno(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") conectar();
            }}
          />
          <button
            onClick={conectar}
            disabled={conectando}
            className="shrink-0 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60"
          >
            {conectando ? "Conectando…" : "Conectar"}
          </button>
        </div>
        {duenoMsg && <p className="mt-2 text-xs text-pending">{duenoMsg}</p>}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      {!clientes && !error && (
        <div className="mt-10 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {clientes && clientes.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-plum-700 px-4 py-8 text-center text-sm text-haze-500">
          Aún no tienes clientes. Conecta uno por su correo arriba.
        </p>
      )}

      {clientes && clientes.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {clientes.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              expanded={expandido === c.id}
              onToggle={() => setExpandido((id) => (id === c.id ? null : c.id))}
              onDesvincular={() => desvincular(c.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Tarjeta de cliente (solo lectura): dueño + camiones con sus conductores
// --------------------------------------------------------------------------- //
function ClienteCard({
  cliente,
  expanded,
  onToggle,
  onDesvincular,
}: {
  cliente: ClienteAdmin;
  expanded: boolean;
  onToggle: () => void;
  onDesvincular: () => void;
}) {
  const [centros, setCentros] = useState<Centro[] | null>(null);
  const numCamiones = centros?.length ?? cliente.num_camiones ?? 0;

  useEffect(() => {
    if (expanded && centros === null) {
      listCentros(cliente.id).then(setCentros).catch(() => {});
    }
  }, [expanded, centros, cliente.id]);

  return (
    <li className="rounded-xl border border-plum-700 bg-plum-900/50 shadow-panel">
      <div className="flex items-center justify-between gap-3 p-4">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-haze-500 transition ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span className="min-w-0">
            <span className="block truncate font-medium text-haze-50">{cliente.nombre}</span>
            <span className="block text-xs text-haze-500">
              {cliente.nit ? `NIT ${cliente.nit}` : "sin NIT"}
              {` · 🚚 ${numCamiones} ${numCamiones === 1 ? "camión" : "camiones"}`}
              {cliente.propietario_nombre ? ` · Dueño: ${cliente.propietario_nombre}` : " · sin dueño"}
            </span>
          </span>
        </button>
        {cliente.propietario_id && (
          <button
            onClick={onDesvincular}
            className="shrink-0 text-xs text-haze-500 transition hover:text-iris"
            title="Dejar de gestionar (no borra; le queda al dueño)"
          >
            quitar de mi gestión
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-plum-700 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-haze-500">Camiones</span>
          {centros === null ? (
            <p className="mt-2 text-xs text-haze-500">Cargando…</p>
          ) : centros.length === 0 ? (
            <p className="mt-2 text-xs text-haze-500">El dueño aún no ha registrado camiones.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {centros.map((c) => (
                <CamionRow key={c.id} centro={c} readOnly />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
