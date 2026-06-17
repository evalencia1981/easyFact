// Capa de datos sobre Supabase (RLS aplica por la sesión del usuario).
import { supabase } from "./supabase";
import type { Factura, FacturaItem } from "./api";

export interface Cliente {
  id: string;
  nombre: string;
  nit: string;
}

export interface Centro {
  id: string;
  cliente_id: string;
  tipo: string;
  identificador: string;
  alias: string;
}

export interface Manifiesto {
  id: string;
  cliente_id: string;
  centro_costos_id: string;
  conductor_id: string | null;
  numero: string;
  origen: string;
  destino: string;
  anticipo: number;
  valor_viaje: number;
  estado: string; // 'abierto' | 'liquidado'
  created_at: string;
}

export interface LiquidacionRow {
  manifiesto_id: string;
  cliente_id: string;
  centro_costos_id: string;
  numero: string;
  origen: string;
  destino: string;
  anticipo: number;
  valor_viaje: number;
  estado: string;
  created_at: string;
  cliente_nombre: string;
  camion_placa: string;
  camion_alias: string;
  num_facturas: number;
  total_gastos: number;
  saldo: number;
}

export interface FacturaRow {
  id: string;
  created_at: string;
  cliente_id: string;
  centro_costos_id: string | null;
  tipo: string;
  tercero: string;
  documento: string;
  numero: string;
  fecha: string;
  concepto: string;
  centro_costos_txt: string;
  medio_pago: string;
  subtotal: number;
  impuestos: number;
  total: number;
  moneda: string;
  texto_crudo: string;
  notas: string;
  confianza: number;
  items: FacturaItem[];
  cliente?: { nombre: string } | null;
  centro_costos?: { alias: string; identificador: string } | null;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No hay sesión activa.");
  return data.user.id;
}

// ---- Clientes (flotas) ----
export async function listClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from("cliente").select("id, nombre, nit").order("nombre");
  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function createCliente(nombre: string, nit = ""): Promise<Cliente> {
  const { data, error } = await supabase
    .from("cliente")
    .insert({ nombre, nit, contador_id: await uid() })
    .select("id, nombre, nit")
    .single();
  if (error) throw error;
  return data as Cliente;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from("cliente").delete().eq("id", id);
  if (error) throw error;
}

// ---- Centros de costo (camiones) ----
export async function listCentros(clienteId: string): Promise<Centro[]> {
  const { data, error } = await supabase
    .from("centro_costos")
    .select("id, cliente_id, tipo, identificador, alias")
    .eq("cliente_id", clienteId)
    .order("identificador");
  if (error) throw error;
  return (data ?? []) as Centro[];
}

export async function createCentro(
  clienteId: string,
  identificador: string,
  alias = "",
  tipo = "camion"
): Promise<Centro> {
  const { data, error } = await supabase
    .from("centro_costos")
    .insert({ cliente_id: clienteId, identificador, alias, tipo })
    .select("id, cliente_id, tipo, identificador, alias")
    .single();
  if (error) throw error;
  return data as Centro;
}

export async function deleteCentro(id: string): Promise<void> {
  const { error } = await supabase.from("centro_costos").delete().eq("id", id);
  if (error) throw error;
}

// ---- Manifiestos (viajes) ----
export async function listManifiestosAbiertos(centroId: string): Promise<Manifiesto[]> {
  const { data, error } = await supabase
    .from("manifiesto")
    .select("id, cliente_id, centro_costos_id, conductor_id, numero, origen, destino, anticipo, valor_viaje, estado, created_at")
    .eq("centro_costos_id", centroId)
    .eq("estado", "abierto")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Manifiesto[];
}

export async function createManifiesto(args: {
  clienteId: string;
  centroId: string;
  numero: string;
  anticipo: number;
  valorViaje?: number;
  origen?: string;
  destino?: string;
}): Promise<Manifiesto> {
  const { data, error } = await supabase
    .from("manifiesto")
    .insert({
      cliente_id: args.clienteId,
      centro_costos_id: args.centroId,
      numero: args.numero,
      origen: args.origen ?? "",
      destino: args.destino ?? "",
      anticipo: args.anticipo,
      valor_viaje: args.valorViaje ?? 0,
    })
    .select("id, cliente_id, centro_costos_id, conductor_id, numero, origen, destino, anticipo, valor_viaje, estado, created_at")
    .single();
  if (error) throw error;
  return data as Manifiesto;
}

export async function setManifiestoEstado(id: string, estado: "abierto" | "liquidado"): Promise<void> {
  const { error } = await supabase.from("manifiesto").update({ estado }).eq("id", id);
  if (error) throw error;
}

export async function listLiquidaciones(): Promise<LiquidacionRow[]> {
  const { data, error } = await supabase
    .from("liquidacion_viaje")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LiquidacionRow[];
}

// ---- Facturas ----
export async function saveFactura(
  f: Factura,
  clienteId: string,
  centroId: string | null,
  manifiestoId: string | null = null
): Promise<void> {
  const row = {
    cliente_id: clienteId,
    centro_costos_id: centroId,
    manifiesto_id: manifiestoId,
    capturada_por: await uid(),
    tipo: f.tipo ?? "",
    tercero: f.tercero ?? "",
    documento: f.documento ?? "",
    numero: f.numero ?? "",
    fecha: f.fecha ?? "",
    concepto: f.concepto ?? "",
    centro_costos_txt: f.centro_costos ?? "",
    medio_pago: f.medio_pago ?? "",
    subtotal: f.subtotal ?? 0,
    impuestos: f.impuestos ?? 0,
    total: f.total ?? 0,
    moneda: f.moneda ?? "COP",
    texto_crudo: f.texto_crudo ?? "",
    notas: f.notas ?? "",
    confianza: f.confianza ?? 0,
    items: f.items ?? [],
  };
  const { error } = await supabase.from("factura").insert(row);
  if (error) throw error;
}

export async function listFacturas(): Promise<FacturaRow[]> {
  const { data, error } = await supabase
    .from("factura")
    .select(
      "id, created_at, cliente_id, centro_costos_id, tipo, tercero, documento, numero, fecha, concepto, centro_costos_txt, medio_pago, subtotal, impuestos, total, moneda, texto_crudo, notas, confianza, items, cliente(nombre), centro_costos(alias, identificador)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FacturaRow[];
}
