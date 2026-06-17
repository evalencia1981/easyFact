import { useEffect, useState } from "react";
import type { Factura } from "../api";
import {
  listClientes,
  createCliente,
  listCentros,
  createCentro,
  listManifiestosAbiertos,
  saveFactura,
  type Cliente,
  type Centro,
  type Manifiesto,
} from "../db";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Panel para asignar la factura a un cliente (flota) + centro de costos (camión)
// y guardarla en Supabase. Permite crear cliente/centro al vuelo si no existen.
export default function GuardarFactura({ factura, onSaved }: { factura: Factura; onSaved: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [manifiestoId, setManifiestoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick-create
  const [nuevoCliente, setNuevoCliente] = useState("");
  const [nuevoCentro, setNuevoCentro] = useState(factura.centro_costos ?? "");

  useEffect(() => {
    listClientes()
      .then((cs) => {
        setClientes(cs);
        if (cs.length === 1) setClienteId(cs[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setCentros([]);
      setCentroId("");
      return;
    }
    listCentros(clienteId)
      .then(setCentros)
      .catch((e) => setError(e.message));
  }, [clienteId]);

  // Manifiestos (viajes) abiertos del camión seleccionado.
  useEffect(() => {
    setManifiestoId("");
    if (!centroId) {
      setManifiestos([]);
      return;
    }
    listManifiestosAbiertos(centroId)
      .then(setManifiestos)
      .catch((e) => setError(e.message));
  }, [centroId]);

  const addCliente = async () => {
    if (!nuevoCliente.trim()) return;
    setError(null);
    try {
      const c = await createCliente(nuevoCliente.trim());
      setClientes((xs) => [...xs, c]);
      setClienteId(c.id);
      setNuevoCliente("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addCentro = async () => {
    if (!clienteId || !nuevoCentro.trim()) return;
    setError(null);
    try {
      const c = await createCentro(clienteId, nuevoCentro.trim());
      setCentros((xs) => [...xs, c]);
      setCentroId(c.id);
      setNuevoCentro("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const guardar = async () => {
    if (!clienteId) {
      setError("Elige o crea un cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveFactura(factura, clienteId, centroId || null, manifiestoId || null);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-plum-700 bg-plum-950/40 p-4">
      <h3 className="text-sm font-semibold text-haze-100">Guardar en ContaScan</h3>
      <p className="mt-0.5 text-xs text-haze-500">Asigna la factura a un cliente (flota) y, si aplica, a un camión.</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Cliente */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-haze-500">Cliente / flota</span>
          {clientes.length > 0 ? (
            <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— elige —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-haze-500">No tienes clientes aún. Crea uno:</p>
          )}
          <div className="mt-1 flex gap-2">
            <input
              className={inputCls}
              placeholder="Nuevo cliente (ej. Transportes López)"
              value={nuevoCliente}
              onChange={(e) => setNuevoCliente(e.target.value)}
            />
            <button onClick={addCliente} className="shrink-0 rounded-lg border border-plum-600 px-3 text-sm text-iris hover:border-iris">
              +
            </button>
          </div>
        </div>

        {/* Centro de costos */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-haze-500">Centro de costos / camión</span>
          <select
            className={inputCls}
            value={centroId}
            onChange={(e) => setCentroId(e.target.value)}
            disabled={!clienteId}
          >
            <option value="">— sin centro —</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.identificador || c.alias || "(sin placa)"}
                {c.alias && c.identificador ? ` · ${c.alias}` : ""}
              </option>
            ))}
          </select>
          <div className="mt-1 flex gap-2">
            <input
              className={inputCls}
              placeholder="Nuevo camión (placa, ej. NUU699)"
              value={nuevoCentro}
              onChange={(e) => setNuevoCentro(e.target.value)}
              disabled={!clienteId}
            />
            <button
              onClick={addCentro}
              disabled={!clienteId}
              className="shrink-0 rounded-lg border border-plum-600 px-3 text-sm text-iris hover:border-iris disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Manifiesto / viaje (opcional) — solo si el camión tiene viajes abiertos */}
      {centroId && (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-haze-500">Manifiesto / viaje (para liquidar el anticipo)</span>
          {manifiestos.length > 0 ? (
            <select className={inputCls} value={manifiestoId} onChange={(e) => setManifiestoId(e.target.value)}>
              <option value="">— sin viaje —</option>
              {manifiestos.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.numero} · anticipo {m.anticipo.toLocaleString("es-CO")}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-haze-500">
              Este camión no tiene viajes abiertos. Créalos en la pestaña “Viajes”.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      <button
        onClick={guardar}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-iris px-6 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar factura"}
      </button>
    </div>
  );
}
