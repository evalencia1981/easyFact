import { useEffect, useState } from "react";
import {
  listClientesAdmin,
  createCliente,
  deleteCliente,
  listCentros,
  createCentro,
  deleteCentro,
  buscarPropietario,
  vincularPropietario,
  type ClienteAdmin,
  type Centro,
} from "../db";
import { useAuth } from "../auth";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Gestión de clientes (flotas), sus camiones y su dueño vinculado.
export default function Clientes() {
  const { profile } = useAuth();
  const esContador = (profile?.role ?? "contador") === "contador";
  const [clientes, setClientes] = useState<ClienteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [nit, setNit] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const cargar = () =>
    listClientesAdmin()
      .then(setClientes)
      .catch((e) => setError(e.message));

  useEffect(() => {
    cargar();
  }, []);

  const agregar = async () => {
    if (!nombre.trim()) return;
    setError(null);
    try {
      await createCliente(nombre.trim(), nit.trim());
      setNombre("");
      setNit("");
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const borrar = async (id: string) => {
    if (!confirm("¿Eliminar este cliente y todos sus camiones y facturas?")) return;
    setError(null);
    try {
      await deleteCliente(id);
      setClientes((xs) => (xs ?? []).filter((c) => c.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Clientes y camiones</h1>
      <p className="mt-1 text-sm text-haze-400">
        Da de alta tus clientes (flotas), sus camiones y el dueño de cada flota.
      </p>

      {/* Alta de cliente */}
      <div className="mt-6 flex flex-col gap-2 rounded-xl border border-plum-700 bg-plum-900/50 p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-haze-500">Nuevo cliente / flota</span>
          <input className={inputCls} placeholder="ej. Transportes López" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 sm:w-44">
          <span className="text-xs font-medium text-haze-500">NIT (opcional)</span>
          <input className={inputCls} placeholder="900.123.456" value={nit} onChange={(e) => setNit(e.target.value)} />
        </label>
        <button
          onClick={agregar}
          className="rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright"
        >
          Agregar
        </button>
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
          Aún no tienes clientes. Crea el primero arriba.
        </p>
      )}

      {clientes && clientes.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {clientes.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              esContador={esContador}
              expanded={expandido === c.id}
              onToggle={() => setExpandido((id) => (id === c.id ? null : c.id))}
              onDelete={() => borrar(c.id)}
              onChanged={cargar}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Tarjeta de cliente: dueño vinculado + camiones (carga al expandir)
// --------------------------------------------------------------------------- //
function ClienteCard({
  cliente,
  esContador,
  expanded,
  onToggle,
  onDelete,
  onChanged,
}: {
  cliente: ClienteAdmin;
  esContador: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [centros, setCentros] = useState<Centro[] | null>(null);
  const [placa, setPlaca] = useState("");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Vincular dueño
  const [emailDueno, setEmailDueno] = useState("");
  const [duenoMsg, setDuenoMsg] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    if (expanded && centros === null) {
      listCentros(cliente.id)
        .then(setCentros)
        .catch((e) => setError(e.message));
    }
  }, [expanded, centros, cliente.id]);

  const agregar = async () => {
    if (!placa.trim()) return;
    setError(null);
    try {
      const c = await createCentro(cliente.id, placa.trim(), alias.trim());
      setCentros((xs) => [...(xs ?? []), c]);
      setPlaca("");
      setAlias("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const borrar = async (id: string) => {
    setError(null);
    try {
      await deleteCentro(id);
      setCentros((xs) => (xs ?? []).filter((c) => c.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const vincular = async () => {
    if (!emailDueno.trim()) return;
    setVinculando(true);
    setDuenoMsg(null);
    try {
      const dueno = await buscarPropietario(emailDueno);
      if (!dueno) {
        setDuenoMsg("Ese correo no está registrado como Dueño. Pídele que cree su cuenta (rol Dueño) y vuelve a vincular.");
        return;
      }
      await vincularPropietario(cliente.id, dueno.id);
      setEmailDueno("");
      onChanged();
    } catch (e: any) {
      setDuenoMsg(e.message);
    } finally {
      setVinculando(false);
    }
  };

  const desvincular = async () => {
    try {
      await vincularPropietario(cliente.id, null);
      onChanged();
    } catch (e: any) {
      setDuenoMsg(e.message);
    }
  };

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
              {cliente.propietario_nombre ? ` · Dueño: ${cliente.propietario_nombre}` : " · sin dueño"}
            </span>
          </span>
        </button>
        <button onClick={onDelete} className="shrink-0 text-xs text-haze-500 transition hover:text-pending">
          eliminar
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-plum-700 p-4">
          {/* Dueño (solo el contador asigna) */}
          {esContador && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-haze-500">Dueño de la flota</span>
              {cliente.propietario_id ? (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-plum-700 bg-plum-950/40 px-3 py-2">
                  <span className="min-w-0 text-sm text-haze-100">
                    {cliente.propietario_nombre || "Dueño"}
                    {cliente.propietario_email && <span className="text-haze-500"> · {cliente.propietario_email}</span>}
                  </span>
                  <button onClick={desvincular} className="shrink-0 text-xs text-haze-500 transition hover:text-pending">
                    quitar
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className={inputCls}
                    type="email"
                    placeholder="correo del dueño (ya registrado)"
                    value={emailDueno}
                    onChange={(e) => setEmailDueno(e.target.value)}
                  />
                  <button
                    onClick={vincular}
                    disabled={vinculando}
                    className="shrink-0 rounded-lg bg-iris px-4 py-2 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60"
                  >
                    {vinculando ? "…" : "Vincular"}
                  </button>
                </div>
              )}
              {duenoMsg && <p className="mt-2 text-xs text-pending">{duenoMsg}</p>}
            </div>
          )}

          {/* Camiones */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-haze-500">Camiones</span>

            {centros === null ? (
              <p className="mt-2 text-xs text-haze-500">Cargando…</p>
            ) : centros.length === 0 ? (
              <p className="mt-2 text-xs text-haze-500">Sin camiones todavía.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {centros.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-plum-700 bg-plum-950/40 px-3 py-2"
                  >
                    <span className="text-sm text-haze-100">
                      <span className="font-mono">{c.identificador || "(sin placa)"}</span>
                      {c.alias && <span className="text-haze-400"> · {c.alias}</span>}
                    </span>
                    <button onClick={() => borrar(c.id)} className="text-xs text-haze-500 transition hover:text-pending">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-haze-500">Placa</span>
                <input className={inputCls} placeholder="ej. NUU699" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-haze-500">Alias (opcional)</span>
                <input className={inputCls} placeholder="ej. Tractomula 1" value={alias} onChange={(e) => setAlias(e.target.value)} />
              </label>
              <button
                onClick={agregar}
                className="rounded-xl bg-iris px-4 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright"
              >
                Agregar camión
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-pending">{error}</p>}
        </div>
      )}
    </li>
  );
}
