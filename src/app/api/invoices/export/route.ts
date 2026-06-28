import { db } from "@/lib/db";
import { NextResponse } from "next/server";
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
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const format = searchParams.get("format") || "basedatos";

    const where: Record<string, unknown> = {};
    if (projectId) {
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

  for (const inv of invoices) {
    // Nombre seguro para la hoja (max 31 chars)
    const rawName = inv.numero || "sin-numero";
    const safeName = rawName
      .replace(/[\\/*?\[\]:]/g, "-")
      .substring(0, 31);
    const ws = workbook.addWorksheet(safeName);

    // Anchos de columna (coinciden con el Excel original)
    ws.columns = [
      { width: 18 },  // A - CANTIDAD / Cliente / Descripción
      { width: 14 },  // B - CODIGO
      { width: 4 },   // C - vacío
      { width: 50 },  // D - DESCRIPCION (merge D:F)
      { width: 3 },   // E
      { width: 3 },   // F
      { width: 14 },  // G - P.UNI
      { width: 14 },  // H - TOTAL / Fecha
    ];

    // ---- FILA 1: Número de factura en G1 ----
    ws.mergeCells("G1:I1");
    const c1 = ws.getCell("G1");
    c1.value = inv.numero;
    c1.font = { bold: true, size: 12, name: "Calibri" };
    c1.alignment = { horizontal: "left" };

    // ---- FILA 2: Tipo en B2 ----
    const c2 = ws.getCell("B2");
    c2.value = inv.tipo || "FC";
    c2.font = { size: 10, name: "Calibri" };

    // ---- FILA 3: Fecha en H3 ----
    const c3 = ws.getCell("H3");
    if (inv.fechaEmision) {
      c3.value = new Date(inv.fechaEmision);
      c3.numFmt = "DD/MM/YYYY";
    }
    c3.font = { size: 10, name: "Calibri" };

    // ---- FILA 4: Cliente en A4 ----
    const c4 = ws.getCell("A4");
    c4.value = inv.proveedor || "";
    c4.font = { bold: true, size: 11, name: "Calibri" };

    // ---- FILA 5-6: Vacíos (dirección, ciudad) ----
    // Se dejan vacíos porque no tenemos esos datos

    // ---- FILA 7: CONTADO ----
    ws.getCell("A7").value = "CONTADO";
    ws.getCell("A7").font = { size: 10, name: "Calibri" };

    // ---- FILA 9: CONTACTO + REMITO ----
    ws.getCell("A9").value = "CONTACTO :";
    ws.getCell("A9").font = { size: 9, name: "Calibri" };
    ws.getCell("G9").value = "REMITO N° 00000000";
    ws.getCell("G9").font = { size: 9, name: "Calibri", color: { argb: GRIS_TEXT } };

    // ---- FILA 12: Encabezados de productos ----
    // Estructura exacta del original: A=CANTIDAD, B=CODIGO, D=DESCRIPCION, G=P.UNI, H=TOTAL
    const headerRow = 11; // 0-indexed = fila 12 en Excel
    const headers = [
      { col: 0, label: "CANTIDAD" },  // A
      { col: 1, label: "CODIGO" },     // B
      { col: 3, label: "DESCRIPCION" }, // D
      { col: 6, label: "P.UNI" },      // G
      { col: 7, label: "TOTAL" },      // H
    ];
    for (const h of headers) {
      const cell = ws.getRow(headerRow + 1).getCell(h.col + 1); // +1 because ExcelJS is 1-indexed
      cell.value = h.label;
      cell.font = { bold: true, size: 10, name: "Calibri" };
      cell.alignment = { horizontal: "center" };
      cell.border = {
        bottom: { style: "thin" as const, color: { argb: "FF000000" } },
        top: { style: "thin" as const, color: { argb: "FF000000" } },
        left: { style: "thin" as const, color: { argb: "FF000000" } },
        right: { style: "thin" as const, color: { argb: "FF000000" } },
      };
    }

    // ---- FILA 12+: Productos ----
    let row = headerRow + 2; // Empezar en fila 13 (0-indexed 12)
    for (const item of inv.items) {
      const currentRow = ws.getRow(row + 1); // ExcelJS 1-indexed

      // A = CANTIDAD
      const cellA = currentRow.getCell(1);
      cellA.value = item.cantidad;
      cellA.alignment = { horizontal: "right" };
      cellA.numFmt = "#,##0";
      cellA.border = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };

      // B = CODIGO
      const cellB = currentRow.getCell(2);
      cellB.value = item.codigo || "";
      cellB.font = { size: 10, name: "Calibri" };
      cellB.border = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };

      // D = DESCRIPCION (merge D:F)
      ws.mergeCells(`D${row + 1}:F${row + 1}`);
      const cellD = currentRow.getCell(4);
      cellD.value = item.producto;
      cellD.font = { size: 10, name: "Calibri" };
      cellD.border = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };

      // G = P.UNI
      const cellG = currentRow.getCell(7);
      cellG.value = item.valorUnit;
      cellG.alignment = { horizontal: "right" };
      cellG.numFmt = "#,##0.00";
      cellG.border = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };

      // H = TOTAL
      const cellH = currentRow.getCell(8);
      cellH.value = item.subtotal;
      cellH.alignment = { horizontal: "right" };
      cellH.numFmt = "#,##0.00";
      cellH.border = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };

      row++;
    }

    // ---- FILA TOTAL (2 filas después del último producto, como en el original) ----
    const totalRow = row + 1; // Dejar una fila de espacio
    ws.mergeCells(`D${totalRow + 1}:F${totalRow + 1}`);
    const totalLabel = ws.getRow(totalRow + 1).getCell(4);
    totalLabel.value = "TOTAL";
    totalLabel.font = { bold: true, size: 10, name: "Calibri" };
    totalLabel.alignment = { horizontal: "right" };

    const totalVal = ws.getRow(totalRow + 1).getCell(8);
    totalVal.value = inv.total;
    totalVal.font = { bold: true, size: 10, name: "Calibri" };
    totalVal.alignment = { horizontal: "right" };
    totalVal.numFmt = "#,##0.00";
    totalVal.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
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
    "Cantidad",
    "Descripción del Producto",
    "Costo Unitario",
    "Subtotal",
    "Hoja de Origen",
    "Archivo de Origen",
  ];

  const headerRow = bd.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
    cell.alignment = {
      horizontal: colNumber >= 4 ? "right" : "left",
      vertical: "middle",
    };
    aplicarBorde(cell, MORADO);
  });

  // Anchos de columna
  bd.columns = [
    { width: 22, key: "numero" },
    { width: 14, key: "fecha" },
    { width: 35, key: "cliente" },
    { width: 11, key: "cantidad" },
    { width: 50, key: "producto" },
    { width: 15, key: "valorUnit" },
    { width: 15, key: "subtotal" },
    { width: 20, key: "hojaOrigen" },
    { width: 30, key: "archivoOrigen" },
  ];

  // Datos
  let rowIndex = 3;
  for (const inv of invoices) {
    for (const item of inv.items) {
      const row = bd.addRow([
        inv.numero,
        formatoFecha(inv.fechaEmision?.toISOString?.() || ""),
        inv.proveedor || "",
        item.cantidad,
        item.producto,
        item.valorUnit,
        item.subtotal,
        inv.hojaOrigen || "",
        inv.archivoOrigen || "",
      ]);

      row.height = 20;
      const esPar = rowIndex % 2 === 0;

      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = {
          horizontal: colNumber >= 4 && colNumber <= 7 ? "right" : "left",
          vertical: "middle",
        };
        aplicarBorde(cell, GRIS_BORDE);

        if (esPar) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
        }
      });

      row.getCell(4).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '#,##0.00';

      const hojaCell = row.getCell(8);
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
    const sumaSubtotal = invoices.reduce((s: number, inv: any) =>
      s + inv.items.reduce((si: number, it: any) => si + it.subtotal, 0), 0);

    const cellCant = totalRow.getCell(4);
    cellCant.value = sumaCantidad;
    cellCant.numFmt = '#,##0';
    cellCant.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cellCant.alignment = { horizontal: "right", vertical: "middle" };
    aplicarBorde(cellCant, MORADO);

    const cellSub = totalRow.getCell(7);
    cellSub.value = sumaSubtotal;
    cellSub.numFmt = '#,##0.00';
    cellSub.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cellSub.alignment = { horizontal: "right", vertical: "middle" };
    aplicarBorde(cellSub, MORADO);

    for (const c of [1, 2, 3, 5, 6, 8, 9]) {
      const celda = totalRow.getCell(c);
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      aplicarBorde(celda, MORADO);
    }
  }

  bd.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + rowIndex - 3, column: headers.length },
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