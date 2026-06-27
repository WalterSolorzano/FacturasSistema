"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface ItemRow {
  id: number;
  codigo: string;
  producto: string;
  cantidad: string;
  valorUnit: string;
}

let nextId = 1;

function createEmptyItem(): ItemRow {
  return { id: nextId++, codigo: "", producto: "", cantidad: "", valorUnit: "" };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

export function InvoiceForm() {
  const { setActiveTab, triggerRefresh } = useAppStore();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("FC");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [proveedor, setProveedor] = useState("CUCIMUNDO");
  const [items, setItems] = useState<ItemRow[]>([createEmptyItem()]);

  const agregarFila = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const quitarFila = useCallback((id: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }, []);

  const actualizarItem = useCallback(
    (id: number, campo: keyof ItemRow, valor: string) => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)));
    },
    []
  );

  const limpiarFormulario = useCallback(() => {
    setNumero("");
    setTipo("FC");
    setFecha(new Date().toISOString().split("T")[0]);
    setProveedor("CUCIMUNDO");
    setItems([createEmptyItem()]);
  }, []);

  const totalCalculado = items.reduce((sum, item) => {
    const cant = parseFloat(item.cantidad) || 0;
    const val = parseFloat(item.valorUnit) || 0;
    return sum + cant * val;
  }, 0);

  const totalUnidades = items.reduce((sum, item) => sum + (parseFloat(item.cantidad) || 0), 0);

  const validar = (): string | null => {
    if (!numero.trim()) return "Ingresá el número de factura.";
    if (!fecha) return "Seleccioná la fecha de emisión.";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.producto.trim()) return `Fila ${i + 1}: completá la descripción del producto.`;
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) return `Fila ${i + 1}: la cantidad debe ser mayor a 0.`;
    }
    return null;
  };

  const guardar = async () => {
    const error = validar();
    if (error) {
      toast({ title: "Falta información", description: error, variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const body = {
        numero: numero.trim(),
        tipo: tipo.trim(),
        fechaEmision: fecha,
        proveedor: proveedor.trim(),
        items: items.map((item) => ({
          codigo: item.codigo.trim(),
          producto: item.producto.trim(),
          cantidad: parseFloat(item.cantidad) || 0,
          valorUnit: parseFloat(item.valorUnit) || 0,
          subtotal: (parseFloat(item.cantidad) || 0) * (parseFloat(item.valorUnit) || 0),
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      toast({
        title: "Factura registrada",
        description: `${numero.trim()} - ${items.length} producto(s) - ${formatMoney(data.total)}`,
      });

      triggerRefresh();
      limpiarFormulario();
      setActiveTab("dashboard");
    } catch (err) {
      toast({
        title: "Error al guardar",
        description: err instanceof Error ? err.message : "Intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-stone-900">Registrar nueva factura</h2>
        <p className="text-sm text-stone-500 mt-0.5">Completá los datos de la factura y los productos</p>
      </div>

      {/* Datos generales */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</div>
            Datos de la factura
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero" className="text-sm font-medium">N° de Factura *</Label>
              <Input id="numero" placeholder="Ej: FC 000-0008806" value={numero} onChange={(e) => setNumero(e.target.value)} className="h-11 text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FC">FC (Factura C)</SelectItem>
                  <SelectItem value="FA">FA (Factura A)</SelectItem>
                  <SelectItem value="FB">FB (Factura B)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium">Fecha *</Label>
              <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-11 text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proveedor" className="text-sm font-medium">Proveedor</Label>
              <Input id="proveedor" placeholder="CUCIMUNDO" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="h-11 text-base" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de productos */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</div>
              Productos
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={agregarFila} className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <Plus className="w-4 h-4" /> Agregar fila
            </Button>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            {/* Header */}
            <div className="grid gap-2 min-w-[580px] mb-2 px-1">
              <div className="grid grid-cols-[80px_1fr_80px_120px_120px_44px] gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                <span>Código</span>
                <span>Descripción *</span>
                <span className="text-center">Cantidad *</span>
                <span className="text-right">P.Unitario</span>
                <span className="text-right">Subtotal</span>
                <span></span>
              </div>
            </div>

            {/* Filas */}
            <div className="space-y-2">
              {items.map((item) => {
                const cant = parseFloat(item.cantidad) || 0;
                const val = parseFloat(item.valorUnit) || 0;
                const sub = cant * val;

                return (
                  <div key={item.id} className="grid grid-cols-[80px_1fr_80px_120px_120px_44px] gap-2 items-center p-2 rounded-lg bg-stone-50/80 hover:bg-stone-100 transition-colors group min-w-[580px]">
                    <Input placeholder="S-0100" value={item.codigo} onChange={(e) => actualizarItem(item.id, "codigo", e.target.value)} className="h-9 text-sm" />
                    <Input placeholder="Descripción del producto" value={item.producto} onChange={(e) => actualizarItem(item.id, "producto", e.target.value)} className="h-9 text-sm" />
                    <Input type="number" placeholder="0" min="0" step="any" value={item.cantidad} onChange={(e) => actualizarItem(item.id, "cantidad", e.target.value)} className="h-9 text-sm text-center" />
                    <Input type="number" placeholder="0.00" min="0" step="any" value={item.valorUnit} onChange={(e) => actualizarItem(item.id, "valorUnit", e.target.value)} className="h-9 text-sm text-right" />
                    <div className="text-sm text-stone-600 text-right font-medium">{sub > 0 ? formatMoney(sub) : "-"}</div>
                    <button type="button" onClick={() => quitarFila(item.id)} disabled={items.length <= 1} className="w-9 h-9 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="Quitar fila">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total + Botones */}
      <Card className="border-0 shadow-sm bg-emerald-50/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500 mb-1">Total de la factura</p>
              <p className="text-3xl font-bold text-stone-900">{formatMoney(totalCalculado)}</p>
              <p className="text-xs text-stone-400 mt-1">{items.length} producto(s) | {totalUnidades} unidades en total</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={limpiarFormulario} disabled={sending} className="gap-2 h-11 px-5">
                <RotateCcw className="w-4 h-4" /> Limpiar
              </Button>
              <Button onClick={guardar} disabled={sending} className="gap-2 h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-200">
                <Save className="w-4 h-4" /> {sending ? "Guardando..." : "Guardar Factura"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Consejo:</strong> Los campos con * son obligatorios. El subtotal se calcula automáticamente. Para importar muchas facturas de golpe, usá la pestaña "Importar".
        </p>
      </div>
    </div>
  );
}