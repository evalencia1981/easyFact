import { useRef, useState } from "react";
import { subirManifiestoPdf } from "../db";

// Botón para elegir un PDF del explorador y subirlo a Storage; al terminar
// entrega la URL pública al padre (que la guarda en documento_url).
export default function SubirPdf({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (f: File | null) => {
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("El archivo debe ser un PDF.");
      return;
    }
    setError(null);
    setSubiendo(true);
    try {
      const url = await subirManifiestoPdf(f);
      onChange(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubiendo(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={ref}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => elegir(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={subiendo}
          className="rounded-lg border border-plum-600 bg-plum-950/60 px-3 py-2 text-sm text-haze-200 transition hover:border-iris hover:text-iris disabled:opacity-60"
        >
          {subiendo ? "Subiendo…" : "📁 Buscar PDF"}
        </button>
        {value && (
          <a href={value} target="_blank" rel="noreferrer" className="text-xs text-iris hover:underline">
            PDF cargado ✓
          </a>
        )}
      </div>
      {error && <p className="text-[11px] text-pending">{error}</p>}
    </div>
  );
}
