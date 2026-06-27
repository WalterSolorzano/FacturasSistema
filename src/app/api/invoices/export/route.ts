import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    const invoices = await db.invoice.findMany({
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("BaseDeDatos");

    // Encabezados
    const headers = [
      "N Factura",
      "Tipo",
      "Fecha de Emision",
      "Cliente",
      "Cantidad",
      "Producto/Servicio",
      "Codigo",
      "Talla",
      "Costo Unitario",
      "Subtotal",
      "Total Factura",
    ];
    const headerRow = worksheet.addRow(headers);

    // Estilo de encabezados
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D6A4F" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    worksheet.columns = [
      { width: 20 },
      { width: 8 },
      { width: 16 },
      { width: 30 },
      { width: 12 },
      { width: 30 },
      { width: 12 },
      { width: 10 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ];

    // Filas de datos
    let rowIndex = 2;
    for (const inv of invoices) {
      for (const item of inv.items) {
        const row = worksheet.addRow([
          inv.numero,
          inv.tipo,
          inv.fechaEmision.toISOString().split("T")[0],
          inv.cliente,
          item.cantidad,
          item.producto,
          item.codigo,
          item.talla,
          item.valorUnit,
          item.subtotal,
          inv.total,
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };
          // Alternar colores de fila
          if (rowIndex % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F7F4" },
            };
          }
        });

        // Formato numérico
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).numFmt = '#,##0.00';

        rowIndex++;
      }
    }

    // Auto-filtro
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // Congelar panel
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

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