import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const MORADO = "FF6B21B6";
const MORADO_OSCURO = "FF3B0764";
const MORADO_CLARO = "FFF3E8FF";
const GRIS_CLARO = "FFF8F9FA";
const GRIS_BORDE = "FFDEE2E6";
const BLANCO = "FFFFFFFF";
const NEGRO = "FF212529";
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
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "basedatos";

    const invoices = await db.invoice.findMany({
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
// FORMATO ORIGINAL: cada factura en una hoja (como CUCIMUNDO)
// ============================================================
async function exportarFormatoOriginal(invoices: any[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema CUCIMUNDO";
  workbook.created = new Date();

  const borders: Partial<ExcelJS.Borders> = {
    bottom: { style: "thin" as const, color: { argb: "FF000000" } },
    top: { style: "thin" as const, color: { argb: "FF000000" } },
    left: { style: "thin" as const, color: { argb: "FF000000" } },
    right: { style: "thin" as const, color: { argb: "FF000000" } },
  };

  for (const inv of invoices) {
    const safeName = inv.numero.replace(/[\\/*?\[\]:]/g, "-").substring(0, 31);
    const ws = workbook.addWorksheet(safeName);

    ws.columns = [
      { width: 3 },
      { width: 12 },
      { width: 20 },
      { width: 3 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];

    // Row 1: Invoice number
    ws.mergeCells("G1:I1");
    const c1 = ws.getCell("G1");
    c1.value = inv.numero;
    c1.font = { bold: true, size: 12, name: "Calibri" };
    c1.alignment = { horizontal: "left" };

    // Row 2: Type
    const c2 = ws.getCell("G2");
    c2.value = inv.tipo || "FC";
    c2.font = { size: 10, name: "Calibri" };

    // Row 3: Date
    const c3 = ws.getCell("G3");
    c3.value = inv.fechaEmision;
    c3.numFmt = "DD/MM/YYYY";
    c3.font = { size: 10, name: "Calibri" };

    // Row 4: Provider
    ws.mergeCells("A4:F4");
    const c4 = ws.getCell("A4");
    c4.value = inv.proveedor || "";
    c4.font = { bold: true, size: 11, name: "Calibri" };

    // Row 5: CUIT placeholder
    ws.getCell("A8").value = inv.proveedor || "";
    ws.getCell("A8").font = { size: 9, name: "Calibri", color: { argb: "FF6C757D" } };

    // Row 11: Item headers
    const headerRow = 11;
    const headers = [
      { col: "B", label: "CANTIDAD" },
      { col: "C", label: "CODIGO" },
      { col: "D", label: "DESCRIPCION" },
      { col: "G", label: "P.UNI" },
      { col: "H", label: "TOTAL" },
    ];
    for (const h of headers) {
      const cell = ws.getCell(`${h.col}${headerRow}`);
      cell.value = h.label;
      cell.font = { bold: true, size: 10, name: "Calibri" };
      cell.alignment = { horizontal: "center" };
      cell.border = borders;
    }

    // Items
    let row = headerRow + 1;
    for (const item of inv.items) {
      ws.getCell(`B${row}`).value = item.cantidad;
      ws.getCell(`B${row}`).alignment = { horizontal: "right" };
      ws.getCell(`B${row}`).numFmt = "#,##0";
      ws.getCell(`B${row}`).border = borders;

      ws.getCell(`C${row}`).value = item.codigo || "";
      ws.getCell(`C${row}`).font = { size: 10, name: "Calibri" };
      ws.getCell(`C${row}`).border = borders;

      ws.mergeCells(`D${row}:F${row}`);
      ws.getCell(`D${row}`).value = item.producto;
      ws.getCell(`D${row}`).font = { size: 10, name: "Calibri" };
      ws.getCell(`D${row}`).border = borders;

      ws.getCell(`G${row}`).value = item.valorUnit;
      ws.getCell(`G${row}`).alignment = { horizontal: "right" };
      ws.getCell(`G${row}`).numFmt = "#,##0.00";
      ws.getCell(`G${row}`).border = borders;

      ws.getCell(`H${row}`).value = item.subtotal;
      ws.getCell(`H${row}`).alignment = { horizontal: "right" };
      ws.getCell(`H${row}`).numFmt = "#,##0.00";
      ws.getCell(`H${row}`).border = borders;

      row++;
    }

    // Total row
    ws.mergeCells(`D${row}:F${row}`);
    ws.getCell(`D${row}`).value = "TOTAL";
    ws.getCell(`D${row}`).font = { bold: true, size: 10, name: "Calibri" };
    ws.getCell(`D${row}`).alignment = { horizontal: "right" };
    ws.getCell(`H${row}`).value = inv.total;
    ws.getCell(`H${row}`).font = { bold: true, size: 10, name: "Calibri" };
    ws.getCell(`H${row}`).alignment = { horizontal: "right" };
    ws.getCell(`H${row}`).numFmt = "#,##0.00";
    ws.getCell(`H${row}`).border = borders;
  }

  // Add BaseDeDatos sheet at the beginning
  const bd = workbook.addWorksheet("_BD", {
    properties: { tabColor: { argb: MORADO } },
  });
  // Rename to BaseDeDatos after creation

  bd.mergeCells("A1:I1");
  const titulo = bd.getCell("A1");
  titulo.value = "BASE DE DATOS - FACTURAS CUCIMUNDO";
  titulo.font = { bold: true, size: 14, color: { argb: BLANCO }, name: "Calibri" };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  bd.getRow(1).height = 36;

  const bdHeaders = ["N° Factura", "Tipo", "Fecha", "Codigo", "Descripcion", "Cantidad", "P.Unitario", "Subtotal", "Total Factura"];
  const bdWidths = [20, 7, 13, 12, 45, 11, 14, 14, 16];
  for (let i = 0; i < bdHeaders.length; i++) {
    bd.getColumn(i + 1).width = bdWidths[i];
    const cell = bd.getRow(2).getCell(i + 1);
    cell.value = bdHeaders[i];
    cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
    cell.alignment = { horizontal: i >= 5 ? "right" : "left", vertical: "middle" };
    cell.border = borders;
  }
  bd.getRow(2).height = 24;

  let bdRow = 3;
  for (const inv of invoices) {
    for (const item of inv.items) {
      bd.getRow(bdRow).getCell(1).value = inv.numero;
      bd.getRow(bdRow).getCell(2).value = inv.tipo || "FC";
      bd.getRow(bdRow).getCell(3).value = formatoFecha(inv.fechaEmision.toISOString());
      bd.getRow(bdRow).getCell(4).value = item.codigo || "";
      bd.getRow(bdRow).getCell(5).value = item.producto;
      bd.getRow(bdRow).getCell(6).value = item.cantidad;
      bd.getRow(bdRow).getCell(7).value = item.valorUnit;
      bd.getRow(bdRow).getCell(8).value = item.subtotal;
      bd.getRow(bdRow).getCell(9).value = inv.total;
      for (let c = 1; c <= 9; c++) {
        const cell = bd.getRow(bdRow).getCell(c);
        cell.font = { size: 10, name: "Calibri" };
        cell.border = borders;
        if (c >= 6) cell.numFmt = "#,##0.00";
      }
      bdRow++;
    }
  }
  bd.autoFilter = { from: { row: 2, column: 1 }, to: { row: bdRow - 1, column: 9 } };
  bd.views = [{ state: "frozen", ySplit: 2 }];

  return new NextResponse(Buffer.from(await workbook.xlsx.writeBuffer()), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="CUCIMUNDO_Facturas_Original.xlsx"',
      },
    });
}

// ============================================================
// FORMATO BASE DE DATOS (por defecto)
// ============================================================
async function exportarBaseDeDatos(invoices: any[]) {

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Registro de Facturas - CUCIMUNDO";
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
    titulo.value = "BASE DE DATOS - FACTURAS CUCIMUNDO";
    titulo.font = { bold: true, size: 16, color: { argb: BLANCO }, name: "Calibri" };
    titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    titulo.alignment = { horizontal: "center", vertical: "middle" };
    bd.getRow(1).height = 40;

    // Subtítulo
    bd.mergeCells("A2:I2");
    const subtitulo = bd.getCell("A2");
    subtitulo.value = `Generado el ${formatoFecha(new Date().toISOString())} | ${invoices.length} factura(s) registrada(s) | ${invoices.reduce((s, i) => s + i.items.length, 0)} línea(s) de producto`;
    subtitulo.font = { size: 9, color: { argb: GRIS_TEXT }, italic: true, name: "Calibri" };
    subtitulo.alignment = { horizontal: "center", vertical: "middle" };
    subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_CLARO } };
    bd.getRow(2).height = 22;

    // Encabezados - columnas reales del formato
    const headers = [
      "N° Factura",
      "Tipo",
      "Fecha",
      "Código",
      "Descripción",
      "Cantidad",
      "P.Unitario",
      "Subtotal",
      "Total Factura",
    ];

    const headerRow = bd.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
      cell.alignment = {
        horizontal: colNumber >= 6 ? "right" : "left",
        vertical: "middle",
      };
      aplicarBorde(cell, MORADO);
    });

    // Anchos de columna
    bd.columns = [
      { width: 20, key: "numero" },
      { width: 7, key: "tipo" },
      { width: 13, key: "fecha" },
      { width: 11, key: "codigo" },
      { width: 45, key: "producto" },
      { width: 11, key: "cantidad", alignment: { horizontal: "right" } },
      { width: 14, key: "valorUnit", alignment: { horizontal: "right" } },
      { width: 14, key: "subtotal", alignment: { horizontal: "right" } },
      { width: 16, key: "total", alignment: { horizontal: "right" } },
    ];

    // Datos
    let rowIndex = 3;
    for (const inv of invoices) {
      for (const item of inv.items) {
        const row = bd.addRow([
          inv.numero,
          inv.tipo || "FC",
          formatoFecha(inv.fechaEmision.toISOString()),
          item.codigo || "",
          item.producto,
          item.cantidad,
          item.valorUnit,
          item.subtotal,
          inv.total,
        ]);

        row.height = 20;
        const esPar = rowIndex % 2 === 0;

        row.eachCell((cell, colNumber) => {
          cell.font = { size: 10, name: "Calibri" };
          cell.alignment = {
            horizontal: colNumber >= 6 ? "right" : "left",
            vertical: "middle",
          };
          aplicarBorde(cell, GRIS_BORDE);

          if (esPar) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
          }
        });

        // Formato numérico
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.00';

        rowIndex++;
      }
    }

    // Fila de totales
    if (invoices.length > 0) {
      const totalRow = bd.addRow(Array(9).fill(""));
      bd.mergeCells(`A${rowIndex}:E${rowIndex}`);
      const totalLabel = bd.getCell(`A${rowIndex}`);
      totalLabel.value = `TOTALES (${rowIndex - 3} líneas de producto)`;
      totalLabel.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      totalLabel.alignment = { horizontal: "right", vertical: "middle" };
      totalRow.height = 26;

      const sumaCantidad = invoices.reduce((s, inv) =>
        s + inv.items.reduce((si, it) => si + it.cantidad, 0), 0);
      const sumaSubtotal = invoices.reduce((s, inv) =>
        s + inv.items.reduce((si, it) => si + it.subtotal, 0), 0);
      const sumaTotal = invoices.reduce((s, inv) => s + inv.total, 0);

      // Cantidad total
      const cellCant = totalRow.getCell(6);
      cellCant.value = sumaCantidad;
      cellCant.numFmt = '#,##0';
      cellCant.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      cellCant.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellCant, MORADO);

      // Subtotal
      const cellSub = totalRow.getCell(8);
      cellSub.value = sumaSubtotal;
      cellSub.numFmt = '#,##0.00';
      cellSub.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      cellSub.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellSub, MORADO);

      // Total general
      const cellTotal = totalRow.getCell(9);
      cellTotal.value = sumaTotal;
      cellTotal.numFmt = '#,##0.00';
      cellTotal.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      cellTotal.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellTotal, MORADO);

      // Llenar celdas vacías del total row
      for (const c of [1, 2, 3, 4, 5, 7]) {
        const celda = totalRow.getCell(c);
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
        if (c >= 1) aplicarBorde(celda, MORADO);
      }
    }

    // Autofiltro y panel congelado
    bd.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rowIndex - 3, column: headers.length },
    };
    bd.views = [{ state: "frozen", ySplit: 3 }];

    // ============================================================
    // HOJA 2: RESUMEN POR MES
    // ============================================================
    const resumen = workbook.addWorksheet("Resumen", {
      properties: { tabColor: { argb: "FFD97706" } },
    });

    const totalFacturado = invoices.reduce((s, inv) => s + inv.total, 0);
    const totalItems = invoices.reduce((s, inv) => s + inv.items.length, 0);
    const totalUnidades = invoices.reduce(
      (s, inv) => s + inv.items.reduce((si, it) => si + it.cantidad, 0), 0
    );

    // Agrupar por mes
    const porMes = new Map<string, { facturas: number; total: number; unidades: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.fechaEmision);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const existing = porMes.get(key) || { facturas: 0, total: 0, unidades: 0 };
      existing.facturas += 1;
      existing.total += inv.total;
      existing.unidades += inv.items.reduce((si, it) => si + it.cantidad, 0);
      porMes.set(key, existing);
    }

    // Agrupar por código de producto
    const porProducto = new Map<string, { cantidad: number; total: number }>();
    for (const inv of invoices) {
      for (const item of inv.items) {
        const key = item.codigo || item.producto.substring(0, 30);
        const existing = porProducto.get(key) || { cantidad: 0, total: 0 };
        existing.cantidad += item.cantidad;
        existing.total += item.subtotal;
        porProducto.set(key, existing);
      }
    }

    resumen.columns = [
      { width: 22 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
    ];

    // Título
    resumen.mergeCells("A1:D1");
    const rTitulo = resumen.getCell("A1");
    rTitulo.value = "RESUMEN GENERAL";
    rTitulo.font = { bold: true, size: 16, color: { argb: BLANCO }, name: "Calibri" };
    rTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    rTitulo.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(1).height = 38;

    // Métricas
    const metricas = [
      { label: "Total de facturas", value: invoices.length.toString() },
      { label: "Total facturado ($)", value: totalFacturado.toLocaleString("es-AR", { minimumFractionDigits: 2 }) },
      { label: "Líneas de producto", value: totalItems.toLocaleString("es-AR") },
      { label: "Unidades totales", value: totalUnidades.toLocaleString("es-AR") },
      { label: "Ticket promedio ($)", value: invoices.length > 0 ? (totalFacturado / invoices.length).toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "0.00" },
      { label: "Meses con actividad", value: porMes.size.toString() },
    ];

    metricas.forEach((m, i) => {
      const r = resumen.getRow(3 + i);
      r.height = 26;
      const cLabel = r.getCell(1);
      cLabel.value = m.label;
      cLabel.font = { size: 11, name: "Calibri", color: { argb: NEGRO } };
      cLabel.alignment = { vertical: "middle" };
      if (i % 2 === 0) {
        cLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_CLARO } };
      }

      const cValue = r.getCell(2);
      cValue.value = m.value;
      cValue.font = { bold: true, size: 12, name: "Calibri", color: { argb: MORADO } };
      cValue.alignment = { vertical: "middle" };
      if (i % 2 === 0) {
        cValue.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_CLARO } };
      }
    });

    // --- Facturación por mes ---
    const startMes = 3 + metricas.length + 2;
    resumen.mergeCells(`A${startMes}:D${startMes}`);
    const cSec = resumen.getCell(`A${startMes}`);
    cSec.value = "FACTURACIÓN POR MES";
    cSec.font = { bold: true, size: 13, color: { argb: BLANCO }, name: "Calibri" };
    cSec.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cSec.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(startMes).height = 30;

    const mesHeaders = ["Período", "Facturas", "Total ($)", "Unidades"];
    const mesHeaderRow = resumen.addRow(mesHeaders);
    mesHeaderRow.height = 24;
    mesHeaderRow.eachCell((cell, col) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
      cell.alignment = { horizontal: col >= 2 ? "right" : "left", vertical: "middle" };
      aplicarBorde(cell, MORADO);
    });

    const mesesOrdenados = [...porMes.entries()].sort((a, b) => {
      const [am, ay] = a[0].split("/").map(Number);
      const [bm, by] = b[0].split("/").map(Number);
      return by !== ay ? by - ay : bm - am;
    });

    let mesRowNum = startMes + 2;
    mesesOrdenados.forEach(([mes, data], i) => {
      const r = resumen.getRow(mesRowNum);
      r.getCell(1).value = mes;
      r.getCell(1).font = { size: 10, name: "Calibri" };
      r.getCell(2).value = data.facturas;
      r.getCell(2).font = { size: 10, name: "Calibri" };
      r.getCell(2).alignment = { horizontal: "right" };
      r.getCell(3).value = data.total;
      r.getCell(3).numFmt = '#,##0.00';
      r.getCell(3).font = { size: 10, name: "Calibri" };
      r.getCell(3).alignment = { horizontal: "right" };
      r.getCell(4).value = data.unidades;
      r.getCell(4).numFmt = '#,##0';
      r.getCell(4).font = { size: 10, name: "Calibri" };
      r.getCell(4).alignment = { horizontal: "right" };

      r.eachCell((cell) => {
        aplicarBorde(cell, GRIS_BORDE);
        if (i % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
        }
      });
      mesRowNum++;
    });

    // --- Top productos ---
    const startProd = mesRowNum + 2;
    resumen.mergeCells(`A${startProd}:D${startProd}`);
    const cSec2 = resumen.getCell(`A${startProd}`);
    cSec2.value = "TOP PRODUCTOS POR VENTA";
    cSec2.font = { bold: true, size: 13, color: { argb: BLANCO }, name: "Calibri" };
    cSec2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cSec2.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(startProd).height = 30;

    const prodHeaders = ["Código", "Unidades", "Total ($)", ""];
    const prodHeaderRow = resumen.addRow(prodHeaders);
    prodHeaderRow.height = 24;
    prodHeaderRow.eachCell((cell, col) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
      cell.alignment = { horizontal: col >= 2 ? "right" : "left", vertical: "middle" };
      aplicarBorde(cell, MORADO);
    });
    prodHeaderRow.getCell(4).value = "";

    const productosOrdenados = [...porProducto.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 20);
    let prodRowNum = startProd + 2;
    productosOrdenados.forEach(([codigo, data], i) => {
      const r = resumen.getRow(prodRowNum);
      r.getCell(1).value = codigo;
      r.getCell(1).font = { size: 10, name: "Calibri" };
      r.getCell(2).value = data.cantidad;
      r.getCell(2).numFmt = '#,##0';
      r.getCell(2).font = { size: 10, name: "Calibri" };
      r.getCell(2).alignment = { horizontal: "right" };
      r.getCell(3).value = data.total;
      r.getCell(3).numFmt = '#,##0.00';
      r.getCell(3).font = { size: 10, name: "Calibri" };
      r.getCell(3).alignment = { horizontal: "right" };

      r.eachCell((cell, colNum) => {
        if (colNum <= 3) {
          aplicarBorde(cell, GRIS_BORDE);
          if (i % 2 === 0) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
          }
        }
      });
      prodRowNum++;
    });

    // ============================================================
    // GENERAR
    // ============================================================
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="BaseDeDatos_CUCIMUNDO.xlsx"',
      },
    });
}