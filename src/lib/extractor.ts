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
  // Trazabilidad: valores crudos antes de sanitización
  _cantidadRaw?: string;
  _valorUnitRaw?: string;
  _subtotalRaw?: string;
  _precioCero?: boolean; // true si cantidad > 0 pero precio = 0
}

export interface FacturaExtraida {
  numero: string;
  tipo: string;
  fecha: string; // ISO string o "" si no se encontró
  proveedor: string;
  productos: ProductoExtraido[];
  total: number;
  hoja: string;
  archivoOrigen: string; // Nombre del archivo Excel
  advertencias: string[]; // Advertencias (NO errores que impidan importar)
  errores: string[];      // Errores graves que impiden la importación
  exito: boolean;
  _numeroDeHoja: boolean; // true si el "numero" vino del nombre de hoja (dato dudoso)
  _fechaDudosa: boolean;  // true si la fecha no se encontró explícitamente
  _totalCalculado?: boolean; // true si el total se calculó (no encontrado en Excel)
  _totalDiscrepancia?: string; // Descripción de la discrepancia total vs productos
}

// ============================================================
// LEER CELDA SEGURA — nunca lanza, siempre devuelve algo válido
// ============================================================
function getCelda(
  hoja: XLSX.WorkSheet,
  fila: number,
  col: number
): XLSX.CellObject | undefined {
  if (!hoja["!ref"]) return undefined;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);
  if (fila < rango.s.r || fila > rango.e.r) return undefined;
  if (col < rango.s.c || col > rango.e.c) return undefined;
  const addr = XLSX.utils.encode_cell({ r: fila, c: col });
  return hoja[addr];
}

function getStr(hoja: XLSX.WorkSheet, fila: number, col: number): string {
  const c = getCelda(hoja, fila, col);
  if (!c || c.v === undefined || c.v === null) return "";
  return String(c.v).trim();
}

/**
 * safeNum — Convierte un valor a número de forma segura.
 * REGLA: nunca devuelve NaN ni Infinity. Si el valor es inválido, devuelve 0.
 * REGISTRA la advertencia en el array pasado (si se proporciona).
 */
function safeNum(v: unknown, advertencias?: string[], ctx?: string): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") {
    if (isNaN(v)) {
      advertencias?.push(`${ctx || "campo"}: valor NaN → 0`);
      return 0;
    }
    if (!isFinite(v)) {
      advertencias?.push(`${ctx || "campo"}: valor Infinity → 0`);
      return 0;
    }
    return v;
  }
  const s = String(v).trim();
  if (s === "") return 0;
  const n = parseFloat(s);
  if (isNaN(n)) {
    advertencias?.push(`${ctx || "campo"}: "${s}" no es número → 0`);
    return 0;
  }
  if (!isFinite(n)) {
    advertencias?.push(`${ctx || "campo"}: valor Infinity → 0`);
    return 0;
  }
  return n;
}

function getNum(hoja: XLSX.WorkSheet, fila: number, col: number): number {
  const c = getCelda(hoja, fila, col);
  if (!c) return 0;
  return safeNum(c.v);
}

// ============================================================
// DETECTAR FORMATO DE LA HOJA
// ============================================================
interface FormatoHoja {
  filaHeader: number;
  colCantidad: number;
  colCodigo: number;
  colDescripcion: number;
  colPUnit: number;
  colTotal: number;
  colNumero: number;
  colFecha: number;
}

const FC_PATTERN = /^FC\s*00/i;

function detectarFormato(hoja: XLSX.WorkSheet): FormatoHoja | null {
  if (!hoja["!ref"]) return null;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  for (let r = Math.max(rango.s.r, 8); r <= Math.min(rango.e.r, 15); r++) {
    let colCantidad = -1;
    let colCodigo = -1;
    let colDescripcion = -1;
    let colPUnit = -1;
    let colTotal = -1;

    for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
      const val = getStr(hoja, r, c).toUpperCase();

      if (val === "CANTIDAD") colCantidad = c;
      else if (val === "CODIGO") colCodigo = c;
      else if (val === "DESCRIPCION" || val === "DESCRIPCIÓN") colDescripcion = c;
      else if (val === "P.UNI" || val === "P.UNITARIO") colPUnit = c;
      else if (val === "TOTAL") colTotal = c;
    }

    if (colCantidad >= 0 && colDescripcion >= 0 && colPUnit >= 0 && colTotal >= 0) {
      if (colCodigo < 0) {
        colCodigo = colCantidad + 1;
      }

      // Buscar número de factura en fila 0
      let colNumero = -1;
      for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
        const v = getStr(hoja, 0, c);
        if (FC_PATTERN.test(v)) {
          colNumero = c;
          break;
        }
      }
      if (colNumero < 0) colNumero = 6;

      // Detectar columna de fecha en fila 2
      let colFecha = -1;
      for (let offset = 0; offset <= 3; offset++) {
        const testCol = colNumero + offset;
        const cell = getCelda(hoja, 2, testCol);
        if (cell) {
          if (cell.v instanceof Date) {
            colFecha = testCol;
            break;
          }
          if (typeof cell.v === "number" && cell.v > 30000 && cell.v < 60000) {
            colFecha = testCol;
            break;
          }
        }
      }
      if (colFecha < 0) colFecha = colNumero + 1;

      return {
        filaHeader: r,
        colCantidad,
        colCodigo,
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
// EXTRAER FECHA — devuelve null si no es fecha válida
// NUNCA inventa una fecha
// ============================================================
function extraerFecha(hoja: XLSX.WorkSheet, fila: number, col: number): string | null {
  const c = getCelda(hoja, fila, col);
  if (!c || c.v === undefined || c.v === null) return null;

  if (c.v instanceof Date) {
    const d = c.v;
    // Validar que la fecha no sea absurda (antes de 1990 o después de 2030)
    if (d.getFullYear() < 1990 || d.getFullYear() > 2030) return null;
    return d.toISOString();
  }

  if (typeof c.v === "number") {
    if (c.v > 30000 && c.v < 60000) {
      try {
        const fc = XLSX.SSF.parse_date_code(c.v);
        if (fc) {
          const d = new Date(fc.y, fc.m - 1, fc.d);
          if (d.getFullYear() < 1990 || d.getFullYear() > 2030) return null;
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
// EXTRAER NÚMERO DE FACTURA
// ============================================================
function extraerNumero(hoja: XLSX.WorkSheet, colSugerida: number): string {
  const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1");

  const v = getStr(hoja, 0, colSugerida);
  if (FC_PATTERN.test(v)) {
    return v;
  }

  for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
    const val = getStr(hoja, 0, c);
    if (FC_PATTERN.test(val)) {
      return val;
    }
  }

  return ""; // Vacío = no encontrado. NO inventar con nombre de hoja.
}

// ============================================================
// EXTRAER TIPO DE FACTURA
// ============================================================
function extraerTipo(hoja: XLSX.WorkSheet, colNumero: number, numeroFactura: string): string {
  const columnasAProbar = [colNumero, colNumero - 1, colNumero + 1, 0, 1];
  const yaProbadas = new Set<number>();

  for (const col of columnasAProbar) {
    if (col < 0 || yaProbadas.has(col)) continue;
    yaProbadas.add(col);

    const val = getStr(hoja, 1, col).toUpperCase();
    if (val && val.length <= 5 && /^[A-Z]{2,3}$/.test(val)) {
      return val;
    }
  }

  const match = numeroFactura.match(/^(FA?|FC|FM|FT|NC|ND)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return "";
}

// ============================================================
// EXTRAER FECHA DE LA FACTURA — busca en múltiples columnas
// ============================================================
function extraerFechaFactura(
  hoja: XLSX.WorkSheet,
  colSugerida: number
): string {
  let fecha = extraerFecha(hoja, 2, colSugerida);
  if (fecha) return fecha;

  for (const offset of [-1, 1, -2, 2]) {
    fecha = extraerFecha(hoja, 2, colSugerida + offset);
    if (fecha) return fecha;
  }

  const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1");
  for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
    fecha = extraerFecha(hoja, 2, c);
    if (fecha) return fecha;
  }

  return ""; // Vacío = no encontrada. NO inventar.
}

// ============================================================
// EXTRAER PROVEEDOR / CLIENTE
// ============================================================
function extraerProveedor(hoja: XLSX.WorkSheet): string {
  for (const col of [0, 1, 2]) {
    const val = getStr(hoja, 3, col);
    if (val && val.length > 2) {
      return val;
    }
  }
  return "";
}

// ============================================================
// VERIFICAR SI UNA FILA CONTIENE "TOTAL"
// ============================================================
function esEtiquetaTotal(texto: string): boolean {
  const t = texto.toUpperCase().trim();
  return t === "TOTAL" || t.startsWith("TOTAL ") || t.startsWith("TOTAL:") || t.startsWith("TOTAL\t");
}

function filaEsTotal(hoja: XLSX.WorkSheet, fila: number, maxCol: number): boolean {
  for (let c = 0; c <= maxCol; c++) {
    const val = getStr(hoja, fila, c);
    if (esEtiquetaTotal(val)) {
      return true;
    }
  }
  return false;
}

// ============================================================
// EXTRAER PRODUCTOS — SIN INVENTAR DATOS
// ============================================================
function extraerProductos(
  hoja: XLSX.WorkSheet,
  formato: FormatoHoja,
  rango: XLSX.Range,
  advertencias: string[]
): ProductoExtraido[] {
  const productos: ProductoExtraido[] = [];

  const colDescOpciones = [
    formato.colDescripcion,
    ...(formato.colDescripcion > 0 ? [formato.colDescripcion - 1] : []),
  ];

  let filaActual = formato.filaHeader + 1;
  const maxFilas = formato.filaHeader + 500; // Aumentar límite para hojas con mucho espacio
  let filasVaciasSeguidas = 0;
  let encontroProductos = false;

  while (filaActual <= Math.min(rango.e.r, maxFilas)) {
    if (filaEsTotal(hoja, filaActual, formato.colTotal + 1)) {
      break;
    }

    // Leer valores crudos para trazabilidad
    const celdaCant = getCelda(hoja, filaActual, formato.colCantidad);
    const celdaPUnit = getCelda(hoja, filaActual, formato.colPUnit);
    const celdaSubtotal = getCelda(hoja, filaActual, formato.colTotal);

    const cantidadRaw = celdaCant?.v !== undefined && celdaCant?.v !== null ? String(celdaCant.v) : "";
    const pUnitRaw = celdaPUnit?.v !== undefined && celdaPUnit?.v !== null ? String(celdaPUnit.v) : "";
    const subtotalRaw = celdaSubtotal?.v !== undefined && celdaSubtotal?.v !== null ? String(celdaSubtotal.v) : "";

    const cantidad = safeNum(celdaCant?.v, advertencias, `Fila ${filaActual + 1} CANTIDAD`);
    const codigo = formato.colCodigo >= 0
      ? getStr(hoja, filaActual, formato.colCodigo)
      : "";
    const pUnit = safeNum(celdaPUnit?.v, advertencias, `Fila ${filaActual + 1} P.UNI`);
    const totalItem = safeNum(celdaSubtotal?.v, advertencias, `Fila ${filaActual + 1} TOTAL`);

    let descripcion = "";
    for (const col of colDescOpciones) {
      const v = getStr(hoja, filaActual, col);
      if (v) {
        descripcion = v;
        break;
      }
    }

    if (!descripcion && cantidad === 0) {
      filasVaciasSeguidas++;
      if (encontroProductos && filasVaciasSeguidas >= 3) break; // Más tolerancia
      if (!encontroProductos && filasVaciasSeguidas >= 10) break;
      filaActual++;
      continue;
    }

    filasVaciasSeguidas = 0;

    const descUpper = descripcion.toUpperCase();
    if (descUpper === "TOTAL" || descUpper.startsWith("TOTAL ")) break;

    // Solo incluir si hay descripción y cantidad > 0
    if (descripcion && cantidad > 0) {
      encontroProductos = true;

      // ADVERTENCIA: precio = 0 con cantidad > 0
      const precioCero = pUnit === 0 && totalItem === 0;
      if (precioCero) {
        const descCorta = descripcion.length > 40 ? descripcion.substring(0, 40) + "..." : descripcion;
        advertencias.push(`Fila ${filaActual + 1}: "${descCorta}" × ${cantidad} uds. con precio $0 — verificar si es correcto`);
      }

      // Calcular subtotal: SOLO si el Excel no tiene uno.
      let subtotal: number;
      if (totalItem > 0) {
        subtotal = totalItem;
      } else {
        subtotal = Math.round(cantidad * pUnit * 100) / 100;
      }

      productos.push({
        codigo,
        producto: descripcion,
        cantidad,
        valorUnit: pUnit,
        subtotal,
        _cantidadRaw: cantidadRaw,
        _valorUnitRaw: pUnitRaw,
        _subtotalRaw: subtotalRaw,
        _precioCero: precioCero,
      });
    }

    filaActual++;
  }

  return productos;
}

// ============================================================
// EXTRAER TOTAL GENERAL — BUSCA EN TODA LA HOJA
// FIX: Antes solo buscaba +20 filas, ahora busca hasta el final
// ============================================================
function extraerTotalGeneral(
  hoja: XLSX.WorkSheet,
  formato: FormatoHoja,
  filaInicio: number,
  rango: XLSX.Range,
  advertencias: string[]
): { total: number; encontrado: boolean; fila: number } {
  // 1. Buscar etiqueta "TOTAL" en CUALQUIER fila desde filaInicio hasta el final
  for (let r = filaInicio; r <= rango.e.r; r++) {
    for (let c = 0; c <= Math.min(rango.e.c, formato.colTotal + 2); c++) {
      const val = getStr(hoja, r, c);
      if (esEtiquetaTotal(val)) {
        // Intentar obtener el valor numérico de la fila TOTAL
        // Probar la columna TOTAL de la cabecera
        const totalVal = getNum(hoja, r, formato.colTotal);
        if (totalVal > 0) return { total: totalVal, encontrado: true, fila: r };

        // Probar la columna siguiente a donde encontramos "TOTAL"
        if (c + 1 <= rango.e.c) {
          const totalVal2 = getNum(hoja, r, c + 1);
          if (totalVal2 > 0) return { total: totalVal2, encontrado: true, fila: r };
        }

        // Probar la columna anterior
        if (c > 0) {
          const totalVal3 = getNum(hoja, r, c - 1);
          if (totalVal3 > 0) return { total: totalVal3, encontrado: true, fila: r };
        }

        // Probar TODAS las columnas de esta fila buscando un número > 0
        for (let sc = 0; sc <= Math.min(rango.e.c, 15); sc++) {
          const totalVal4 = getNum(hoja, r, sc);
          if (totalVal4 > 0) return { total: totalVal4, encontrado: true, fila: r };
        }
      }
    }
  }

  // 2. FALLBACK: Último valor numérico en la columna TOTAL
  // Muchas hojas del Excel no tienen etiqueta "TOTAL", solo el número al final
  for (let r = rango.e.r; r >= filaInicio; r--) {
    const val = getNum(hoja, r, formato.colTotal);
    if (val > 0) {
      advertencias.push(
        `Total ${val.toLocaleString("es-AR")} tomado de la fila ${r + 1} (sin etiqueta "TOTAL" visible)`
      );
      return { total: val, encontrado: false, fila: r };
    }
  }

  return { total: 0, encontrado: false, fila: -1 };
}

// ============================================================
// EXTRAER UNA FACTURA DE UNA HOJA
// ============================================================
export function extraerFacturaDeHoja(
  nombreHoja: string,
  hoja: XLSX.WorkSheet,
  archivoOrigen: string
): FacturaExtraida {
  const advertencias: string[] = [];
  const errores: string[] = [];

  const resultado: FacturaExtraida = {
    numero: "",
    tipo: "",
    fecha: "",
    proveedor: "",
    productos: [],
    total: 0,
    hoja: nombreHoja,
    archivoOrigen,
    advertencias,
    errores,
    exito: false,
    _numeroDeHoja: false,
    _fechaDudosa: false,
    _totalCalculado: false,
  };

  if (!hoja["!ref"]) {
    resultado.errores.push("Hoja vacía (sin datos)");
    return resultado;
  }

  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  if (rango.e.r - rango.s.r < 5) {
    resultado.errores.push("Hoja muy pequeña (menos de 6 filas)");
    return resultado;
  }

  // 1. Detectar formato
  const formato = detectarFormato(hoja);
  if (!formato) {
    resultado.errores.push("No se detectó el formato de factura (sin encabezados CANTIDAD/DESCRIPCION)");
    return resultado;
  }

  // 2. Extraer número de factura
  resultado.numero = extraerNumero(hoja, formato.colNumero);
  if (!resultado.numero) {
    // NO inventar con nombre de hoja. Marcar como error.
    resultado.errores.push("No se encontró número de factura con patrón FC 00...");
    // Usar nombre de hoja como último recurso PERO marcarlo como dudoso
    resultado.numero = nombreHoja.trim();
    resultado._numeroDeHoja = true;
    resultado.errores.push(`Número tomado del nombre de hoja: "${nombreHoja}" — verificar manualmente`);
  }

  // 3. Extraer tipo
  resultado.tipo = extraerTipo(hoja, formato.colNumero, resultado.numero);

  // 4. Extraer fecha — NO inventar
  resultado.fecha = extraerFechaFactura(hoja, formato.colFecha);
  if (!resultado.fecha) {
    resultado.errores.push("No se encontró fecha válida — NO se inventó fecha");
    resultado._fechaDudosa = true;
  }

  // 5. Extraer proveedor/cliente
  resultado.proveedor = extraerProveedor(hoja);

  // 6. Extraer productos
  resultado.productos = extraerProductos(hoja, formato, rango, advertencias);

  // 7. Extraer total general — AHORA BUSCA EN TODA LA HOJA
  const filaInicioTotal = formato.filaHeader + 1;
  const totalResult = extraerTotalGeneral(hoja, formato, filaInicioTotal, rango, advertencias);

  if (totalResult.total > 0) {
    resultado.total = totalResult.total;
  } else {
    // Calcular desde productos (dato derivado, no inventado)
    resultado.total = Math.round(
      resultado.productos.reduce((s, p) => s + p.subtotal, 0) * 100
    ) / 100;
    if (resultado.productos.length > 0) {
      resultado._totalCalculado = true;
      advertencias.push("No se encontró total en el Excel — se calculó desde los productos");
    }
  }

  // 8. Verificar discrepancia entre total del Excel y suma de productos
  if (totalResult.encontrado && resultado.productos.length > 0) {
    const sumaProductos = Math.round(
      resultado.productos.reduce((s, p) => s + p.subtotal, 0) * 100
    ) / 100;
    if (Math.abs(totalResult.total - sumaProductos) > 0.02) {
      const diff = Math.abs(totalResult.total - sumaProductos).toFixed(2);
      resultado._totalDiscrepancia = `Excel: ${totalResult.total.toLocaleString("es-AR")} | Suma productos: ${sumaProductos.toLocaleString("es-AR")} | Diferencia: ${diff}`;
      advertencias.push(
        `Discrepancia de total: el Excel dice ${totalResult.total.toLocaleString("es-AR")} pero la suma de productos da ${sumaProductos.toLocaleString("es-AR")} (diferencia: ${diff})`
      );
    }
  }

  // 9. Determinar éxito
  resultado.exito = resultado.productos.length > 0;

  if (resultado.productos.length === 0) {
    resultado.errores.push("No se encontraron productos");
  }

  return resultado;
}

// ============================================================
// IMPORTAR TODAS LAS HOJAS DE UN ARCHIVO EXCEL
// ============================================================
export function importarArchivoExcel(buffer: ArrayBuffer, nombreArchivo: string): {
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

    if (!hoja["!ref"]) {
      vacias++;
      continue;
    }

    const rango = XLSX.utils.decode_range(hoja["!ref"]);

    if (rango.e.r - rango.s.r < 5) {
      const cellCount = Object.keys(hoja).filter(
        (k) => k !== "!ref" && k !== "!margins"
      ).length;
      if (cellCount < 5) {
        vacias++;
        continue;
      }
    }

    const factura = extraerFacturaDeHoja(nombreHoja, hoja, nombreArchivo);
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