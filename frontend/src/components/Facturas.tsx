import { useEffect, useState } from "react";
import { listFacturas, type FacturaRow } from "../db";
import { pesos } from "../api";

// Lista de facturas guardadas (RLS filtra según el rol del usuario).
export default function Facturas() {
  const [rows, setRows] = useState<FacturaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFacturas()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold text-haze-50">Facturas guardadas</h1>
      <p className="mt-1 text-sm text-haze-400">Lo que tú y tu equipo han capturado.</p>

      {error && (
        <p className="mt-6 rounded-lg border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">{error}</p>
      )}

      {!rows && !error && (
        <div className="mt-10 grid place-items-center text-haze-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum-600 border-t-iris" />
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-plum-700 px-4 py-10 text-center text-sm text-haze-500">
          Aún no hay facturas guardadas. Captura una en la pestaña “Capturar”.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {rows.map((f) => (
            <li
              key={f.id}
              className="animate-rise rounded-xl border border-plum-700 bg-plum-900/50 p-4 shadow-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-haze-50">{f.tercero || "Sin tercero"}</p>
                  <p className="mt-0.5 truncate text-xs text-haze-400">
                    {f.cliente?.nombre || "—"}
                    {f.centro_costos?.identificador ? ` · 🚚 ${f.centro_costos.identificador}` : ""}
                    {f.concepto ? ` · ${f.concepto}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-haze-600">
                    {f.fecha || new Date(f.created_at).toLocaleDateString("es-CO")}
                    {f.medio_pago ? ` · ${f.medio_pago}` : ""}
                    {f.numero ? ` · #${f.numero}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-iris">{pesos(f.total || 0, f.moneda)}</p>
                  {f.tipo && (
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${
                        f.tipo === "compra" ? "bg-pending/15 text-pending" : "bg-matched/15 text-matched"
                      }`}
                    >
                      {f.tipo}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
