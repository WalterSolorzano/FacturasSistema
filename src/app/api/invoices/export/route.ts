import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

// Colores del tema
const VERDE = "FF1B6B4A";
const VERDE_CLARO = "FFE8F5EE";
const VERDE_MEDIO = "FFD1E9D6";
const GRIS_CLARO = "FFF8F9FA";
const GRIS_BORDE = "FFDEE2E6";
const BLANCO = "FFFFFFFF";
const NEGRO = "FF212529";
const GRIS_TEXT = "FF6C757D";
const AMARILLO = "FFFFC107";
const ROJO_SUAVE = "FFFDECEA";

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
    workbook.creator = "Sistema de Registro de Facturas";
    workbook.created = new Date();

    // ============================================================
    // HOJA 1: BASE DE DATOS
    // ============================================================
    const bd = workbook.addWorksheet("BaseDeDatos", {
      properties: { tabColor: { argb: VERDE } },
    });

    // --- Título ---
    bd.mergeCells("A1:L1");
    const titulo = bd.getCell("A1");
    titulo.value = "BASE DE DATOS - FACTURAS";
    titulo.font = { bold: true, size: 16, color: { argb: BLANCO } };
    titulo.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: VERDE },
    };
    titulo.alignment = { horizontal: "center", vertical: "middle" };
    bd.getRow(1).height = 38;

    // --- Subtítulo con fecha de generación ---
    bd.mergeCells("A2:L2");
    const subtitulo = bd.getCell("A2");
    subtitulo.value = `Generado el ${formatoFecha(new Date().toISOString())} | ${invoices.length} factura(s) registrada(s)`;
    subtitulo.font = { size: 9, color: { argb: GRIS_TEXT }, italic: true };
    subtitulo.alignment = { horizontal: "center", vertical: "middle" };
    subtitulo.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: VERDE_CLARO },
    };
    bd.getRow(2).height = 22;

    // --- Encabezados de tabla ---
    const headers = [
      "N° Factura",
      "Tipo",
      "Fecha Emisión",
      "Cliente",
      "Código",
      "Producto / Servicio",
      "Talla",
      "Cantidad",
      "Valor Unitario",
      "Subtotal",
      "Total Factura",
      "Fecha de Registro",
    ];

    const headerRow = bd.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = {
        bold: true,
        size: 10,
        color: { argb: BLANCO },
        name: "Calibri",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D6A4F" },
      };
      cell.alignment = {
        horizontal: colNumber >= 8 ? "right" : "left",
        vertical: "middle",
      };
      aplicarBorde(cell, VERDE);
    });

    // --- Columnas ---
    bd.columns = [
      { width: 20, key: "numero" },
      { width: 7, key: "tipo" },
      { width: 14, key: "fecha" },
      { width: 28, key: "cliente" },
      { width: 10, key: "codigo" },
      { width: 30, key: "producto" },
      { width: 9, key: "talla" },
      { width: 11, key: "cantidad", alignment: { horizontal: "right" } },
      { width: 15, key: "valorUnit", alignment: { horizontal: "right" } },
      { width: 15, key: "subtotal", alignment: { horizontal: "right" } },
      { width: 16, key: "total", alignment: { horizontal: "right" } },
      { width: 18, key: "registro" },
    ];

    // --- Datos ---
    let rowIndex = 3;
    for (const inv of invoices) {
      for (const item of inv.items) {
        const row = bd.addRow([
          inv.numero,
          inv.tipo || "-",
          formatoFecha(inv.fechaEmision.toISOString()),
          inv.cliente,
          item.codigo || "-",
          item.producto,
          item.talla || "-",
          item.cantidad,
          item.valorUnit,
          item.subtotal,
          inv.total,
          formatoFecha(inv.createdAt.toISOString()),
        ]);

        row.height = 20;
        const esPar = rowIndex % 2 === 0;

        row.eachCell((cell, colNumber) => {
          cell.font = { size: 10, name: "Calibri" };
          cell.alignment = {
            horizontal: colNumber >= 8 ? "right" : "left",
            vertical: "middle",
          };
          aplicarBorde(cell, GRIS_BORDE);

          if (esPar) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: GRIS_CLARO },
            };
          }
        });

        // Formato numérico con separadores de miles y 2 decimales
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).numFmt = '#,##0.00';

        rowIndex++;
      }
    }

    // --- Fila de totales al final ---
    if (invoices.length > 0) {
      const totalRow = bd.addRow([
        "", "", "", "", "", "", "", "", "", "", "", "",
      ]);
      // Merge "TOTALES" en la primer celda útil
      bd.mergeCells(`A${rowIndex}:G${rowIndex}`);
      const totalLabel = bd.getCell(`A${rowIndex}`);
      totalLabel.value = `TOTALES (${rowIndex - 3} líneas)`;
      totalLabel.font = {
        bold: true,
        size: 10,
        color: { argb: BLANCO },
        name: "Calibri",
      };
      totalLabel.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: VERDE },
      };
      totalLabel.alignment = {
        horizontal: "right",
        vertical: "middle",
      };
      totalRow.height = 24;

      // Suma de subtotales
      const sumaSubtotal = invoices.reduce(
        (s, inv) =>
          s + inv.items.reduce((si, it) => si + it.subtotal, 0),
        0
      );
      const cellSubtotal = totalRow.getCell(10);
      cellSubtotal.value = sumaSubtotal;
      cellSubtotal.numFmt = '#,##0.00';
      cellSubtotal.font = {
        bold: true,
        size: 10,
        color: { argb: BLANCO },
      };
      cellSubtotal.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: VERDE },
      };
      cellSubtotal.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellSubtotal, VERDE);

      // Suma de totales
      const sumaTotal = invoices.reduce((s, inv) => s + inv.total, 0);
      const cellTotal = totalRow.getCell(11);
      cellTotal.value = sumaTotal;
      cellTotal.numFmt = '#,##0.00';
      cellTotal.font = {
        bold: true,
        size: 10,
        color: { argb: BLANCO },
      };
      cellTotal.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: VERDE },
      };
      cellTotal.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellTotal, VERDE);

      // Llenar celdas vacías del total row con el mismo estilo
      for (let c = 8; c <= 9; c++) {
        const celda = totalRow.getCell(c);
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: VERDE },
        };
        aplicarBorde(celda, VERDE);
      }
      for (let c = 12; c <= 12; c++) {
        const celda = totalRow.getCell(c);
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: VERDE },
        };
        aplicarBorde(celda, VERDE);
      }
    }

    // Autofiltro y panel congelado
    bd.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rowIndex - 3, column: headers.length },
    };
    bd.views = [{ state: "frozen", ySplit: 3 }];

    // ============================================================
    // HOJA 2: RESUMEN
    // ============================================================
    const resumen = workbook.addWorksheet("Resumen", {
      properties: { tabColor: { argb: "FFD97706" } },
    });

    // Cálculos
    const totalFacturado = invoices.reduce((s, inv) => s + inv.total, 0);
    const totalItems = invoices.reduce(
      (s, inv) => s + inv.items.length,
      0
    );
    const totalUnidades = invoices.reduce(
      (s, inv) =>
        s + inv.items.reduce((si, it) => si + it.cantidad, 0),
      0
    );

    // Agrupar por cliente
    const porCliente = new Map<
      string,
      { facturas: number; total: number; productos: number }
    >();
    for (const inv of invoices) {
      const existing = porCliente.get(inv.cliente) || {
        facturas: 0,
        total: 0,
        productos: 0,
      };
      existing.facturas += 1;
      existing.total += inv.total;
      existing.productos += inv.items.length;
      porCliente.set(inv.cliente, existing);
    }

    // Agrupar por mes
    const porMes = new Map<string, { facturas: number; total: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.fechaEmision);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const existing = porMes.get(key) || {
        facturas: 0,
        total: 0,
      };
      existing.facturas += 1;
      existing.total += inv.total;
      porMes.set(key, existing);
    }

    resumen.columns = [{ width: 35 }, { width: 20 }, { width: 20 }, { width: 20 }];

    // Título
    resumen.mergeCells("A1:D1");
    const rTitulo = resumen.getCell("A1");
    rTitulo.value = "RESUMEN GENERAL";
    rTitulo.font = { bold: true, size: 16, color: { argb: BLANCO } };
    rTitulo.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: VERDE },
    };
    rTitulo.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(1).height = 38;

    // Métricas principales
    const metricas = [
      { label: "Total de facturas", value: invoices.length.toString() },
      { label: "Total facturado", value: `$${totalFacturado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` },
      { label: "Productos vendidos (líneas)", value: totalItems.toString() },
      { label: "Unidades totales", value: totalUnidades.toLocaleString("es-AR") },
      { label: "Clientes únicos", value: porCliente.size.toString() },
      { label: "Ticket promedio", value: invoices.length > 0 ? `$${(totalFacturado / invoices.length).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "$0.00" },
    ];

    metricas.forEach((m, i) => {
      const r = resumen.getRow(3 + i);
      r.height = 26;

      const cLabel = r.getCell(1);
      cLabel.value = m.label;
      cLabel.font = { size: 11, name: "Calibri", color: { argb: NEGRO } };
      cLabel.alignment = { vertical: "middle" };
      if (i % 2 === 0) {
        cLabel.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: VERDE_CLARO },
        };
      }

      const cValue = r.getCell(2);
      cValue.value = m.value;
      cValue.font = {
        bold: true,
        size: 12,
        name: "Calibri",
        color: { argb: VERDE },
      };
      cValue.alignment = { vertical: "middle" };
      if (i % 2 === 0) {
        cValue.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: VERDE_CLARO },
        };
      }
    });

    // --- Top clientes ---
    const startClientes = 3 + metricas.length + 2;
    resumen.mergeCells(`A${startClientes}:D${startClientes}`);
    const cSec2 = resumen.getCell(`A${startClientes}`);
    cSec2.value = "TOP CLIENTES POR FACTURACIÓN";
    cSec2.font = { bold: true, size: 13, color: { argb: BLANCO } };
    cSec2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: VERDE },
    };
    cSec2.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(startClientes).height = 30;

    // Encabezados de tabla
    const cliHeaders = ["Cliente", "Facturas", "Total Facturado", "Promedio"];
    const cliHeaderRow = resumen.addRow(cliHeaders);
    cliHeaderRow.height = 24;
    cliHeaderRow.eachCell((cell, col) => {
      cell.font = {
        bold: true,
        size: 10,
        color: { argb: BLANCO },
        name: "Calibri",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D6A4F" },
      };
      cell.alignment = {
        horizontal: col >= 2 ? "right" : "left",
        vertical: "middle",
      };
      aplicarBorde(cell, VERDE);
    });

    // Ordenar clientes por total descendente
    const clientesOrdenados = [...porCliente.entries()].sort(
      (a, b) => b[1].total - a[1].total
    );

    clientesOrdenados.forEach(([, data], i) => {
      const r = resumen.addRow([
        data.facturas > 1 ? data.facturas : "",
        data.facturas,
        data.total,
        data.facturas > 0 ? data.total / data.facturas : 0,
      ]);
      // Actually, cliente name should be in column 1
      // Fix: the order is wrong. Let me put cliente name in col 1
    });

    // Fix: re-do the client rows properly
    // Remove the bad rows by overwriting
    // Actually let me redo this properly
    let cliRowNum = startClientes + 2;
    clientesOrdenados.forEach(([clienteNombre, data], i) => {
      const r = resumen.getRow(cliRowNum);
      r.getCell(1).value = clienteNombre;
      r.getCell(1).font = { size: 10, name: "Calibri" };
      r.getCell(2).value = data.facturas;
      r.getCell(2).font = { size: 10, name: "Calibri" };
      r.getCell(2).alignment = { horizontal: "right" };
      r.getCell(3).value = data.total;
      r.getCell(3).numFmt = '#,##0.00';
      r.getCell(3).font = { size: 10, name: "Calibri" };
      r.getCell(3).alignment = { horizontal: "right" };
      r.getCell(4).value =
        data.facturas > 0 ? data.total / data.facturas : 0;
      r.getCell(4).numFmt = '#,##0.00';
      r.getCell(4).font = { size: 10, name: "Calibri" };
      r.getCell(4).alignment = { horizontal: "right" };

      r.eachCell((cell) => {
        aplicarBorde(cell, GRIS_BORDE);
        if (i % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: GRIS_CLARO },
          };
        }
      });

      cliRowNum++;
    });

    // --- Facturación por mes ---
    const startMes = cliRowNum + 2;
    resumen.mergeCells(`A${startMes}:D${startMes}`);
    const cSec3 = resumen.getCell(`A${startMes}`);
    cSec3.value = "FACTURACIÓN POR MES";
    cSec3.font = { bold: true, size: 13, color: { argb: BLANCO } };
    cSec3.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: VERDE },
    };
    cSec3.alignment = { horizontal: "center", vertical: "middle" };
    resumen.getRow(startMes).height = 30;

    const mesHeaders = ["Período", "Facturas", "Total Facturado", ""];
    const mesHeaderRow = resumen.addRow(mesHeaders);
    mesHeaderRow.height = 24;
    mesHeaderRow.eachCell((cell, col) => {
      cell.font = {
        bold: true,
        size: 10,
        color: { argb: BLANCO },
        name: "Calibri",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D6A4F" },
      };
      cell.alignment = { vertical: "middle" };
      aplicarBorde(cell, VERDE);
    });

    // Remove extra column header text
    mesHeaderRow.getCell(4).value = "";

    const mesesOrdenados = [...porMes.entries()].sort((a, b) => {
      const [am, ay] = a[0].split("/").map(Number);
      const [bm, by] = b[0].split("/").map(Number);
      return by !== bm ? by - ay : bm - am;
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

      r.eachCell((cell, colNum) => {
        if (colNum <= 3) {
          aplicarBorde(cell, GRIS_BORDE);
          if (i % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: GRIS_CLARO },
            };
          }
        }
      });

      mesRowNum++;
    });

    // ============================================================
    // HOJA 3: INSTRUCCIONES
    // ============================================================
    const inst = workbook.addWorksheet("Instrucciones", {
      properties: { tabColor: { argb: "FF6C757D" } },
    });
    inst.columns = [{ width: 80 }];

    const instrucciones = [
      { text: "COMO USAR ESTE ARCHIVO", bold: true, size: 16, color: VERDE },
      { text: "", size: 8 },
      {
        text: "Este archivo es la base de datos de todas las facturas registradas en el sistema.",
        bold: false,
        size: 11,
      },
      { text: "", size: 8 },
      { text: "HOJA BASE DE DATOS", bold: true, size: 13, color: VERDE },
      {
        text: "Contiene todas las facturas con sus productos, una fila por cada línea de producto facturado.",
        bold: false,
        size: 11,
      },
      {
        text: "- Podés filtrar por cualquier columna usando los filtros (flechas en los encabezados).",
        bold: false,
        size: 11,
      },
      {
        text: "- La fila de encabezado está congelada para que siempre se vea al hacer scroll.",
        bold: false,
        size: 11,
      },
      {
        text: "- Al final de la tabla está la fila de TOTALES con las sumas generales.",
        bold: false,
        size: 11,
      },
      { text: "", size: 8 },
      { text: "HOJA RESUMEN", bold: true, size: 13, color: VERDE },
      {
        text: "Muestra un resumen con las métricas más importantes del negocio.",
        bold: false,
        size: 11,
      },
      {
        text: "- Total de facturas, total facturado, cantidad de productos y unidades.",
        bold: false,
        size: 11,
      },
      {
        text: "- Ranking de clientes por facturación (quién compró más).",
        bold: false,
        size: 11,
      },
      {
        text: "- Facturación desglosada por mes.",
        bold: false,
        size: 11,
      },
      { text: "", size: 8 },
      { text: "ACTUALIZACIÓN", bold: true, size: 13, color: VERDE },
      {
        text: "Este archivo se genera automáticamente desde el sistema de registro.",
        bold: false,
        size: 11,
      },
      {
        text: "Para actualizarlo, exportá de nuevo desde el sistema y se generará un archivo nuevo con los datos actualizados.",
        bold: false,
        size: 11,
      },
      {
        text: "Si necesitás conservar una versión anterior, renombrá este archivo antes de exportar de nuevo.",
        bold: false,
        size: 11,
      },
    ];

    instrucciones.forEach((instItem, i) => {
      const r = inst.getRow(1 + i);
      r.height = instItem.size >= 13 ? 28 : instItem.size === 8 ? 10 : 20;
      const cell = r.getCell(1);
      cell.value = instItem.text;
      cell.font = {
        bold: instItem.bold || false,
        size: instItem.size || 11,
        name: "Calibri",
        color: instItem.color
          ? { argb: instItem.color }
          : { argb: NEGRO },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });

    // ============================================================
    // GENERAR ARCHIVO
    // ============================================================
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="BaseDeDatos_Facturas.xlsx"',
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