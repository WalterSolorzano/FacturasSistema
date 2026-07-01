import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import ExcelJS from "exceljs";

const MORADO = "FF6B21A8";
const MORADO_OSCURO = "FF3B0764";
const MORADO_CLARO = "FFF3E8FF";
const GRIS_CLARO = "FFF8F9FA";
const GRIS_BORDE = "FFDEE2E6";
const BLANCO = "FFFFFFFF";
const GRIS_TEXT = "FF6C757D";

function aplicarBorde(cell: ExcelJS.Cell, color: string = GRIS_BORDE) {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function formatoFecha(isoStr: string): string {
  if (!isoStr) return "SIN FECHA";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "FECHA INVÁLIDA";
  if (d.getFullYear() === 1970) return "SIN FECHA";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const projectIds = searchParams.get("projectIds");
    const format = searchParams.get("format") || "basedatos";

    const where: Record<string, unknown> = {};
    if (projectIds) {
      where.projectId = { in: projectIds.split(",") };
    } else if (projectId) {
      where.projectId = projectId;
    }

    const invoices = await db.invoice.findMany({
      where,
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
    });

    if (format === "original") {
      return exportarFormatoOriginal(invoices);
    }

    return exportarBaseDeDatos(invoices);
  } catch (error) {
    console.error("Error al exportar:", error);
    return NextResponse.json(
      { error: "Error interno al exportar." },
      { status: 500 }
    );
  }
}

// ============================================================
// FORMATO ORIGINAL: cada factura en una hoja con la estructura
// EXACTA del Excel de referencia CUCIMUNDO:
//
// Fila 1 (r=0): G1 = "FC 000-0008805" (merge G:I)
// Fila 2 (r=1): B2 = "FC"
// Fila 3 (r=2): H3 = fecha
// Fila 4 (r=3): A4 = cliente, F4 = número interno
// Fila 5 (r=4): A5 = dirección (vacía en export)
// Fila 6 (r=5): A6 = ciudad + tel (vacío en export)
// Fila 7 (r=6): A7 = "CONTADO"
// Fila 8 (r=7): A8 = "C.U.I.T.: " (vacío)
// Fila 9 (r=8): A9 = "CONTACTO: " (vacío), G9 = "REMITO N° 00000000"
// Fila 10 (r=9): vacía
// Fila 11 (r=10): vacía
// Fila 12 (r=11): A12=CANTIDAD, B12=CODIGO, D12=DESCRIPCION, G12=P.UNI, H12=TOTAL
// Fila 13+ (r=12+): Productos
// Última fila: D=TOTAL, H=valor total
// ============================================================
async function exportarFormatoOriginal(invoices: any[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Facturas";
  workbook.created = new Date();

  const sheetNames = new Set<string>();

  for (const inv of invoices) {
    // Nombre seguro para la hoja (max 31 chars)
    const rawName = inv.numero || "sin-numero";
    let safeName = rawName
      .replace(/[\\/*?\[\]:]/g, "-")
      .substring(0, 31);
    
    // Garantizar que el nombre de la hoja sea único (ExcelJS lanza error si está duplicado)
    let counter = 1;
    let finalName = safeName;
    while (sheetNames.has(finalName)) {
      counter++;
      const suffix = ` (${counter})`;
      finalName = safeName.substring(0, 31 - suffix.length) + suffix;
    }
    sheetNames.add(finalName);

    const ws = workbook.addWorksheet(finalName);

    // Anchos de columna (coinciden con el Excel original)
    ws.columns = [
      { width: 18 },  // A - CANTIDAD / Cliente
      { width: 14 },  // B - CODIGO
      { width: 4 },   // C - vacío
      { width: 50 },  // D - DESCRIPCION
      { width: 3 },   // E
      { width: 3 },   // F
      { width: 14 },  // G - P.UNI
      { width: 14 },  // H - TOTAL
    ];

    const plainFont = { size: 10, name: "Calibri" };
    const boldFont = { bold: true, size: 10, name: "Calibri" };
    const boldFontSm = { bold: true, size: 12, name: "Calibri" };

    // ---- FILA 1 (r=0): Número de factura en G1 (SIN merge) ----
    ws.getCell("G1").value = inv.numero;
    ws.getCell("G1").font = boldFontSm;

    // ---- FILA 2 (r=1): Tipo en B2 ----
    ws.getCell("B2").value = inv.tipo || "FC";
    ws.getCell("B2").font = plainFont;

    // ---- FILA 3 (r=2): Fecha en H3 ----
    if (inv.fechaEmision) {
      const d = new Date(inv.fechaEmision);
      if (d.getFullYear() === 1970) {
        ws.getCell("H3").value = "SIN FECHA";
      } else {
        ws.getCell("H3").value = d;
        ws.getCell("H3").numFmt = "DD/MM/YYYY";
      }
    }
    ws.getCell("H3").font = plainFont;

    // ---- FILA 4 (r=3): Cliente en A4, Cód. Cliente en F4 ----
    ws.getCell("A4").value = inv.proveedor || "";
    ws.getCell("A4").font = boldFont;
    ws.getCell("F4").value = inv.clienteCodigo || "";
    ws.getCell("F4").font = plainFont;

    // ---- FILA 5 (r=4): Dirección ----
    ws.getCell("A5").value = inv.clienteDireccion || "";
    ws.getCell("A5").font = plainFont;

    // ---- FILA 6 (r=5): Ciudad y Teléfono ----
    ws.getCell("A6").value = inv.clienteCiudadTel || "";
    ws.getCell("A6").font = plainFont;

    // ---- FILA 7 (r=6): Condición de Venta ----
    ws.getCell("A7").value = inv.condicionVenta || "CONTADO";
    ws.getCell("A7").font = plainFont;

    // ---- FILA 8 (r=7): CUIT ----
    ws.getCell("A8").value = inv.clienteCuit || "C.U.I.T.: ";
    ws.getCell("A8").font = plainFont;

    // ---- FILA 9 (r=8): CONTACTO + REMITO ----
    ws.getCell("A9").value = inv.clienteContacto || "CONTACTO :";
    ws.getCell("A9").font = { size: 9, name: "Calibri" };
    ws.getCell("G9").value = inv.remito || "REMITO N° 00000000";
    ws.getCell("G9").font = { size: 9, name: "Calibri" };

    // ---- FILA 11 (r=10): Encabezados de productos ----
    // Sin merge, sin color, sin bordes — plano como el original
    ws.getCell("A11").value = "CANTIDAD";
    ws.getCell("A11").font = boldFont;
    ws.getCell("B11").value = "CODIGO";
    ws.getCell("B11").font = boldFont;
    ws.getCell("D11").value = "DESCRIPCION";
    ws.getCell("D11").font = boldFont;
    ws.getCell("G11").value = "P.UNI";
    ws.getCell("G11").font = boldFont;
    ws.getCell("H11").value = "TOTAL";
    ws.getCell("H11").font = boldFont;

    // ---- FILA 15+ (r=14+): Productos ----
    let row = 15; // Excel 1-indexed
    let totalCantidad = 0;
    
    for (const item of inv.items) {
      totalCantidad += item.cantidad;
      
      // A = CANTIDAD
      ws.getCell(row, 1).value = item.cantidad;
      ws.getCell(row, 1).font = plainFont;
      ws.getCell(row, 1).numFmt = "#,##0";

      // B = CODIGO
      ws.getCell(row, 2).value = item.codigo || "";
      ws.getCell(row, 2).font = plainFont;

      // D = DESCRIPCION (sin merge)
      ws.getCell(row, 4).value = item.producto;
      ws.getCell(row, 4).font = plainFont;

      let valorUnitExcel: string | number = item.valorUnit;
      let subtotalExcel: string | number = item.subtotal;
      
      if (item.valorUnit === 0) {
        const prodUpper = item.producto.toUpperCase();
        if (prodUpper.includes("CAMBIO")) {
          valorUnitExcel = "CAMBIO";
          subtotalExcel = "CAMBIO";
        } else if (prodUpper.includes("DEVOLUCION") || prodUpper.includes("DEVOLUCIÓN")) {
          valorUnitExcel = "DEVOLUCION";
          subtotalExcel = "DEVOLUCION";
        } else {
          valorUnitExcel = "SIN CARGO";
          subtotalExcel = "SIN CARGO";
        }
      }

      // G = P.UNI
      ws.getCell(row, 7).value = valorUnitExcel;
      ws.getCell(row, 7).font = plainFont;
      if (typeof valorUnitExcel === 'number') ws.getCell(row, 7).numFmt = "#,##0.00";

      // H = TOTAL
      ws.getCell(row, 8).value = subtotalExcel;
      ws.getCell(row, 8).font = plainFont;
      if (typeof subtotalExcel === 'number') ws.getCell(row, 8).numFmt = "#,##0.00";

      row++;
    }

    // ---- FILA TOTAL (unas filas después del último producto) ----
    const finalTotalRow = row + 10; // Dejamos algo de espacio (como en la imagen que está en la fila 33, mientras los productos terminaron en 21)
    
    // Suma de unidades en la columna A
    ws.getCell(finalTotalRow - 8, 1).value = totalCantidad;
    ws.getCell(finalTotalRow - 8, 1).font = plainFont;
    ws.getCell(finalTotalRow - 8, 1).numFmt = "#,##0";
    
    // Total en la columna H
    ws.getCell(finalTotalRow, 8).value = inv.total;
    ws.getCell(finalTotalRow, 8).font = plainFont;
    ws.getCell(finalTotalRow, 8).numFmt = "#,##0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Facturas_Original.xlsx"',
    },
  });
}

// ============================================================
// FORMATO BASE DE DATOS — Columnas que pidió el usuario:
// Número de Factura | Fecha de Emisión | Nombre del Cliente |
// Cantidad | Descripción | Costo Unitario | Subtotal | Hoja Origen
// ============================================================
async function exportarBaseDeDatos(invoices: any[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Facturas";
  workbook.created = new Date();

  // ============================================================
  // HOJA 1: BASE DE DATOS
  // ============================================================
  const bd = workbook.addWorksheet("BaseDeDatos", {
    properties: { tabColor: { argb: MORADO } },
  });

  // Título
  bd.mergeCells("A1:I1");
  const titulo = bd.getCell("A1");
  titulo.value = "BASE DE DATOS - FACTURAS";
  titulo.font = { bold: true, size: 16, color: { argb: BLANCO }, name: "Calibri" };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  bd.getRow(1).height = 40;

  // Subtítulo
  const totalLineas = invoices.reduce((s: number, i: any) => s + i.items.length, 0);
  bd.mergeCells("A2:I2");
  const subtitulo = bd.getCell("A2");
  subtitulo.value = `Generado el ${formatoFecha(new Date().toISOString())} | ${invoices.length} factura(s) | ${totalLineas} línea(s) de producto`;
  subtitulo.font = { size: 9, color: { argb: GRIS_TEXT }, italic: true, name: "Calibri" };
  subtitulo.alignment = { horizontal: "center", vertical: "middle" };
  subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_CLARO } };
  bd.getRow(2).height = 22;

  // Encabezados — exactamente los campos que pidió el usuario
  const headers = [
    "Número de Factura",
    "Fecha de Emisión",
    "Nombre del Cliente",
    "Cantidad de Productos Emitidos",
    "Descripción/Nombre del Producto Emitido",
    "Costo de dicho Producto",
    "",
    "",
    "Hoja de Excel Origen",
  ];

  const headerRow = bd.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber === 7 || colNumber === 8) return; // Columnas vacías
    cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
    cell.alignment = {
      horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left",
      vertical: "middle",
    };
    aplicarBorde(cell, MORADO);
  });

  // Anchos de columna
  bd.columns = [
    { width: 22, key: "numero" },
    { width: 14, key: "fecha" },
    { width: 35, key: "cliente" },
    { width: 28, key: "cantidad" },
    { width: 50, key: "producto" },
    { width: 22, key: "valorUnit" },
    { width: 5, key: "vacio1" },
    { width: 5, key: "vacio2" },
    { width: 20, key: "hojaOrigen" },
  ];

  // Datos
  let rowIndex = 3;
  for (const inv of invoices) {
    for (const item of inv.items) {
      let valorUnitExcel: string | number = item.valorUnit;
      if (item.valorUnit === 0) {
        const prodUpper = item.producto.toUpperCase();
        if (prodUpper.includes("CAMBIO")) {
          valorUnitExcel = "CAMBIO";
        } else if (prodUpper.includes("DEVOLUCION") || prodUpper.includes("DEVOLUCIÓN")) {
          valorUnitExcel = "DEVOLUCION";
        } else {
          valorUnitExcel = "SIN CARGO";
        }
      }

      const row = bd.addRow([
        inv.numero,
        formatoFecha(inv.fechaEmision?.toISOString?.() || ""),
        inv.proveedor || "",
        item.cantidad,
        item.producto,
        valorUnitExcel,
        "",
        "",
        inv.hojaOrigen || "",
      ]);

      row.height = 20;
      const esPar = rowIndex % 2 === 0;

      row.eachCell((cell, colNumber) => {
        if (colNumber === 7 || colNumber === 8) return; // Columnas vacías
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = {
          horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left",
          vertical: "middle",
        };
        aplicarBorde(cell, GRIS_BORDE);

        if (esPar) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
        }
      });

      row.getCell(4).numFmt = '#,##0';
      if (typeof valorUnitExcel === 'number') {
        row.getCell(6).numFmt = '#,##0.00';
      }

      const hojaCell = row.getCell(9);
      hojaCell.font = { size: 9, name: "Calibri", color: { argb: GRIS_TEXT }, italic: true };

      rowIndex++;
    }
  }

  // Fila de totales
  if (invoices.length > 0) {
    const totalRow = bd.addRow(Array(9).fill(""));
    bd.mergeCells(`A${rowIndex}:C${rowIndex}`);
    const totalLabel = bd.getCell(`A${rowIndex}`);
    totalLabel.value = `TOTALES (${rowIndex - 3} líneas de producto)`;
    totalLabel.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    totalLabel.alignment = { horizontal: "right", vertical: "middle" };
    totalRow.height = 26;

    const sumaCantidad = invoices.reduce((s: number, inv: any) =>
      s + inv.items.reduce((si: number, it: any) => si + it.cantidad, 0), 0);

    const cellCant = totalRow.getCell(4);
    cellCant.value = sumaCantidad;
    cellCant.numFmt = '#,##0';
    cellCant.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cellCant.alignment = { horizontal: "right", vertical: "middle" };
    aplicarBorde(cellCant, MORADO);

    // Darle fondo morado a las otras celdas para que la línea se vea completa
    for (const c of [1, 2, 3, 5, 6, 9]) {
      const celda = totalRow.getCell(c);
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      aplicarBorde(celda, MORADO);
    }
  }

  bd.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + rowIndex - 3, column: 9 }, // Hasta columna 9 (I)
  };
  bd.views = [{ state: "frozen", ySplit: 3 }];

  // ============================================================
  // HOJA 2: TRAZABILIDAD
  // ============================================================
  const traza = workbook.addWorksheet("Trazabilidad", {
    properties: { tabColor: { argb: "FF0EA5E9" } },
  });

  traza.mergeCells("A1:F1");
  const tTitulo = traza.getCell("A1");
  tTitulo.value = "TRAZABILIDAD — ORIGEN DE DATOS";
  tTitulo.font = { bold: true, size: 14, color: { argb: BLANCO }, name: "Calibri" };
  tTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
  tTitulo.alignment = { horizontal: "center", vertical: "middle" };
  traza.getRow(1).height = 36;

  const trazaHeaders = [
    "Número de Factura",
    "Archivo Excel",
    "Hoja",
    "Fecha",
    "Total",
    "Advertencias",
  ];
  const trazaHeaderRow = traza.addRow(trazaHeaders);
  trazaHeaderRow.height = 24;
  trazaHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
    cell.alignment = { horizontal: colNumber === 5 ? "right" : "left", vertical: "middle" };
    aplicarBorde(cell, MORADO);
  });

  traza.columns = [
    { width: 22 },
    { width: 30 },
    { width: 20 },
    { width: 14 },
    { width: 14 },
    { width: 50 },
  ];

  let trazaRow = 2;
  for (const inv of invoices) {
    const row = traza.addRow([
      inv.numero,
      inv.archivoOrigen || "(creación manual)",
      inv.hojaOrigen || "",
      formatoFecha(inv.fechaEmision?.toISOString?.() || ""),
      inv.total,
      inv.advertencias || "",
    ]);

    row.height = 20;
    row.eachCell((cell) => {
      cell.font = { size: 10, name: "Calibri" };
      aplicarBorde(cell, GRIS_BORDE);
      if (trazaRow % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
      }
    });

    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(5).alignment = { horizontal: "right" };

    if (inv.advertencias) {
      row.getCell(6).font = { size: 9, name: "Calibri", color: { argb: "FF0284C7" } };
    }

    trazaRow++;
  }

  traza.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: trazaRow - 1, column: 6 },
  };
  traza.views = [{ state: "frozen", ySplit: 2 }];

  // ============================================================
  // GENERAR
  // ============================================================
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="BaseDeDatos.xlsx"',
    },
  });
}