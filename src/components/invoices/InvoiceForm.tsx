"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(value);
}

// Custom input that handles Enter to move to next field
function CellInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  type = "text",
  align = "left",
  className = "",
  inputRef,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  type?: string;
  align?: "left" | "center" | "right";
  className?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`h-9 px-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-shadow ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    />
  );
}

export function InvoiceForm() {
  const { setActiveTab, triggerRefresh } = useAppStore();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("FC");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [proveedor, setProveedor] = useState("");
  const [items, setItems] = useState<ItemRow[]>([createEmptyItem()]);

  // Refs for keyboard navigation
  const headerRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const agregarFila = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const quitarFila = useCallback((id: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }, []);

  const actualizarItem = useCallback(
    (id: number, campo: keyof ItemRow, valor: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
      );
    },
    []
  );

  // Focus an item field by row index and column name
  const focusItemField = useCallback((rowIdx: number, col: string) => {
    setTimeout(() => {
      const key = `${rowIdx}-${col}`;
      itemRefs.current[key]?.focus();
      itemRefs.current[key]?.select();
    }, 10);
  }, []);

  // Focus a header field
  const focusHeaderField = useCallback((name: string) => {
    setTimeout(() => {
      headerRefs.current[name]?.focus();
      headerRefs.current[name]?.select();
    }, 10);
  }, []);

  // Handle Enter key in item fields: move down or create new row
  const handleItemKeyDown = useCallback(
    (rowIdx: number, col: "codigo" | "producto" | "cantidad" | "valorUnit", e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const colOrder: ("codigo" | "producto" | "cantidad" | "valorUnit")[] = ["codigo", "producto", "cantidad", "valorUnit"];
        const colIdx = colOrder.indexOf(col);

        if (colIdx < colOrder.length - 1) {
          // Move to next column in same row
          focusItemField(rowIdx, colOrder[colIdx + 1]);
        } else if (rowIdx < items.length - 1) {
          // Move to first column of next row
          focusItemField(rowIdx + 1, "codigo");
        } else {
          // Last row, last column -> create new row and focus it
          setItems((prev) => {
            const newItem = createEmptyItem();
            // Focus after state update
            setTimeout(() => focusItemField(prev.length, "codigo"), 30);
            return [...prev, newItem];
          });
        }
      } else if (e.key === "Tab" && e.shiftKey && col === "codigo" && rowIdx === 0) {
        // Shift+Tab from first item's first field -> go to last header field
        e.preventDefault();
        focusHeaderField("proveedor");
      }
    },
    [items.length, focusItemField, focusHeaderField]
  );

  // Handle Enter in header fields
  const handleHeaderKeyDown = useCallback(
    (currentField: string, nextField: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (nextField === "items-start") {
          focusItemField(0, "codigo");
        } else {
          focusHeaderField(nextField);
        }
      }
    },
    [focusHeaderField, focusItemField]
  );

  const limpiarFormulario = useCallback(() => {
    setNumero("");
    setTipo("FC");
    setFecha(new Date().toISOString().split("T")[0]);
    setProveedor("");
    setItems([createEmptyItem()]);
    setTimeout(() => focusHeaderField("numero"), 30);
  }, [focusHeaderField]);

  const totalCalculado = items.reduce((sum, item) => {
    const cant = parseFloat(item.cantidad) || 0;
    const val = parseFloat(item.valorUnit) || 0;
    return sum + cant * val;
  }, 0);

  const totalUnidades = items.reduce((sum, item) => sum + (parseFloat(item.cantidad) || 0), 0);

  const guardar = async () => {
    if (!numero.trim()) {
      toast({ title: "Dato faltante", description: "Ingresá el número de factura.", variant: "destructive" });
      focusHeaderField("numero");
      return;
    }
    if (!fecha) {
      toast({ title: "Dato faltante", description: "Seleccioná la fecha.", variant: "destructive" });
      focusHeaderField("fecha");
      return;
    }
    const validItems = items.filter((item) => item.producto.trim() && parseFloat(item.cantidad) > 0);
    if (validItems.length === 0) {
      toast({ title: "Sin productos", description: "Agregá al menos un producto con descripción y cantidad.", variant: "destructive" });
      focusItemField(0, "producto");
      return;
    }

    setSending(true);
    try {
      const body = {
        numero: numero.trim(),
        tipo: tipo.trim(),
        fechaEmision: fecha,
        proveedor: proveedor.trim(),
        items: validItems.map((item) => ({
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
        title: "Factura guardada",
        description: `${numero.trim()} — ${validItems.length} ítem(es) — ${formatMoney(data.total)}`,
      });

      triggerRefresh();
      limpiarFormulario();
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

  // Scroll to bottom when new row is added
  const lastRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (items.length > 1) {
      lastRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [items.length]);

  return (
    <div className="space-y-4 animate-in fade-in max-w-5xl" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Nueva factura</h2>
          <p className="text-sm text-stone-500 mt-0.5">Completá los datos y presioná Enter para avanzar entre campos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={limpiarFormulario} disabled={sending} className="gap-1.5 h-9">
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar
          </Button>
          <Button onClick={guardar} disabled={sending} className="gap-1.5 h-9 px-5 bg-purple-800 hover:bg-purple-900 text-white font-semibold shadow-sm">
            <Save className="w-3.5 h-3.5" /> {sending ? "Guardando..." : "Guardar factura"}
          </Button>
        </div>
      </div>

      {/* Header fields - Excel style */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">N° Factura</label>
              <CellInput
                inputRef={(el) => { headerRefs.current["numero"] = el; }}
                value={numero} onChange={setNumero} placeholder="FC 000-0008806"
                onKeyDown={(e) => handleHeaderKeyDown("numero", "tipo", e)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tipo</label>
              <CellInput
                inputRef={(el) => { headerRefs.current["tipo"] = el; }}
                value={tipo} onChange={setTipo} placeholder="FC"
                onKeyDown={(e) => handleHeaderKeyDown("tipo", "fecha", e)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Fecha</label>
              <CellInput
                inputRef={(el) => { headerRefs.current["fecha"] = el; }}
                type="date" value={fecha} onChange={setFecha}
                onKeyDown={(e) => handleHeaderKeyDown("fecha", "proveedor", e)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Razón Social</label>
              <CellInput
                inputRef={(el) => { headerRefs.current["proveedor"] = el; }}
                value={proveedor} onChange={setProveedor} placeholder="Nombre del proveedor"
                onKeyDown={(e) => handleHeaderKeyDown("proveedor", "items-start", e)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items table - Excel spreadsheet style */}
      <Card className="border-0 shadow-sm">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Productos</span>
          <Button type="button" variant="ghost" size="sm" onClick={agregarFila} className="gap-1 text-purple-700 text-xs h-7">
            <Plus className="w-3.5 h-3.5" /> Agregar fila
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[90px]">Codigo</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2">Descripcion</th>
                <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[80px]">Cant.</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[120px]">P.Unitario</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2 w-[110px]">Subtotal</th>
                <th className="w-[36px]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIdx) => {
                const cant = parseFloat(item.cantidad) || 0;
                const val = parseFloat(item.valorUnit) || 0;
                const sub = cant * val;
                const isLast = rowIdx === items.length - 1;

                return (
                  <tr
                    key={item.id}
                    ref={isLast ? lastRowRef : undefined}
                    className={`border-b border-stone-100 hover:bg-purple-50/40 transition-colors ${
                      !item.producto && !item.cantidad ? "bg-stone-50/50" : ""
                    }`}
                  >
                    <td className="px-1.5 py-1">
                      <CellInput
                        inputRef={(el) => { itemRefs.current[`${rowIdx}-codigo`] = el; }}
                        value={item.codigo}
                        onChange={(v) => actualizarItem(item.id, "codigo", v)}
                        onKeyDown={(e) => handleItemKeyDown(rowIdx, "codigo", e)}
                        placeholder="S-0100"
                        className="font-mono text-xs"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <CellInput
                        inputRef={(el) => { itemRefs.current[`${rowIdx}-producto`] = el; }}
                        value={item.producto}
                        onChange={(v) => actualizarItem(item.id, "producto", v)}
                        onKeyDown={(e) => handleItemKeyDown(rowIdx, "producto", e)}
                        placeholder="Nombre del producto"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <CellInput
                        inputRef={(el) => { itemRefs.current[`${rowIdx}-cantidad`] = el; }}
                        type="number" align="center"
                        value={item.cantidad}
                        onChange={(v) => actualizarItem(item.id, "cantidad", v)}
                        onKeyDown={(e) => handleItemKeyDown(rowIdx, "cantidad", e)}
                        placeholder="0"
                        className="font-mono"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <CellInput
                        inputRef={(el) => { itemRefs.current[`${rowIdx}-valorUnit`] = el; }}
                        type="number" align="right"
                        value={item.valorUnit}
                        onChange={(v) => actualizarItem(item.id, "valorUnit", v)}
                        onKeyDown={(e) => handleItemKeyDown(rowIdx, "valorUnit", e)}
                        placeholder="0.00"
                        className="font-mono"
                      />
                    </td>
                    <td className="px-3 py-1 text-right">
                      <span className={`text-sm font-medium ${sub > 0 ? "text-stone-800" : "text-stone-300"}`}>
                        {sub > 0 ? formatMoney(sub) : "-"}
                      </span>
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => quitarFila(item.id)}
                        disabled={items.length <= 1}
                        className="w-7 h-7 rounded flex items-center justify-center text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        title="Quitar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with totals */}
        <div className="px-4 py-3 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between">
          <span className="text-xs text-stone-400">{items.filter((i) => i.producto).length} producto(s) | {totalUnidades} unidades</span>
          <div className="text-right">
            <span className="text-xs text-stone-500 mr-2">Total</span>
            <span className="text-lg font-bold text-stone-900">{formatMoney(totalCalculado)}</span>
          </div>
        </div>
      </Card>

      <p className="text-xs text-stone-400 text-center">
        Enter para avanzar entre campos | Tab para saltar columnas | La ultima columna crea fila nueva automaticamente
      </p>
    </div>
  );
}
