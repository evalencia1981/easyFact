import { useEffect, useMemo, useState } from "react";
import {
  listClientes,
  listCentros,
  createManifiesto,
  listLiquidaciones,
  setManifiestoEstado,
  type Cliente,
  type Centro,
  type LiquidacionRow,
} from "../db";
import { pesos } from "../api";
import { useAuth } from "../auth";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Viajes: crear manifiestos (número + anticipo, ligados a un camión) y ver la
// liquidación de cada uno (anticipo − gastos = saldo).
export default function Viajes() {
  const { profile } = useAuth();
  const puedeCrear = (profile?.role ?? "contador") !== "conductor"; // conductor solo ve sus viajes
  const [rows, setRows] = useState<LiquidacionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [numero, setNumero] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [anticipo, setAnticipo] = useState("");
  const [valorViaje, setValorViaje] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = () =>
    listLiquidaciones()
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    cargar();
    listClientes().then(setClientes).catch(() => {});
  }, []);

  useEffect(() => {
    setCentroId("");
    if (!clienteId) {
      setCentros([]);
      return;
    }
    listCentros(clienteId).then(setCentros).catch(() => {});
  }, [clienteId]);

  const crear = async () => {
    if (!clienteId || !centroId || !numero.trim()) {
      setError("Elige cliente, camión y escribe el número de manifiesto.");
      return;
    }
    setCreando(true);
    setError(null);
    try {
      await createManifiesto({
        clienteId,
        centroId,
        numero: numero.trim(),
        origen: origen.trim(),
        destino: destino.trim(),
        anticipo: Number(anticipo.replace(/[^\d.-]/g, "")) || 0,
        valorViaje: Number(valorViaje.replace(/[^\d.-]/g, "")) || 0,
      });
      setNumero("");
      setOrigen("");
      setDestino("");
      setAnticipo("");
      setValorViaje("");
      await cargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreando(false);
    }
  };

  const toggleEstado = async (r: LiquidacionRow) => {
    const nuevo = r.estado === "abierto" ? "liquidado" : "abierto";
    try {
      await setManifiestoEstado(r.manifiesto_id, nuevo);
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Viajes y liquidación</h1>
      <p className="mt-1 text-sm text-haze-400">
        Crea el manifiesto de un viaje (número + anticipo, ligado a un camión). Al subir las facturas
        del viaje, aquí ves el cruce: anticipo − gastos = saldo.
      </p>

      {/* Alta de manifiesto (no visible para conductor) */}
      {puedeCrear && (
      <div className="mt-6 rounded-xl border border-plum-700 bg-plum-900/50 p-4">
        <h2 className="text-sm font-semibold text-haze-100">Nuevo viaje</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Cliente / flota</span>
            <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— elige —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Camión</span>
            <select className={inputCls} value={centroId} onChange={(e) => setCentroId(e.target.value)} disabled={!clienteId}>
              <option value="">{clienteId ? "— elige —" : "elige cliente primero"}</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.identificador || c.alias || "(sin placa)"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Número de manifiesto</span>
            <input className={inputCls} placeholder="ej. MAN-00123" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Origen</span>
            <input className={inputCls} placeholder="ej. Bogotá" value={origen} onChange={(e) => setOrigen(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Destino</span>
            <input className={inputCls} placeholder="ej. Medellín" value={destino} onChange={(e) => setDestino(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Anticipo</span>
            <input className={inputCls} inputMode="decimal" placeholder="ej. 1.500.000" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Valor del viaje (opcional)</span>
            <input className={inputCls} inputMode="decimal" placeholder="lo confirma el dueño" value={valorViaje} onChange={(e) => setValorViaje(e.target.value)} />
          </label>
        </div>
        <button
          onClick={crear}
          disabled={creando}
          className="mt-4 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60"
        >
          {creando ? "Creando…" : "Crear viaje"}
        </button>
      </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      {!rows && !error && (
        <div className="mt-10 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-plum-700 px-4 py-8 text-center text-sm text-haze-500">
          Aún no hay viajes. Crea el primero arriba.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {rows.map((r) => (
            <ViajeCard key={r.manifiesto_id} r={r} onToggle={() => toggleEstado(r)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ViajeCard({ r, onToggle }: { r: LiquidacionRow; onToggle: () => void }) {
  // saldo = anticipo − gastos.  >0 sobra anticipo (devuelve);  <0 la empresa le debe.
  const saldoLabel = useMemo(() => {
    if (r.saldo > 0) return { txt: "Sobra anticipo", cls: "text-haze-200" };
    if (r.saldo < 0) return { txt: "La empresa debe", cls: "text-pending" };
    return { txt: "Cuadrado", cls: "text-matched" };
  }, [r.saldo]);

  return (
    <li className="animate-rise rounded-xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-haze-50">
            #{r.numero}
            <span className="ml-2 font-mono text-sm text-haze-400">{r.camion_placa || r.camion_alias}</span>
          </p>
          {(r.origen || r.destino) && (
            <p className="mt-0.5 text-xs text-iris">
              {r.origen || "—"} → {r.destino || "—"}
            </p>
          )}
          <p className="mt-0.5 text-xs text-haze-400">
            {r.cliente_nombre} · {r.num_facturas} {r.num_facturas === 1 ? "factura" : "facturas"}
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            r.estado === "liquidado"
              ? "bg-matched/15 text-matched hover:bg-matched/25"
              : "bg-iris/15 text-iris hover:bg-iris/25"
          }`}
          title="Cambiar estado"
        >
          {r.estado}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg border border-plum-700 bg-plum-950/40 py-2">
          <p className="text-[11px] text-haze-500">Anticipo</p>
          <p className="font-medium text-haze-100">{pesos(r.anticipo)}</p>
        </div>
        <div className="rounded-lg border border-plum-700 bg-plum-950/40 py-2">
          <p className="text-[11px] text-haze-500">Gastos</p>
          <p className="font-medium text-haze-100">{pesos(r.total_gastos)}</p>
        </div>
        <div className="rounded-lg border border-plum-700 bg-plum-950/40 py-2">
          <p className="text-[11px] text-haze-500">{saldoLabel.txt}</p>
          <p className={`font-semibold ${saldoLabel.cls}`}>{pesos(Math.abs(r.saldo))}</p>
        </div>
      </div>
    </li>
  );
}
