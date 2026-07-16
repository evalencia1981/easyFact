import { useEffect, useState } from "react";
import { listClientesAdmin, actualizarEmpresa, type ClienteAdmin } from "../db";
import { useAuth, ROLE_LABEL } from "../auth";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

const botonCls =
  "shrink-0 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60";

// Pantalla de CUENTA: sitio único y visible para editar el nombre propio y los
// datos de identificación de la(s) empresa(s). La edición rápida que ya existe
// en Vehículos e Informe sigue funcionando: todas pasan por el mismo RPC.
export default function Cuenta() {
  const { profile } = useAuth();
  const role = profile?.role ?? "contador";

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Cuenta</h1>
      <p className="mt-1 text-sm text-haze-400">
        Tu nombre visible y los datos con los que se identifica la empresa en el Informe Anual.
      </p>

      <MiCuenta />
      {role !== "conductor" && <MisEmpresas role={role} />}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Mi cuenta: nombre editable; correo y rol son fijos.
// --------------------------------------------------------------------------- //
function MiCuenta() {
  const { profile, session, updateNombre } = useAuth();
  const [nombre, setNombre] = useState(profile?.nombre ?? "");
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);

  // El profile llega asíncrono: sincroniza el input cuando aparezca.
  useEffect(() => {
    setNombre(profile?.nombre ?? "");
  }, [profile?.nombre]);

  const sucio = nombre.trim() !== (profile?.nombre ?? "") && nombre.trim() !== "";

  const guardar = async () => {
    setEstado("guardando");
    setError(null);
    try {
      await updateNombre(nombre.trim());
      setEstado("ok");
    } catch (e: any) {
      setError(e.message);
      setEstado("idle");
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel">
      <h2 className="text-sm font-semibold text-haze-100">Mi cuenta</h2>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[11px] text-haze-500">Nombre</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setEstado("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && sucio) guardar();
            }}
            placeholder="Tu nombre"
          />
          <button onClick={guardar} disabled={!sucio || estado === "guardando"} className={botonCls}>
            {estado === "guardando" ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </label>

      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-haze-500">Correo</dt>
          <dd className="text-sm text-haze-300">{session?.user.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-haze-500">Rol</dt>
          <dd className="text-sm text-haze-300">{profile ? ROLE_LABEL[profile.role] : "—"}</dd>
        </div>
      </dl>

      {estado === "ok" && <p className="mt-2 text-xs text-iris">Nombre actualizado.</p>}
      {error && <p className="mt-2 text-xs text-pending">{error}</p>}
    </section>
  );
}

// --------------------------------------------------------------------------- //
// Mis empresas: el dueño tiene una flota; el contador, varias.
// --------------------------------------------------------------------------- //
function MisEmpresas({ role }: { role: string }) {
  const [empresas, setEmpresas] = useState<ClienteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClientesAdmin()
      .then(setEmpresas)
      .catch((e) => setError(e.message));
  }, []);

  const titulo = role === "propietario" ? "Mi empresa" : "Empresas de mis clientes";

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-haze-100">{titulo}</h2>
      <p className="mt-0.5 text-xs text-haze-500">
        Estos datos encabezan el Informe Anual. Si faltan, el informe sale incompleto.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">
          {error}
        </p>
      )}

      {!empresas && !error && (
        <div className="mt-6 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {empresas && empresas.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-plum-700 px-4 py-8 text-center text-sm text-haze-500">
          {role === "propietario"
            ? "Aún no tienes flota. Créala en la pestaña Vehículos."
            : "Aún no tienes clientes. Conéctalos en la pestaña Clientes."}
        </p>
      )}

      {empresas && empresas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2.5">
          {empresas.map((e) => (
            <EmpresaCard key={e.id} empresa={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmpresaCard({ empresa }: { empresa: ClienteAdmin }) {
  const [nombre, setNombre] = useState(empresa.nombre ?? "");
  const [nit, setNit] = useState(empresa.nit ?? "");
  const [direccion, setDireccion] = useState(empresa.direccion ?? "");
  const [ciudad, setCiudad] = useState(empresa.ciudad ?? "");
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);

  const sucio =
    nombre.trim() !== (empresa.nombre ?? "") ||
    nit !== (empresa.nit ?? "") ||
    direccion !== (empresa.direccion ?? "") ||
    ciudad !== (empresa.ciudad ?? "");

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("El nombre de la empresa no puede quedar vacío.");
      return;
    }
    setEstado("guardando");
    setError(null);
    try {
      await actualizarEmpresa(empresa.id, { nombre: nombre.trim(), nit, direccion, ciudad });
      // Refleja lo guardado en el objeto en memoria para que `sucio` vuelva a false.
      empresa.nombre = nombre.trim();
      empresa.nit = nit;
      empresa.direccion = direccion;
      empresa.ciudad = ciudad;
      setEstado("ok");
    } catch (e: any) {
      setError(e.message);
      setEstado("idle");
    }
  };

  const campo = (
    etiqueta: string,
    valor: string,
    set: (v: string) => void,
    placeholder: string
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-haze-500">{etiqueta}</span>
      <input
        className={inputCls}
        value={valor}
        onChange={(e) => {
          set(e.target.value);
          setEstado("idle");
        }}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <li className="rounded-xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel">
      {empresa.propietario_nombre && (
        <p className="mb-3 text-xs text-haze-500">Dueño: {empresa.propietario_nombre}</p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {campo("Nombre", nombre, setNombre, "Transportes SAS")}
        {campo("NIT", nit, setNit, "900.123.456-7")}
        {campo("Dirección", direccion, setDireccion, "Cra 1 #2-3")}
        {campo("Ciudad", ciudad, setCiudad, "Bogotá")}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={guardar} disabled={!sucio || estado === "guardando"} className={botonCls}>
          {estado === "guardando" ? "Guardando…" : "Guardar"}
        </button>
        {estado === "ok" && <span className="text-xs text-iris">Datos guardados.</span>}
        {error && <span className="text-xs text-pending">{error}</span>}
      </div>
    </li>
  );
}
