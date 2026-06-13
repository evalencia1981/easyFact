// Capa de acceso a la API del backend (proxyada por Vite a FastAPI en /api/*).

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// ---- Factura / apunte (espejo flexible de FACTURA_SCHEMA del backend) ----
export interface FacturaItem {
  descripcion: string;
  cantidad?: number;
  valor_unitario?: number;
  total_linea?: number;
}

export interface Factura {
  tipo?: string; // "venta" | "compra" | ""
  tercero?: string;
  documento?: string;
  numero?: string;
  fecha?: string;
  concepto?: string;
  items?: FacturaItem[];
  subtotal?: number;
  impuestos?: number;
  total?: number;
  moneda?: string;
  texto_crudo?: string;
  notas?: string;
  confianza?: number;
}

export interface Health {
  ok: boolean;
  service: string;
  model: string;
  gemini_key: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch("/api/health").then((r) => json<Health>(r)),

  // Foto de factura/apunte -> datos extraídos + autoconfianza.
  extraer: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch("/api/extraer", { method: "POST", body: fd }).then((r) =>
      json<{ data: Factura; confidence: number }>(r)
    );
  },

  // Turno de chat (voz/texto) con estado -> registro completo + respuesta.
  chat: (args: { mensaje: string; estado?: Factura | null; historial?: ChatTurn[] }) =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).then((r) => json<{ data: Factura; respuesta: string }>(r)),
};

// Formato de pesos colombianos (la moneda por defecto del dominio).
export const pesos = (n: number, moneda = "COP") =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda || "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
