import { useState } from "react";
import { useAuth, ROLE_LABEL, type Role } from "../auth";

const inputCls =
  "w-full rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-50 outline-none transition placeholder:text-haze-500/70 focus:border-iris focus:shadow-glow";

// Pantalla de acceso: alterna entre Iniciar sesión y Crear cuenta (con rol).
export default function Login() {
  const { signIn, signUp } = useAuth();
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("contador");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (modo === "login") {
        await signIn(email, password);
      } else {
        const { needsEmail } = await signUp(nombre, email, password, role);
        if (needsEmail) {
          setInfo("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.");
          setModo("login");
        }
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="animate-rise rounded-2xl border border-plum-700 bg-plum-900/50 p-6 shadow-panel sm:p-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-iris">ContaScan</p>
          <h1 className="font-display mt-1 text-2xl font-semibold text-haze-50">
            {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          {modo === "signup" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-haze-500">Nombre</span>
              <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Correo</span>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-haze-500">Contraseña</span>
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {modo === "signup" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-haze-500">Rol</span>
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
          )}
          {info && (
            <p className="rounded-lg border border-matched/40 bg-matched/10 px-3 py-2 text-sm text-matched">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-plum-950 transition hover:bg-iris-bright disabled:opacity-60"
          >
            {loading ? "Procesando…" : modo === "login" ? "Entrar" : "Registrarme"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-haze-400">
          {modo === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            onClick={() => {
              setModo(modo === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            className="font-medium text-iris underline-offset-4 hover:underline"
          >
            {modo === "login" ? "Crear una" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}
