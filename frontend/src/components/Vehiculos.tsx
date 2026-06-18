import { useEffect, useState } from "react";
import {
  listClientesAdmin,
  createCliente,
  listCentros,
  createCentro,
  deleteCentro,
  type ClienteAdmin,
  type Centro,
} from "../db";
import { useAuth } from "../auth";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Vista del DUEÑO: él es su propia flota, así que aquí administra sus vehículos
// (camiones) directamente. Si aún no tiene flota, la crea una vez.
export default function Vehiculos() {
  const { profile } = useAuth();
  const [flotas, setFlotas] = useState<ClienteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");

  const cargar = () =>
    listClientesAdmin()
      .then(setFlotas)
      .catch((e) => setError(e.message));

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (profile?.nombre) setNombre((n) => n || profile.nombre);
  }, [profile]);

  const crearFlota = async () => {
    if (!nombre.trim()) return;
    setError(null);
    try {
      await createCliente(nombre.trim());
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Mis vehículos</h1>
      <p className="mt-1 text-sm text-haze-400">Administra los camiones de tu flota.</p>

      {error && (
        <p className="mt-4 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      {!flotas && !error && (
        <div className="mt-10 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {flotas && flotas.length === 0 && (
        <div className="mt-6 rounded-xl border border-plum-700 bg-plum-900/50 p-4">
          <h2 className="text-sm font-semibold text-haze-100">Crea tu flota</h2>
          <p className="mt-0.5 text-xs text-haze-500">Un nombre para tu flota; luego agregas tus camiones.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input className={inputCls} placeholder="ej. Flota Moncada" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <button
              onClick={crearFlota}
              className="shrink-0 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright"
            >
              Crear flota
            </button>
          </div>
        </div>
      )}

      {flotas && flotas.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {flotas.map((f) => (
            <FlotaVehiculos key={f.id} flota={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlotaVehiculos({ flota }: { flota: ClienteAdmin }) {
  const [centros, setCentros] = useState<Centro[] | null>(null);
  const [placa, setPlaca] = useState("");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCentros(flota.id)
      .then(setCentros)
      .catch((e) => setError(e.message));
  }, [flota.id]);

  const agregar = async () => {
    if (!placa.trim()) return;
    setError(null);
    try {
      const c = await createCentro(flota.id, placa.trim(), alias.trim());
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

  return (
    <div className="rounded-xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel">
      <h2 className="font-medium text-haze-50">{flota.nombre}</h2>

      {centros === null ? (
        <p className="mt-2 text-xs text-haze-500">Cargando…</p>
      ) : centros.length === 0 ? (
        <p className="mt-2 text-xs text-haze-500">Sin camiones todavía. Agrega el primero abajo.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
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

      {error && <p className="mt-2 text-xs text-pending">{error}</p>}
    </div>
  );
}
