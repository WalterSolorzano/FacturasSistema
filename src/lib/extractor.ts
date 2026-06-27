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

function safeNum(v: unknown): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") {
    if (isNaN(v) || !isFinite(v)) return 0;
    return v;
  }
  const n = parseFloat(String(v));
  return isNaN(n) || !isFinite(n) ? 0 : n;
}

function getNum(hoja: XLSX.WorkSheet, fila: number, col: number): number {
  const c = getCelda(hoja, fila, col);
  if (!c) return 0;
  return safeNum(c.v);
}

// ============================================================
// DETECTAR FORMATO DE LA HOJA
// Escanea filas 8-15 buscando la fila de encabezados con
// "CANTIDAD" y "DESCRIPCION". Detecta dinámicamente las
// posiciones de P.UNI, TOTAL, CODIGO. Busca el número de
// factura en la fila 0 con patrón "FC 00...".
// Devuelve las posiciones clave o null si no es factura válida.
// ============================================================
interface FormatoHoja {
  filaHeader: number;     // fila (0-indexed) donde están CANTIDAD, CODIGO, DESCRIPCION...
  colCantidad: number;    // columna de CANTIDAD
  colCodigo: number;      // columna de CODIGO
  colDescripcion: number; // columna del header DESCRIPCION
  colPUnit: number;       // columna de P.UNI
  colTotal: number;       // columna de TOTAL (por ítem)
  colNumero: number;      // columna del número de factura en fila 0
  colFecha: number;       // columna de la fecha en fila 2
}

const FC_PATTERN = /FC\s*00/i;

function detectarFormato(hoja: XLSX.WorkSheet): FormatoHoja | null {
  if (!hoja["!ref"]) return null;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  // 1. Buscar la fila de encabezados en el rango 8-15
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

    // Validar que encontramos los campos clave
    if (colCantidad >= 0 && colDescripcion >= 0 && colPUnit >= 0 && colTotal >= 0) {
      // Si no se encontró CODIGO, asumir que está entre CANTIDAD y DESCRIPCION
      if (colCodigo < 0) {
        colCodigo = colCantidad + 1;
      }

      // 2. Buscar número de factura en fila 0 (0-indexed)
      let colNumero = -1;
      for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
        const v = getStr(hoja, 0, c);
        if (FC_PATTERN.test(v)) {
          colNumero = c;
          break;
        }
      }
      // Fallback: si no se encontró con el patrón, usar columna 6 (Formato A/B)
      if (colNumero < 0) colNumero = 6;

      // 3. Detectar columna de la fecha en fila 2
      // Probar la columna del número y las siguientes (hasta +3)
      let colFecha = -1;
      for (let offset = 0; offset <= 3; offset++) {
        const testCol = colNumero + offset;
        const cell = getCelda(hoja, 2, testCol);
        if (cell) {
          // Es un Date (cellDates: true)
          if (cell.v instanceof Date) {
            colFecha = testCol;
            break;
          }
          // Es un número que podría ser serial de fecha Excel
          if (typeof cell.v === "number" && cell.v > 30000 && cell.v < 60000) {
            colFecha = testCol;
            break;
          }
        }
      }
      // Fallback: usar colNumero + 1
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
// EXTRAER NÚMERO DE FACTURA DE UNA HOJA
// Busca en la fila 0 una celda que contenga "FC 00..."
// ============================================================
function extraerNumero(hoja: XLSX.WorkSheet, colSugerida: number): string {
  const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1");

  // Primero buscar en la columna sugerida
  const v = getStr(hoja, 0, colSugerida);
  if (FC_PATTERN.test(v)) {
    return v;
  }

  // Si no está ahí, buscar en toda la fila 0
  for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
    const val = getStr(hoja, 0, c);
    if (FC_PATTERN.test(val)) {
      return val;
    }
  }

  return "";
}

// ============================================================
// EXTRAER TIPO DE FACTURA
// Fila 1 (index 1). Busca cerca de la columna del número.
// ============================================================
function extraerTipo(hoja: XLSX.WorkSheet, colNumero: number, numeroFactura: string): string {
  const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1");

  // Buscar en la columna del número y las adyacentes
  const columnasAProbar = [colNumero, colNumero - 1, colNumero + 1, 0, 1];
  const yaProbadas = new Set<number>();

  for (const col of columnasAProbar) {
    if (col < 0 || yaProbadas.has(col)) continue;
    yaProbadas.add(col);

    const val = getStr(hoja, 1, col).toUpperCase();
    // El tipo suele ser una cadena corta: FC, FA, FM, FT, NC, ND, etc.
    if (val && val.length <= 5 && /^[A-Z]{2,3}$/.test(val)) {
      return val;
    }
  }

  // Intentar extraer del número de factura
  const match = numeroFactura.match(/^(FA?|FC|FM|FT|NC|ND)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return "FC";
}

// ============================================================
// EXTRAER FECHA DE LA FACTURA
// Fila 2 (index 2). Probar la columna detectada y adyacentes.
// ============================================================
function extraerFechaFactura(
  hoja: XLSX.WorkSheet,
  colSugerida: number
): string {
  // Probar la columna sugerida primero
  let fecha = extraerFecha(hoja, 2, colSugerida);
  if (fecha) return fecha;

  // Probar columnas adyacentes
  for (const offset of [-1, 1, -2, 2]) {
    fecha = extraerFecha(hoja, 2, colSugerida + offset);
    if (fecha) return fecha;
  }

  // Último recurso: escanear toda la fila 2
  const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1");
  for (let c = rango.s.c; c <= Math.min(rango.e.c, 15); c++) {
    fecha = extraerFecha(hoja, 2, c);
    if (fecha) return fecha;
  }

  return "";
}

// ============================================================
// EXTRAER PROVEEDOR / RAZÓN SOCIAL
// Fila 3 (index 3). Suele estar en columna 0 o 1.
// ============================================================
function extraerProveedor(hoja: XLSX.WorkSheet): string {
  // Probar columnas 0, 1, 2
  for (const col of [0, 1, 2]) {
    const val = getStr(hoja, 3, col);
    if (val && val.length > 2) {
      return val;
    }
  }
  return "";
}

// ============================================================
// VERIFICAR SI UNA FILA CONTIENE LA ETIQUETA "TOTAL"
// (indicando fin de los ítems)
// ============================================================
function filaEsTotal(hoja: XLSX.WorkSheet, fila: number, maxCol: number): boolean {
  for (let c = 0; c <= maxCol; c++) {
    const val = getStr(hoja, fila, c).toUpperCase();
    if (val === "TOTAL" || val.startsWith("TOTAL ") || val.startsWith("TOTAL:")) {
      return true;
    }
  }
  return false;
}

// ============================================================
// EXTRAER PRODUCTOS DE LA HOJA
// ============================================================
function extraerProductos(
  hoja: XLSX.WorkSheet,
  formato: FormatoHoja,
  rango: XLSX.Range
): ProductoExtraido[] {
  const productos: ProductoExtraido[] = [];

  // La descripción puede estar en colDescripcion o una columna antes
  // (cuando las celdas están mergeadas en Excel, xlsx las reporta en
  // la columna del header pero a veces el dato está en la anterior)
  const colDescOpciones = [
    formato.colDescripcion,
    ...(formato.colDescripcion > 0 ? [formato.colDescripcion - 1] : []),
  ];

  let filaActual = formato.filaHeader + 1;
  const maxFilas = formato.filaHeader + 200;
  let filasVaciasSeguidas = 0;
  let encontroProductos = false;

  while (filaActual <= Math.min(rango.e.r, maxFilas)) {
    // Verificar si esta fila es la de TOTAL general
    if (filaEsTotal(hoja, filaActual, formato.colTotal + 1)) {
      break;
    }

    const cantidad = getNum(hoja, filaActual, formato.colCantidad);
    const codigo = formato.colCodigo >= 0
      ? getStr(hoja, filaActual, formato.colCodigo)
      : "";
    const pUnit = getNum(hoja, filaActual, formato.colPUnit);
    const totalItem = getNum(hoja, filaActual, formato.colTotal);

    // Probar descripción en la columna del header y una antes (merged cells)
    let descripcion = "";
    for (const col of colDescOpciones) {
      const v = getStr(hoja, filaActual, col);
      if (v) {
        descripcion = v;
        break;
      }
    }

    // Si la fila está vacía (sin descripción y sin cantidad)
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

    // No incluir la fila de totales (por si filaEsTotal no la atrapó)
    const descUpper = descripcion.toUpperCase();
    if (descUpper === "TOTAL" || descUpper.startsWith("TOTAL ")) break;

    // Solo agregar si hay descripción y cantidad > 0
    if (descripcion && cantidad > 0) {
      encontroProductos = true;
      productos.push({
        codigo,
        producto: descripcion,
        cantidad,
        valorUnit: pUnit,
        subtotal: totalItem > 0 ? totalItem : Math.round(cantidad * pUnit * 100) / 100,
      });
    }

    filaActual++;
  }

  return productos;
}

// ============================================================
// EXTRAER TOTAL GENERAL
// Busca la fila con "TOTAL" y extrae el valor de la columna TOTAL.
// ============================================================
function extraerTotalGeneral(
  hoja: XLSX.WorkSheet,
  formato: FormatoHoja,
  filaInicio: number,
  rango: XLSX.Range
): number {
  const maxBuscar = Math.min(rango.e.r, filaInicio + 20);

  for (let r = filaInicio; r <= maxBuscar; r++) {
    // Buscar la etiqueta "TOTAL" en las columnas cercanas
    for (let c = 0; c <= formato.colTotal; c++) {
      const val = getStr(hoja, r, c).toUpperCase();
      if (val === "TOTAL" || val.startsWith("TOTAL ") || val.startsWith("TOTAL:")) {
        // Tomar el valor de la columna TOTAL
        const totalVal = getNum(hoja, r, formato.colTotal);
        if (totalVal > 0) return totalVal;

        // Si no está en la columna TOTAL, probar la siguiente
        const totalVal2 = getNum(hoja, r, formato.colTotal + 1);
        if (totalVal2 > 0) return totalVal2;

        // Probar la columna a la derecha de la etiqueta
        if (c < formato.colTotal) {
          const totalVal3 = getNum(hoja, r, c + 1);
          if (totalVal3 > 0) return totalVal3;
        }
      }
    }
  }

  return 0;
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

  // 1. Detectar formato (posiciones de columnas dinámicamente)
  const formato = detectarFormato(hoja);
  if (!formato) {
    resultado.errores.push("No se detectó el formato de factura");
    return resultado;
  }

  // 2. Extraer número de factura (fila 0, búsqueda por patrón "FC 00...")
  resultado.numero = extraerNumero(hoja, formato.colNumero);
  if (!resultado.numero) {
    // Fallback: usar nombre de la hoja
    resultado.numero = nombreHoja.trim();
    resultado.errores.push("Número extraído del nombre de la hoja");
  }

  // 3. Extraer tipo (fila 1)
  resultado.tipo = extraerTipo(hoja, formato.colNumero, resultado.numero);

  // 4. Extraer fecha (fila 2)
  resultado.fecha = extraerFechaFactura(hoja, formato.colFecha);
  if (!resultado.fecha) {
    resultado.errores.push("No se encontró fecha válida");
  }

  // 5. Extraer proveedor/razón social (fila 3)
  resultado.proveedor = extraerProveedor(hoja);

  // 6. Extraer productos
  resultado.productos = extraerProductos(hoja, formato, rango);

  // 7. Extraer total general
  // Buscar desde después del header de ítems
  const filaInicioTotal = formato.filaHeader + 1;
  const totalEncontrado = extraerTotalGeneral(hoja, formato, filaInicioTotal, rango);

  if (totalEncontrado > 0) {
    resultado.total = totalEncontrado;
  } else {
    // Si no se encontró total explícito, calcular desde productos
    resultado.total = Math.round(
      resultado.productos.reduce((s, p) => s + p.subtotal, 0) * 100
    ) / 100;
  }

  // 8. Determinar éxito
  resultado.exito = resultado.numero !== "" && resultado.productos.length > 0;

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