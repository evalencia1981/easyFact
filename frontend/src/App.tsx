import { useEffect, useState, type ReactNode } from "react";
import ImagenUpload from "./components/ImagenUpload";
import ChatCaptura from "./components/ChatCaptura";
import Login from "./components/Login";
import Facturas, { type FacturasInicial } from "./components/Facturas";
import Clientes from "./components/Clientes";
import Vehiculos from "./components/Vehiculos";
import Viajes from "./components/Viajes";
import Informe from "./components/Informe";
import Cuenta from "./components/Cuenta";
import GuardarFactura from "./components/GuardarFactura";
import { useAuth, ROLE_LABEL } from "./auth";
import { api, pesos, type Factura, type FacturaItem } from "./api";

type Modo = "foto" | "voz";
type Tab = "capturar" | "facturas" | "viajes" | "clientes" | "vehiculos" | "informe" | "cuenta";

const TAB_LABEL: Record<Tab, string> = {
  capturar: "Capturar",
  facturas: "Facturas",
  viajes: "Viajes",
  clientes: "Clientes",
  vehiculos: "Vehículos",
  informe: "Informe",
  cuenta: "Cuenta",
};

export default function App() {
  const { session, profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("capturar");
  // Filtro con el que el Informe puede abrir la lista de Facturas de un dueño.
  const [facturasInicial, setFacturasInicial] = useState<FacturasInicial | null>(null);

  // Navegar a Facturas filtrando por dueño + año (desde el Informe Anual).
  const verFacturasDe = (clienteId: string, anio: number) => {
    setFacturasInicial({ cliente: clienteId, desde: `${anio}-01-01`, hasta: `${anio}-12-31` });
    setTab("facturas");
  };
  // Clic manual en una pestaña: si es Facturas, limpia el filtro heredado.
  const irA = (t: Tab) => {
    if (t === "facturas") setFacturasInicial(null);
    setTab(t);
  };

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center text-haze-400">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
      </div>
    );
  }
  if (!session) return <Login />;

  // Pestañas visibles por rol:
  //  - contador: gestiona varios Clientes (flotas)
  //  - dueño: él ES la flota -> gestiona sus Vehículos
  //  - conductor: solo captura y ve lo suyo (sin gestión)
  // Cuenta la ven los tres: el conductor solo edita su nombre, sin empresa.
  const role = profile?.role ?? "contador";
  const tabs: Tab[] =
    role === "conductor"
      ? ["capturar", "facturas", "viajes", "cuenta"]
      : role === "propietario"
        ? ["capturar", "facturas", "viajes", "vehiculos", "informe", "cuenta"]
        : ["capturar", "facturas", "viajes", "clientes", "informe", "cuenta"];

  return (
    <div>
      <nav className="sticky top-0 z-10 border-b border-plum-700 bg-plum-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <span className="hidden text-xs font-semibold uppercase tracking-[0.25em] text-iris sm:inline">
            ContaScan
          </span>
          <div className="inline-flex rounded-xl border border-plum-600 bg-plum-950/60 p-0.5">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => irA(t)}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
                  tab === t ? "bg-iris text-plum-950" : "text-haze-400 hover:text-iris"
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-haze-300 sm:inline">
              {profile?.nombre || session.user.email}
              {profile && (
                <span className="ml-2 rounded-full bg-iris/15 px-2 py-0.5 text-[11px] text-iris">
                  {ROLE_LABEL[profile.role]}
                </span>
              )}
            </span>
            <button onClick={signOut} className="text-haze-400 transition hover:text-iris hover:underline">
              Salir
            </button>
          </div>
        </div>
      </nav>
      {tab === "capturar" && <Captura onVerFacturas={() => setTab("facturas")} />}
      {tab === "facturas" && (
        <Facturas key={facturasInicial?.cliente ?? "todas"} inicial={facturasInicial} />
      )}
      {tab === "viajes" && <Viajes />}
      {tab === "clientes" && <Clientes />}
      {tab === "vehiculos" && <Vehiculos />}
      {tab === "informe" && <Informe onVerFacturas={verFacturasDe} />}
      {tab === "cuenta" && <Cuenta />}
    </div>
  );
}

function Captura({ onVerFacturas }: { onVerFacturas: () => void }) {
  const [modo, setModo] = useState<Modo>("foto");
  const [datos, setDatos] = useState<Factura | null>(null);
  const [confirmado, setConfirmado] = useState<Factura | null>(null);
  const [geminiOk, setGeminiOk] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .health()
      .then((h) => setGeminiOk(h.gemini_key))
      .catch(() => setGeminiOk(false));
  }, []);

  const reiniciar = () => {
    setDatos(null);
    setConfirmado(null);
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="animate-fade text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-iris">ContaScan</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-haze-50 sm:text-4xl">
          Captura tu factura o apunte
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-haze-400">
          Toma una foto o dícta los datos por voz. La IA los lee, tú los revisas y confirmas.
        </p>
        {geminiOk === false && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-xs text-pending">
            El servicio no tiene <code>GEMINI_API_KEY</code> configurada: la extracción fallará.
          </p>
        )}
      </header>

      {!confirmado && (
        <section className="mt-8 animate-rise rounded-2xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel sm:p-6">
          {/* Selector de modo de captura */}
          <div className="mb-4 inline-flex rounded-xl border border-plum-600 bg-plum-950/60 p-1">
            {(["foto", "voz"] as Modo[]).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  modo === m ? "bg-iris text-plum-950" : "text-haze-400 hover:text-iris"
                }`}
              >
                {m === "foto" ? "Foto" : "Voz / Chat"}
              </button>
            ))}
          </div>

          {modo === "foto" ? (
            <ImagenUpload<{ data: Factura; confidence: number }>
              extraer={(file) => api.extraer(file)}
              onResult={(r) => setDatos(r.data)}
              etiqueta="Toma o sube la foto de la factura/apunte"
            />
          ) : (
            <ChatCaptura<Factura, { data: Factura; respuesta: string }>
              placeholder="Ej: le vendí 200 mil a Pedro ayer…"
              sugerencias={[
                "Le vendí 200 mil a Pedro ayer",
                "Compré papelería por 35.000",
                "Factura 1023 a Juan, total 480.000",
              ]}
              enviar={async (mensaje, estado, historial) => {
                const r = await api.chat({ mensaje, estado, historial });
                return { estado: r.data, respuesta: r.respuesta, result: r };
              }}
              onResult={(r) => setDatos(r.data)}
              resumen={(e) =>
                e?.tercero || e?.total
                  ? `${e?.tercero || "—"} · ${pesos(e?.total || 0, e?.moneda)}`
                  : null
              }
            />
          )}

          {datos && (
            <FacturaEditor
              datos={datos}
              onChange={setDatos}
              onConfirmar={() => setConfirmado(datos)}
              onLimpiar={reiniciar}
            />
          )}
        </section>
      )}

      {confirmado && (
        <Confirmacion factura={confirmado} onNuevo={reiniciar} onVerFacturas={onVerFacturas} />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Editor: revisar y corregir los campos antes de confirmar
// --------------------------------------------------------------------------- //
function FacturaEditor({
  datos,
  onChange,
  onConfirmar,
  onLimpiar,
}: {
  datos: Factura;
  onChange: (f: Factura) => void;
  onConfirmar: () => void;
  onLimpiar: () => void;
}) {
  const set = <K extends keyof Factura>(k: K, v: Factura[K]) => onChange({ ...datos, [k]: v });

  const items = datos.items ?? [];
  const setItem = (i: number, it: FacturaItem) =>
    set(
      "items",
      items.map((x, j) => (j === i ? it : x))
    );
  const addItem = () => set("items", [...items, { descripcion: "" }]);
  const delItem = (i: number) =>
    set(
      "items",
      items.filter((_, j) => j !== i)
    );

  const conf = Math.round((datos.confianza ?? 0) * 100);

  return (
    <div className="mt-6 animate-rise border-t border-plum-700 pt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-haze-50">Revisa los datos</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            conf >= 80
              ? "bg-matched/15 text-matched"
              : conf >= 50
                ? "bg-iris/15 text-iris"
                : "bg-pending/15 text-pending"
          }`}
          title="Autoconfianza de la lectura"
        >
          confianza {conf}%
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Tipo">
          <select
            value={datos.tipo || ""}
            onChange={(e) => set("tipo", e.target.value)}
            className={inputCls}
          >
            <option value="">— sin definir —</option>
            <option value="venta">Venta (cobro a cliente)</option>
            <option value="compra">Compra (pago a proveedor)</option>
          </select>
        </Campo>
        <Campo label="Tercero (cliente/proveedor)">
          <input className={inputCls} value={datos.tercero || ""} onChange={(e) => set("tercero", e.target.value)} />
        </Campo>
        <Campo label="Documento (NIT/cédula)">
          <input className={inputCls} value={datos.documento || ""} onChange={(e) => set("documento", e.target.value)} />
        </Campo>
        <Campo label="Número">
          <input className={inputCls} value={datos.numero || ""} onChange={(e) => set("numero", e.target.value)} />
        </Campo>
        <Campo label="Fecha">
          <input className={inputCls} value={datos.fecha || ""} onChange={(e) => set("fecha", e.target.value)} />
        </Campo>
        <Campo label="Concepto">
          <input className={inputCls} value={datos.concepto || ""} onChange={(e) => set("concepto", e.target.value)} />
        </Campo>
        <Campo label="Centro de costos">
          <input
            className={inputCls}
            placeholder="opcional · ej. placa NUU699, proyecto, sede"
            value={datos.centro_costos || ""}
            onChange={(e) => set("centro_costos", e.target.value)}
          />
        </Campo>
        <Campo label="Medio de pago">
          <input
            className={inputCls}
            list="medios-pago"
            placeholder="opcional · ej. Efectivo, Tarjeta…"
            value={datos.medio_pago || ""}
            onChange={(e) => set("medio_pago", e.target.value)}
          />
          <datalist id="medios-pago">
            <option value="Efectivo" />
            <option value="Tarjeta" />
            <option value="Transferencia" />
            <option value="Crédito" />
          </datalist>
        </Campo>
      </div>

      {/* Ítems */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-haze-500">Ítems</span>
          <button onClick={addItem} className="text-xs font-medium text-iris hover:underline">
            + agregar ítem
          </button>
        </div>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-plum-700 px-3 py-3 text-center text-xs text-haze-500">
            Sin ítems. Puedes agregarlos manualmente.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li key={i} className="grid grid-cols-12 gap-2 rounded-lg border border-plum-700 bg-plum-950/40 p-2">
                <input
                  className={`${inputCls} col-span-12 sm:col-span-6`}
                  placeholder="Descripción"
                  value={it.descripcion || ""}
                  onChange={(e) => setItem(i, { ...it, descripcion: e.target.value })}
                />
                <input
                  className={`${inputCls} col-span-4 sm:col-span-2`}
                  placeholder="Cant."
                  inputMode="decimal"
                  value={it.cantidad ?? ""}
                  onChange={(e) => setItem(i, { ...it, cantidad: numOrU(e.target.value) })}
                />
                <input
                  className={`${inputCls} col-span-7 sm:col-span-3`}
                  placeholder="Total línea"
                  inputMode="decimal"
                  value={it.total_linea ?? ""}
                  onChange={(e) => setItem(i, { ...it, total_linea: numOrU(e.target.value) })}
                />
                <button
                  onClick={() => delItem(i)}
                  className="col-span-1 grid place-items-center rounded-lg text-haze-500 transition hover:text-pending"
                  title="Quitar"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Importes */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Campo label="Subtotal">
          <input className={inputCls} inputMode="decimal" value={datos.subtotal ?? 0} onChange={(e) => set("subtotal", num(e.target.value))} />
        </Campo>
        <Campo label="Impuestos">
          <input className={inputCls} inputMode="decimal" value={datos.impuestos ?? 0} onChange={(e) => set("impuestos", num(e.target.value))} />
        </Campo>
        <Campo label="Total">
          <input className={`${inputCls} font-semibold text-iris`} inputMode="decimal" value={datos.total ?? 0} onChange={(e) => set("total", num(e.target.value))} />
        </Campo>
        <Campo label="Moneda">
          <input className={inputCls} value={datos.moneda || "COP"} onChange={(e) => set("moneda", e.target.value)} />
        </Campo>
      </div>

      <div className="mt-3">
        <Campo label="Notas">
          <input className={inputCls} value={datos.notas || ""} onChange={(e) => set("notas", e.target.value)} />
        </Campo>
      </div>

      {/* Texto crudo (respaldo) */}
      <details className="mt-4 rounded-lg border border-plum-700 bg-plum-950/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-haze-400">
          Ver transcripción literal (texto_crudo)
        </summary>
        <textarea
          className={`${inputCls} m-2 w-[calc(100%-1rem)] font-mono text-xs`}
          rows={4}
          value={datos.texto_crudo || ""}
          onChange={(e) => set("texto_crudo", e.target.value)}
        />
      </details>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onConfirmar}
          className="inline-flex items-center gap-2 rounded-xl bg-iris px-6 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright"
        >
          Confirmar registro
        </button>
        <button onClick={onLimpiar} className="text-sm text-haze-400 transition hover:text-iris hover:underline">
          Empezar de nuevo
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Confirmación: muestra el registro final + JSON (copiar / descargar)
// --------------------------------------------------------------------------- //
function Confirmacion({
  factura,
  onNuevo,
  onVerFacturas,
}: {
  factura: Factura;
  onNuevo: () => void;
  onVerFacturas: () => void;
}) {
  const [guardada, setGuardada] = useState(false);
  const jsonStr = JSON.stringify(factura, null, 2);

  if (guardada) {
    return (
      <section className="mt-8 animate-rise rounded-2xl border border-matched/40 bg-plum-900/50 p-6 text-center shadow-panel">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-matched/15 text-matched">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 className="font-display mt-3 text-lg font-semibold text-haze-50">¡Factura guardada!</h2>
        <p className="mt-1 text-sm text-haze-400">
          {factura.tercero || "Sin tercero"} · {pesos(factura.total || 0, factura.moneda)}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={onVerFacturas} className="rounded-xl bg-iris px-5 py-2 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright">
            Ver mis facturas
          </button>
          <button onClick={onNuevo} className="rounded-xl border border-plum-600 bg-plum-950/60 px-5 py-2 text-sm text-haze-200 transition hover:border-iris hover:text-iris">
            Capturar otra
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 animate-rise rounded-2xl border border-iris/30 bg-plum-900/50 p-6 shadow-panel">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-iris/15 text-iris">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-haze-50">Registro confirmado</h2>
          <p className="text-sm text-haze-400">
            {factura.tercero || "Sin tercero"} · {pesos(factura.total || 0, factura.moneda)}
          </p>
        </div>
      </div>

      {/* Asignar a cliente/centro y guardar en Supabase */}
      <GuardarFactura factura={factura} onSaved={() => setGuardada(true)} />

      <details className="mt-4 rounded-lg border border-plum-700 bg-plum-950/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-haze-400">Ver JSON</summary>
        <pre className="max-h-72 overflow-auto p-3 font-mono text-xs text-haze-200">{jsonStr}</pre>
      </details>

      <div className="mt-4">
        <button onClick={onNuevo} className="text-sm text-haze-400 transition hover:text-iris hover:underline">
          Descartar y capturar otra
        </button>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// Helpers de UI
// --------------------------------------------------------------------------- //
const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-haze-500">{label}</span>
      {children}
    </label>
  );
}

const num = (v: string): number => {
  const n = parseFloat(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const numOrU = (v: string): number | undefined => {
  if (!v.trim()) return undefined;
  const n = parseFloat(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
