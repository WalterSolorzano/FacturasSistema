import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Factura");

    // Configuración de columnas
    ws.columns = [
      { width: 15 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];

    // === ENCABEZADO ===
    ws.mergeCells("A1:E1");
    const c1 = ws.getCell("A1");
    c1.value = "FACTURA";
    c1.font = { bold: true, size: 18, name: "Calibri" };
    c1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 36;

    // Número de factura
    ws.mergeCells("A2:E2");
    const c2 = ws.getCell("A2");
    c2.value = invoice.tipo
      ? `Factura ${invoice.tipo} - ${invoice.numero}`
      : invoice.numero;
    c2.font = { bold: true, size: 13, name: "Calibri", color: { argb: "FF1B6B4A" } };
    c2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 28;

    // Fecha
    const fecha = new Date(invoice.fechaEmision);
    const fechaStr = `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;

    ws.mergeCells("A3:E3");
    const c3 = ws.getCell("A3");
    c3.value = `Fecha: ${fechaStr}`;
    c3.font = { size: 11, name: "Calibri", color: { argb: "FF6C757D" } };
    c3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 22;

    // Línea separadora
    ws.mergeCells("A4:E4");
    const c4 = ws.getCell("A4");
    c4.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B6B4A" },
    };
    ws.getRow(4).height = 4;

    // === CLIENTE ===
    ws.getRow(5).height = 22;
    ws.getCell("A5").value = "CLIENTE";
    ws.getCell("A5").font = { bold: true, size: 10, name: "Calibri", color: { argb: "FF1B6B4A" } };
    ws.getCell("B5").value = invoice.cliente;
    ws.getCell("B5").font = { size: 11, name: "Calibri" };

    // Línea separadora
    ws.mergeCells("A6:E6");
    const c6 = ws.getCell("A6");
    c6.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5EE" },
    };
    ws.getRow(6).height = 6;

    // === ENCABEZADO DE TABLA ===
    const headers = ["CODIGO", "CANTIDAD", "PRODUCTO", "TALLA", "VALOR"];
    const headerRow = ws.getRow(7);
    headerRow.height = 26;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = {
        bold: true,
        size: 10,
        name: "Calibri",
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D6A4F" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF2D6A4F" } },
        bottom: { style: "thin", color: { argb: "FF2D6A4F" } },
        left: { style: "thin", color: { argb: "FF2D6A4F" } },
        right: { style: "thin", color: { argb: "FF2D6A4F" } },
      };
    });

    // === PRODUCTOS ===
    invoice.items.forEach((item, i) => {
      const r = ws.getRow(8 + i);
      r.height = 22;

      const vals = [
        item.codigo || "-",
        item.cantidad,
        item.producto,
        item.talla || "-",
        item.valorUnit,
      ];
      const aligns = ["center", "center", "left", "center", "right"];

      vals.forEach((v, j) => {
        const cell = r.getCell(j + 1);
        cell.value = v;
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = {
          horizontal: aligns[j],
          vertical: "middle",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFDEE2E6" } },
          bottom: { style: "thin", color: { argb: "FFDEE2E6" } },
          left: { style: "thin", color: { argb: "FFDEE2E6" } },
          right: { style: "thin", color: { argb: "FFDEE2E6" } },
        };
        if (i % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8F9FA" },
          };
        }
      });

      // Formato numérico
      r.getCell(5).numFmt = '#,##0.00';
    });

    // === TOTAL ===
    const filaTotal = 8 + invoice.items.length + 1;
    ws.mergeCells(`A${filaTotal}:D${filaTotal}`);
    const cTotal = ws.getCell(`A${filaTotal}`);
    cTotal.value = "TOTAL";
    cTotal.font = { bold: true, size: 12, name: "Calibri", color: { argb: "FFFFFFFF" } };
    cTotal.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B6B4A" },
    };
    cTotal.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(filaTotal).height = 28;

    const cTotalVal = ws.getCell(`E${filaTotal}`);
    cTotalVal.value = invoice.total;
    cTotalVal.numFmt = '#,##0.00';
    cTotalVal.font = {
      bold: true,
      size: 14,
      name: "Calibri",
      color: { argb: "FFFFFFFF" },
    };
    cTotalVal.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B6B4A" },
    };
    cTotalVal.alignment = { horizontal: "right", vertical: "middle" };

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Factura_${invoice.numero}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error al exportar factura estandar:", error);
    return NextResponse.json(
      { error: "Error interno." },
      { status: 500 }
    );
  }
}