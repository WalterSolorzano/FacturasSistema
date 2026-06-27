import * as XLSX from "xlsx";

// ============================================================
// Tipos
// ============================================================
export interface ProductoExtraido {
  codigo: string;
  producto: string;
  cantidad: number;
  valorUnit: number;
  subtotal: number;
}

export interface FacturaExtraida {
  numero: string;
  tipo: string;
  fecha: string; // ISO string
  proveedor: string;
  productos: ProductoExtraido[];
  total: number;
  hoja: string;
  errores: string[];
  exito: boolean;
}

// ============================================================
// LEER CELDA SEGURA
// ============================================================
function getCelda(
  hoja: XLSX.WorkSheet,
  fila: number,
  col: number
): XLSX.CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: fila, c: col });
  return hoja[addr];
}

function getStr(hoja: XLSX.WorkSheet, fila: number, col: number): string {
  const c = getCelda(hoja, fila, col);
  if (!c || c.v === undefined || c.v === null) return "";
  return String(c.v).trim();
}

function getNum(hoja: XLSX.WorkSheet, fila: number, col: number): number {
  const c = getCelda(hoja, fila, col);
  if (!c || c.v === undefined || c.v === null) return 0;
  const n = typeof c.v === "number" ? c.v : parseFloat(String(c.v));
  return isNaN(n) ? 0 : n;
}

// ============================================================
// DETECTAR FORMATO DE LA HOJA
// Cada hoja de CUCIMUNDO tiene variaciones en posición de columnas.
// Devuelve las posiciones clave o null si no es factura válida.
// ============================================================
interface FormatoHoja {
  filaHeader: number;     // fila donde están CANTIDAD, CODIGO, DESCRIPCION...
  colCantidad: number;    // columna de CANTIDAD
  colCodigo: number;      // columna de CODIGO
  colDescripcion: number; // columna de DESCRIPCION
  colPUnit: number;       // columna de P.UNI
  colTotal: number;       // columna de TOTAL (por ítem)
  colNumero: number;      // columna del número de factura en fila 1
  colFecha: number;       // columna de la fecha en fila 3
}

function detectarFormato(hoja: XLSX.WorkSheet): FormatoHoja | null {
  if (!hoja["!ref"]) return null;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  // Buscar la fila de encabezados buscando "CANTIDAD" y "DESCRIPCION"
  for (let r = Math.max(rango.s.r, 8); r <= Math.min(rango.e.r, 15); r++) {
    let colCantidad = -1;
    let colCodigo = -1;
    let colDescripcion = -1;
    let colPUnit = -1;
    let colTotal = -1;

    for (let c = rango.s.c; c <= Math.min(rango.e.c, 12); c++) {
      const val = getStr(hoja, r, c).toUpperCase();

      if (val === "CANTIDAD") colCantidad = c;
      else if (val === "CODIGO") colCodigo = c;
      else if (val === "DESCRIPCION" || val === "DESCRIPCIÓN") colDescripcion = c;
      else if (val === "P.UNI") colPUnit = c;
      else if (val === "TOTAL") colTotal = c;
    }

    // Validar que encontramos los campos clave
    if (colCantidad >= 0 && colDescripcion >= 0 && colPUnit >= 0 && colTotal >= 0) {
      // Determinar posición del número de factura en fila 0 (0-indexed)
      let colNumero = 6; // default

      for (let c = rango.s.c; c <= Math.min(rango.e.c, 12); c++) {
        const v = getStr(hoja, 0, c);
        if (v.includes("FC 00") || v.includes("FC-00")) {
          colNumero = c;
          break;
        }
      }

      // La fecha está en la misma columna que el número o una a la derecha
      let colFecha = colNumero + 1;

      // Verificar que hay una fecha ahí (fila 2, 0-indexed)
      const fechaCell = getCelda(hoja, 2, colFecha);
      if (!fechaCell || !(fechaCell.v instanceof Date) && typeof fechaCell?.v !== "number") {
        const fechaCell2 = getCelda(hoja, 2, colFecha + 1);
        if (fechaCell2 && (fechaCell2.v instanceof Date || typeof fechaCell2.v === "number")) {
          colFecha = colFecha + 1;
        }
      }

      return {
        filaHeader: r,
        colCantidad,
        colCodigo: colCodigo >= 0 ? colCodigo : colCantidad + 1,
        colDescripcion,
        colPUnit,
        colTotal,
        colNumero,
        colFecha,
      };
    }
  }

  return null;
}

// ============================================================
// EXTRAER FECHA DE UNA CELDA
// ============================================================
function extraerFecha(hoja: XLSX.WorkSheet, fila: number, col: number): string | null {
  const c = getCelda(hoja, fila, col);
  if (!c || c.v === undefined || c.v === null) return null;

  // Si es un Date (xlsx con cellDates: true)
  if (c.v instanceof Date) {
    return c.v.toISOString();
  }

  // Si es número de fecha Excel
  if (typeof c.v === "number") {
    if (c.v > 30000 && c.v < 60000) {
      try {
        const fc = XLSX.SSF.parse_date_code(c.v);
        if (fc) {
          const d = new Date(fc.y, fc.m - 1, fc.d);
          return d.toISOString();
        }
      } catch {
        // no es fecha
      }
    }
  }

  return null;
}

// ============================================================
// EXTRAER UNA FACTURA DE UNA HOJA
// ============================================================
export function extraerFacturaDeHoja(
  nombreHoja: string,
  hoja: XLSX.WorkSheet
): FacturaExtraida {
  const resultado: FacturaExtraida = {
    numero: "",
    tipo: "",
    fecha: "",
    proveedor: "",
    productos: [],
    total: 0,
    hoja: nombreHoja,
    errores: [],
    exito: false,
  };

  if (!hoja["!ref"]) {
    resultado.errores.push("Hoja vacía");
    return resultado;
  }

  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  // Verificar que la hoja tiene tamaño mínimo
  if (rango.e.r - rango.s.r < 5) {
    resultado.errores.push("Hoja muy pequeña");
    return resultado;
  }

  // 1. Detectar formato
  const formato = detectarFormato(hoja);
  if (!formato) {
    resultado.errores.push("No se detectó el formato de factura");
    return resultado;
  }

  // 2. Extraer número de factura (fila 0 en 0-indexed)
  resultado.numero = getStr(hoja, 0, formato.colNumero);
  if (!resultado.numero) {
    // Usar nombre de la hoja como fallback
    resultado.numero = nombreHoja.trim();
    resultado.errores.push("Número extraído del nombre de la hoja");
  }

  // 3. Extraer tipo (fila 1 en 0-indexed)
  const tipoStr = getStr(hoja, 1, formato.colCodigo);
  if (tipoStr && tipoStr.length <= 5) {
    resultado.tipo = tipoStr.toUpperCase();
  } else {
    // Intentar extraer del número de factura
    const match = resultado.numero.match(/^(FA?|FC|FM|FT)/i);
    if (match) {
      resultado.tipo = match[1].toUpperCase();
    } else {
      resultado.tipo = "FC";
    }
  }

  // 4. Extraer fecha (fila 2 en 0-indexed = fila 3 en 1-indexed)
  const fecha = extraerFecha(hoja, 2, formato.colFecha);
  if (fecha) {
    resultado.fecha = fecha;
  } else {
    resultado.errores.push("No se encontró fecha válida");
  }

  // 5. Extraer proveedor/razón social (fila 3 en 0-indexed)
  resultado.proveedor = getStr(hoja, 3, 0);
  if (!resultado.proveedor) {
    resultado.proveedor = getStr(hoja, 3, 1);
  }

  // 6. Extraer productos
  if (!hoja["!ref"]) return resultado;

  // La descripción puede estar en colDescripcion o una columna antes
  // (el header DESCRIPCION a veces está en una columna y los datos en la anterior)
  const colDescData = formato.colDescripcion;

  let filaActual = formato.filaHeader + 1;
  const maxFilas = formato.filaHeader + 200;
  let filasVaciasSeguidas = 0;
  let encontroProductos = false;

  while (filaActual <= Math.min(rango.e.r, maxFilas)) {
    const cantidad = getNum(hoja, filaActual, formato.colCantidad);
    const codigo = getStr(hoja, filaActual, formato.colCodigo);
    const pUnit = getNum(hoja, filaActual, formato.colPUnit);
    const totalItem = getNum(hoja, filaActual, formato.colTotal);

    // Probar descripción en la columna del header y una antes
    let descripcion = getStr(hoja, filaActual, colDescData);
    if (!descripcion && colDescData > 0) {
      descripcion = getStr(hoja, filaActual, colDescData - 1);
    }

    // Si fila está vacía
    if (!descripcion && cantidad === 0) {
      filasVaciasSeguidas++;
      // Antes de encontrar productos, permitir hasta 10 filas vacías (separación)
      // Después de encontrar productos, 2 filas vacías seguidas = fin
      if (encontroProductos && filasVaciasSeguidas >= 2) break;
      if (!encontroProductos && filasVaciasSeguidas >= 10) break;
      filaActual++;
      continue;
    }

    filasVaciasSeguidas = 0;

    // No incluir la fila de totales
    const descUpper = descripcion.toUpperCase();
    if (descUpper === "TOTAL" || descUpper.startsWith("TOTAL ")) break;

    // Solo agregar si hay producto y cantidad
    if (descripcion && cantidad > 0) {
      encontroProductos = true;
      resultado.productos.push({
        codigo,
        producto: descripcion,
        cantidad,
        valorUnit: pUnit,
        subtotal: totalItem > 0 ? totalItem : cantidad * pUnit,
      });
    }

    filaActual++;
  }

  // 7. Extraer total general
  // Buscar la celda "TOTAL" y tomar el valor de la columna de total
  for (let r = filaActual; r <= Math.min(rango.e.r, filaActual + 15); r++) {
    const label = getStr(hoja, r, formato.colTotal - 1).toUpperCase();
    const label2 = getStr(hoja, r, formato.colTotal).toUpperCase();
    if (label === "TOTAL" || label2 === "TOTAL") {
      const val = getNum(hoja, r, formato.colTotal);
      if (val > 0) {
        resultado.total = val;
        break;
      }
    }
  }

  // Si no se encontró total explícito, calcular desde productos
  if (resultado.total === 0) {
    resultado.total = resultado.productos.reduce((s, p) => s + p.subtotal, 0);
  }

  // 8. Determinar éxito
  resultado.exito =
    resultado.numero !== "" &&
    resultado.productos.length > 0;

  if (resultado.productos.length === 0) {
    resultado.errores.push("No se encontraron productos");
  }

  return resultado;
}

// ============================================================
// IMPORTAR TODAS LAS HOJAS DE UN ARCHIVO EXCEL
// ============================================================
export function importarArchivoExcel(buffer: ArrayBuffer): {
  facturas: FacturaExtraida[];
  totalHojas: number;
  exitosas: number;
  conErrores: number;
  vacias: number;
} {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  const facturas: FacturaExtraida[] = [];
  let vacias = 0;

  for (const nombreHoja of workbook.SheetNames) {
    const hoja = workbook.Sheets[nombreHoja];

    // Verificar que la hoja tiene datos
    if (!hoja["!ref"]) {
      vacias++;
      continue;
    }

    const rango = XLSX.utils.decode_range(hoja["!ref"]);

    // Hoja muy pequeña = probablemente vacía
    if (rango.e.r - rango.s.r < 5) {
      const cellCount = Object.keys(hoja).filter(
        (k) => k !== "!ref" && k !== "!margins"
      ).length;
      if (cellCount < 5) {
        vacias++;
        continue;
      }
    }

    const factura = extraerFacturaDeHoja(nombreHoja, hoja);
    facturas.push(factura);
  }

  const exitosas = facturas.filter((f) => f.exito).length;
  const conErrores = facturas.filter((f) => !f.exito).length;

  return {
    facturas,
    totalHojas: workbook.SheetNames.length,
    exitosas,
    conErrores,
    vacias,
  };
}