"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Trash2, Save, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface ItemRow { id: number; codigo: string; producto: string; cantidad: string; valorUnit: string; }

let nextId = 1;
function createEmptyItem(): ItemRow { return { id: nextId++, codigo: "", producto: "", cantidad: "", valorUnit: "" }; }

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(value);
}

function CellInput({ value, onChange, onKeyDown, placeholder, type = "text", align = "left", className = "", inputRef, autoFocus }: {
  value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string; type?: string; align?: "left" | "center" | "right";
  className?: string; inputRef?: (el: HTMLInputElement | null) => void; autoFocus?: boolean;
}) {
  return (
    <input ref={inputRef} type={type} value={value} onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus}
      className={`h-9 px-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-shadow ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`} />
  );
}

export function InvoiceForm() {
  const { activeProjectId, triggerRefresh, invoiceToEdit, setInvoiceToEdit } = useAppStore();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("FC");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [proveedor, setProveedor] = useState("");
  const [clienteCodigo, setClienteCodigo] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteCiudadTel, setClienteCiudadTel] = useState("");
  const [condicionVenta, setCondicionVenta] = useState("CONTADO");
  const [clienteCuit, setClienteCuit] = useState("C.U.I.T.: ");
  const [clienteContacto, setClienteContacto] = useState("CONTACTO : ");
  const [remito, setRemito] = useState("REMITO N° 00000000");

  const [items, setItems] = useState<ItemRow[]>([createEmptyItem()]);
  const headerRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (invoiceToEdit) {
      setNumero(invoiceToEdit.numero || "");
      setTipo(invoiceToEdit.tipo || "FC");
      setFecha(invoiceToEdit.fechaEmision ? new Date(invoiceToEdit.fechaEmision).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
      setProveedor(invoiceToEdit.proveedor || "");
      setClienteCodigo(invoiceToEdit.clienteCodigo || "");
      setClienteDireccion(invoiceToEdit.clienteDireccion || "");
      setClienteCiudadTel(invoiceToEdit.clienteCiudadTel || "");
      setCondicionVenta(invoiceToEdit.condicionVenta || "CONTADO");
      setClienteCuit(invoiceToEdit.clienteCuit || "C.U.I.T.: ");
      setClienteContacto(invoiceToEdit.clienteContacto || "CONTACTO : ");
      setRemito(invoiceToEdit.remito || "REMITO N° 00000000");
      if (invoiceToEdit.items && invoiceToEdit.items.length > 0) {
        setItems(invoiceToEdit.items.map((i: any) => ({
          id: nextId++,
          codigo: i.codigo || "",
          producto: i.producto || "",
          cantidad: String(i.cantidad || ""),
          valorUnit: String(i.valorUnit || "")
        })));
      } else {
        setItems([createEmptyItem()]);
      }
    } else {
      limpiar();
    }
  }, [invoiceToEdit]);

  const agregarFila = useCallback(() => setItems((p) => [...p, createEmptyItem()]), []);
  const quitarFila = useCallback((id: number) => setItems((p) => (p.length <= 1 ? p : p.filter((i) => i.id !== id))), []);
  const actualizarItem = useCallback((id: number, campo: keyof ItemRow, valor: string) => {
    setItems((p) => p.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }, []);

  const focusField = useCallback((refs: React.RefObject<Record<string, HTMLInputElement | null>>, key: string) => {
    setTimeout(() => { refs.current[key]?.focus(); refs.current[key]?.select(); }, 10);
  }, []);

  const handleItemKeyDown = useCallback((ri: number, col: "codigo" | "producto" | "cantidad" | "valorUnit", e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const order: ("codigo" | "producto" | "cantidad" | "valorUnit")[] = ["codigo", "producto", "cantidad", "valorUnit"];
      const idx = order.indexOf(col);
      if (idx < order.length - 1) focusField(itemRefs, `${ri}-${order[idx + 1]}`);
      else if (ri < items.length - 1) focusField(itemRefs, `${ri + 1}-codigo`);
      else setItems((p) => { setTimeout(() => focusField(itemRefs, `${p.length}-codigo`), 30); return [...p, createEmptyItem()]; });
    } else if (e.key === "Tab" && e.shiftKey && col === "codigo" && ri === 0) {
      e.preventDefault(); focusField(headerRefs, "remito");
    }
  }, [items.length, focusField]);

  const goNext = useCallback((next: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); next === "items-start" ? focusField(itemRefs, "0-codigo") : focusField(headerRefs, next); }
  }, [focusField]);

  const limpiar = useCallback(() => {
    setNumero(""); setTipo("FC"); setFecha(new Date().toISOString().split("T")[0]);
    setProveedor(""); setClienteCodigo(""); setClienteDireccion(""); setClienteCiudadTel("");
    setCondicionVenta("CONTADO"); setClienteCuit("C.U.I.T.: "); setClienteContacto("CONTACTO : "); setRemito("REMITO N° 00000000");
    setItems([createEmptyItem()]);
    setTimeout(() => focusField(headerRefs, "numero"), 30);
  }, [focusField]);

  const total = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.valorUnit) || 0), 0);
  const uds = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0);

  const guardar = async () => {
    if (!numero.trim()) { toast({ title: "Dato faltante", description: "Ingresá el número de factura.", variant: "destructive" }); return; }
    if (!fecha) { toast({ title: "Dato faltante", description: "Seleccioná la fecha.", variant: "destructive" }); return; }
    const valid = items.filter((i) => i.producto.trim() && parseFloat(i.cantidad) > 0);
    if (!valid.length) { toast({ title: "Sin productos", description: "Agregá al menos un producto.", variant: "destructive" }); return; }
    setSending(true);
    try {
      const url = invoiceToEdit ? `/api/invoices/${invoiceToEdit.id}` : "/api/invoices";
      const method = invoiceToEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        projectId: activeProjectId, numero: numero.trim(), tipo: tipo.trim(), fechaEmision: fecha, proveedor: proveedor.trim(),
        clienteCodigo: clienteCodigo.trim(), clienteDireccion: clienteDireccion.trim(), clienteCiudadTel: clienteCiudadTel.trim(),
        condicionVenta: condicionVenta.trim(), clienteCuit: clienteCuit.trim(), clienteContacto: clienteContacto.trim(), remito: remito.trim(),
        items: valid.map((i) => ({ codigo: i.codigo.trim(), producto: i.producto.trim(), cantidad: parseFloat(i.cantidad) || 0, valorUnit: parseFloat(i.valorUnit) || 0, subtotal: (parseFloat(i.cantidad) || 0) * (parseFloat(i.valorUnit) || 0) })),
      })});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: invoiceToEdit ? "Factura actualizada" : "Factura guardada", description: `${numero.trim()} — ${valid.length} ítem(es) — ${formatMoney(data.total)}` });
      triggerRefresh(); 
      if (invoiceToEdit) setInvoiceToEdit(null); // Return to default create state
      else limpiar();
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "Intentá de nuevo.", variant: "destructive" }); }
    finally { setSending(false); }
  };

  const isEditing = !!invoiceToEdit;

  return (
    <div className="space-y-4 animate-in fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">{isEditing ? "Editar factura" : "Nueva factura"}</h2>
          <p className="text-sm text-stone-500 mt-0.5">Presioná Enter para avanzar entre campos</p>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <Button variant="outline" size="sm" onClick={() => setInvoiceToEdit(null)} disabled={sending} className="gap-1.5 h-9">
              <X className="w-3.5 h-3.5" /> Cancelar
            </Button>
          )}
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={limpiar} disabled={sending} className="gap-1.5 h-9">
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar
            </Button>
          )}
          <Button onClick={guardar} disabled={sending} className="gap-1.5 h-9 px-5 bg-purple-800 hover:bg-purple-900 text-white font-semibold shadow-sm">
            <Save className="w-3.5 h-3.5" /> {sending ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar factura"}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          {[
            { label: "N° Factura", val: numero, set: setNumero, ph: "FC 000-0008806", next: "tipo", af: true },
            { label: "Tipo", val: tipo, set: setTipo, ph: "FC", next: "fecha" },
            { label: "Fecha", val: fecha, set: setFecha, ph: "", next: "proveedor", tp: "date" },
            { label: "Razón Social", val: proveedor, set: setProveedor, ph: "Nombre del proveedor", next: "clienteCodigo" },
            { label: "Cód. Cliente", val: clienteCodigo, set: setClienteCodigo, ph: "0-00066", next: "clienteDireccion" },
            { label: "Dirección", val: clienteDireccion, set: setClienteDireccion, ph: "Dirección...", next: "clienteCiudadTel" },
            { label: "Ciudad / Tel", val: clienteCiudadTel, set: setClienteCiudadTel, ph: "CAPITAL FEDERAL...", next: "condicionVenta" },
            { label: "Condición", val: condicionVenta, set: setCondicionVenta, ph: "CONTADO", next: "clienteCuit" },
            { label: "CUIT", val: clienteCuit, set: setClienteCuit, ph: "C.U.I.T.: ...", next: "clienteContacto" },
            { label: "Contacto", val: clienteContacto, set: setClienteContacto, ph: "CONTACTO : ...", next: "remito" },
            { label: "Remito", val: remito, set: setRemito, ph: "REMITO N° 00000000", next: "items-start" },
          ].map((f) => (
            <div key={f.label} className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">{f.label}</label>
              <CellInput value={f.val} onChange={f.set} placeholder={f.ph} type={f.tp || "text"} autoFocus={f.af}
                inputRef={(el: HTMLInputElement | null) => { headerRefs.current[f.next === "tipo" ? "numero" : f.label === "Remito" ? "remito" : f.next === "items-start" ? "remito" : f.label] = el; }}
                onKeyDown={(e) => goNext(f.next, e)} />
            </div>
          ))}
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Productos</span>
          <Button type="button" variant="ghost" size="sm" onClick={agregarFila} className="gap-1 text-purple-700 text-xs h-7"><Plus className="w-3.5 h-3.5" /> Agregar fila</Button>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[600px]">
          <thead><tr className="bg-stone-50 border-b border-stone-200">
            <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[90px]">Codigo</th>
            <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2">Descripcion</th>
            <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[80px]">Cant.</th>
            <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[120px]">P.Unitario</th>
            <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[110px]">Subtotal</th>
            <th className="w-[36px]"></th>
          </tr></thead>
          <tbody>{items.map((item, ri) => {
            const cant = parseFloat(item.cantidad) || 0, val = parseFloat(item.valorUnit) || 0, sub = cant * val;
            return (
              <tr key={item.id} className={`border-b border-stone-100 hover:bg-purple-50/40 transition-colors ${!item.producto && !item.cantidad ? "bg-stone-50/50" : ""}`}>
                <td className="px-1.5 py-1"><CellInput inputRef={(el) => { itemRefs.current[`${ri}-codigo`] = el; }} value={item.codigo} onChange={(v) => actualizarItem(item.id, "codigo", v)} onKeyDown={(e) => handleItemKeyDown(ri, "codigo", e)} placeholder="S-0100" className="font-mono text-xs" /></td>
                <td className="px-1.5 py-1"><CellInput inputRef={(el) => { itemRefs.current[`${ri}-producto`] = el; }} value={item.producto} onChange={(v) => actualizarItem(item.id, "producto", v)} onKeyDown={(e) => handleItemKeyDown(ri, "producto", e)} placeholder="Nombre del producto" /></td>
                <td className="px-1.5 py-1"><CellInput inputRef={(el) => { itemRefs.current[`${ri}-cantidad`] = el; }} type="number" align="center" value={item.cantidad} onChange={(v) => actualizarItem(item.id, "cantidad", v)} onKeyDown={(e) => handleItemKeyDown(ri, "cantidad", e)} placeholder="0" className="font-mono" /></td>
                <td className="px-1.5 py-1"><CellInput inputRef={(el) => { itemRefs.current[`${ri}-valorUnit`] = el; }} type="number" align="right" value={item.valorUnit} onChange={(v) => actualizarItem(item.id, "valorUnit", v)} onKeyDown={(e) => handleItemKeyDown(ri, "valorUnit", e)} placeholder="0.00" className="font-mono" /></td>
                <td className="px-3 py-1 text-right"><span className={`text-sm font-medium ${sub > 0 ? "text-stone-800" : "text-stone-300"}`}>{sub > 0 ? formatMoney(sub) : "-"}</span></td>
                <td className="px-1 py-1"><button type="button" onClick={() => quitarFila(item.id)} disabled={items.length <= 1} className="w-7 h-7 rounded flex items-center justify-center text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <div className="px-4 py-3 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between">
          <span className="text-xs text-stone-400">{items.filter((i) => i.producto).length} producto(s) | {uds} unidades</span>
          <div className="text-right"><span className="text-xs text-stone-500 mr-2">Total</span><span className="text-lg font-bold text-stone-900">{formatMoney(total)}</span></div>
        </div>
      </Card>
      <p className="text-xs text-stone-400 text-center">Enter para avanzar | Tab para saltar columnas | La última columna crea fila nueva automáticamente</p>
    </div>
  );
}