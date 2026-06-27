import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const VERDE = "FF1B6B4A";
const VERDE_OSCURO = "FF14532D";
const VERDE_CLARO = "FFE8F5EE";
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

export async function GET() {
  try {
    const invoices = await db.invoice.findMany({
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Registro de Facturas - CUCIMUNDO";
    workbook.created = new Date();

    // ============================================================
    // HOJA 1: BASE DE DATOS
    // ============================================================
    const bd = workbook.addWorksheet("BaseDeDatos", {
      properties: { tabColor: { argb: VERDE } },
    });

    // Título
    bd.mergeCells("A1:I1");
    const titulo = bd.getCell("A1");
    titulo.value = "BASE DE DATOS - FACTURAS CUCIMUNDO";
    titulo.font = { bold: true, size: 16, color: { argb: BLANCO }, name: "Calibri" };
    titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    titulo.alignment = { horizontal: "center", vertical: "middle" };
    bd.getRow(1).height = 40;

    // Subtítulo
    bd.mergeCells("A2:I2");
    const subtitulo = bd.getCell("A2");
    subtitulo.value = `Generado el ${formatoFecha(new Date().toISOString())} | ${invoices.length} factura(s) registrada(s) | ${invoices.reduce((s, i) => s + i.items.length, 0)} línea(s) de producto`;
    subtitulo.font = { size: 9, color: { argb: GRIS_TEXT }, italic: true, name: "Calibri" };
    subtitulo.alignment = { horizontal: "center", vertical: "middle" };
    subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } };
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
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_OSCURO } };
      cell.alignment = {
        horizontal: colNumber >= 6 ? "right" : "left",
        vertical: "middle",
      };
      aplicarBorde(cell, VERDE);
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
      totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
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
      cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
      cellCant.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellCant, VERDE);

      // Subtotal
      const cellSub = totalRow.getCell(8);
      cellSub.value = sumaSubtotal;
      cellSub.numFmt = '#,##0.00';
      cellSub.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
      cellSub.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellSub, VERDE);

      // Total general
      const cellTotal = totalRow.getCell(9);
      cellTotal.value = sumaTotal;
      cellTotal.numFmt = '#,##0.00';
      cellTotal.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
      cellTotal.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellTotal, VERDE);

      // Llenar celdas vacías del total row
      for (const c of [1, 2, 3, 4, 5, 7]) {
        const celda = totalRow.getCell(c);
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
        if (c >= 1) aplicarBorde(celda, VERDE);
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
    rTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
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
        cLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } };
      }

      const cValue = r.getCell(2);
      cValue.value = m.value;
      cValue.font = { bold: true, size: 12, name: "Calibri", color: { argb: VERDE } };
      cValue.alignment = { vertical: "middle" };
      if (i % 2 === 0) {
        cValue.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } };
      }
    });

    // --- Facturación por mes ---
    const startMes = 3 + metricas.length + 2;
    resumen.mergeCells(`A${startMes}:D${startMes}`);
    const cSec = resumen.getCell(`A${startMes}`);
    cSec.value = "FACTURACIÓN POR MES";
    cSec.font = { bold: true, size: 13, color: { argb: BLANCO }, name: "Calibri" };
    cSec.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    cSec.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(startMes).height = 30;

    const mesHeaders = ["Período", "Facturas", "Total ($)", "Unidades"];
    const mesHeaderRow = resumen.addRow(mesHeaders);
    mesHeaderRow.height = 24;
    mesHeaderRow.eachCell((cell, col) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_OSCURO } };
      cell.alignment = { horizontal: col >= 2 ? "right" : "left", vertical: "middle" };
      aplicarBorde(cell, VERDE);
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
    cSec2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    cSec2.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(startProd).height = 30;

    const prodHeaders = ["Código", "Unidades", "Total ($)", ""];
    const prodHeaderRow = resumen.addRow(prodHeaders);
    prodHeaderRow.height = 24;
    prodHeaderRow.eachCell((cell, col) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_OSCURO } };
      cell.alignment = { horizontal: col >= 2 ? "right" : "left", vertical: "middle" };
      aplicarBorde(cell, VERDE);
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
  } catch (error) {
    console.error("Error al exportar:", error);
    return NextResponse.json(
      { error: "Error interno al exportar." },
      { status: 500 }
    );
  }
}