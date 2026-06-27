import XLSX from "xlsx";

// ============================================================
// CONFIGURACION DE ANCLAS
// Estas son las palabras que el sistema busca en cada hoja.
// Si la plantilla real usa palabras distintas, se cambian aquí.
// ============================================================
const ANCLAS = {
  factura: ["FACTURA", "FAC.", "FC-", "N° COMP.", "COMP. NRO.", "NUMERO"],
  cliente: ["CLIENTE", "RAZON SOCIAL", "RAZÓN SOCIAL", "NOMBRE", "APELLIDO"],
  producto: ["PRODUCTO", "DESCRIPCION", "DESCRIPCIÓN", "ITEM", "CONCEPTO", "SERVICIO"],
  cantidad: ["CANTIDAD", "CANT.", "CANT", "QTY", "UNIDADES"],
  valor: [
    "VALOR",
    "IMPORTE",
    "PRECIO",
    "P. UNITARIO",
    "PRECIO UNIT.",
    "P. UNIT.",
    "SUBTOTAL",
  ],
  total: ["TOTAL", "TOTAL GENERAL", "IMPORTE TOTAL"],
  codigo: ["CODIGO", "COD.", "CÓDIGO", "COD", "CÓD"],
  talla: ["TALLA", "MEDIDA", "TALLA/NUMERO", "U. MEDIDA"],
};

// ============================================================
// Tipos
// ============================================================
export interface ProductoExtraido {
  codigo: string;
  producto: string;
  cantidad: number;
  talla: string;
  valorUnit: number;
  subtotal: number;
}

export interface FacturaExtraida {
  numero: string;
  tipo: string;
  fecha: string; // ISO string
  cliente: string;
  productos: ProductoExtraido[];
  total: number;
  hoja: string; // nombre de la hoja de origen
  errores: string[];
  exito: boolean;
}

// ============================================================
// Buscar un ancla en las celdas de la hoja
// Devuelve la celda o null
// ============================================================
function buscarAncla(
  hoja: XLSX.WorkSheet,
  posiblesAnclas: string[]
): XLSX.CellObject | null {
  if (!hoja["!ref"]) return null;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  for (let r = rango.s.r; r <= rango.e.r; r++) {
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const celda = hoja[addr];
      if (!celda || !celda.v) continue;

      const valor = String(celda.v).toUpperCase().trim();

      for (const ancla of posiblesAnclas) {
        if (valor.includes(ancla.toUpperCase())) {
          return celda;
        }
      }
    }
  }
  return null;
}

// ============================================================
// Buscar valor numérico contiguo a una celda (derecha o abajo)
// ============================================================
function buscarValorNumericoContiguo(
  hoja: XLSX.WorkSheet,
  fila: number,
  col: number
): number | null {
  // Primero a la derecha
  for (let dc = 1; dc <= 3; dc++) {
    const addr = XLSX.utils.encode_cell({ r: fila, c: col + dc });
    const celda = hoja[addr];
    if (celda && celda.v !== undefined && celda.v !== "") {
      const num = typeof celda.v === "number" ? celda.v : parseFloat(String(celda.v));
      if (!isNaN(num)) return num;
    }
  }
  // Luego abajo
  for (let dr = 1; dr <= 2; dr++) {
    const addr = XLSX.utils.encode_cell({ r: fila + dr, c: col });
    const celda = hoja[addr];
    if (celda && celda.v !== undefined && celda.v !== "") {
      const num = typeof celda.v === "number" ? celda.v : parseFloat(String(celda.v));
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

// ============================================================
// Buscar texto contiguo a una celda (derecha o abajo)
// ============================================================
function buscarTextoContiguo(
  hoja: XLSX.WorkSheet,
  fila: number,
  col: number
): string {
  // Primero a la derecha
  for (let dc = 1; dc <= 3; dc++) {
    const addr = XLSX.utils.encode_cell({ r: fila, c: col + dc });
    const celda = hoja[addr];
    if (celda && celda.v !== undefined && String(celda.v).trim() !== "") {
      return String(celda.v).trim();
    }
  }
  // Luego abajo
  for (let dr = 1; dr <= 2; dr++) {
    const addr = XLSX.utils.encode_cell({ r: fila + dr, c: col });
    const celda = hoja[addr];
    if (celda && celda.v !== undefined && String(celda.v).trim() !== "") {
      return String(celda.v).trim();
    }
  }
  return "";
}

// ============================================================
// Encontrar la fecha en la hoja
// ============================================================
function buscarFecha(hoja: XLSX.WorkSheet): string | null {
  if (!hoja["!ref"]) return null;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  for (let r = rango.s.r; r <= rango.e.r; r++) {
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const celda = hoja[addr];
      if (!celda || celda.v === undefined) continue;

      // Si es un objeto Date de xlsx
      if (celda.v instanceof Date) {
        return celda.v.toISOString();
      }

      // Si es un número que xlsx interpreta como fecha de Excel
      if (typeof celda.v === "number" && celda.t === "n") {
        // Los números de fecha de Excel están en un rango razonable
        // Excel dates start from 1/1/1900 = 1
        if (celda.v > 30000 && celda.v < 60000) {
          try {
            // xlsx parsea fechas automáticamente si la opción está activa
            const fecha = XLSX.SSF.parse_date_code(celda.v);
            if (fecha) {
              const d = new Date(fecha.y, fecha.m - 1, fecha.d);
              return d.toISOString();
            }
          } catch {
            // no es fecha
          }
        }
      }

      // Si es un string con formato de fecha dd/mm/aaaa o similar
      if (typeof celda.v === "string") {
        const str = celda.v.trim();
        const match = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
        if (match) {
          let dia = parseInt(match[1]);
          let mes = parseInt(match[2]);
          let anio = parseInt(match[3]);
          if (anio < 100) anio += 2000;
          const d = new Date(anio, mes - 1, dia);
          if (!isNaN(d.getTime())) {
            return d.toISOString();
          }
        }
      }
    }
  }
  return null;
}

// ============================================================
// Extraer tipo de factura (A, B, C, M, T)
// ============================================================
function extraerTipoFactura(hoja: XLSX.WorkSheet, celdaFactura: { r: number; c: number }): string {
  // Buscar cerca de la celda de FACTURA una letra de tipo
  const tipos = ["A", "B", "C", "M", "T", "F"];

  // Buscar en la misma fila, columnas cercanas
  for (let c = Math.max(0, celdaFactura.c - 2); c <= celdaFactura.c + 4; c++) {
    const addr = XLSX.utils.encode_cell({ r: celdaFactura.r, c });
    const cell = hoja[addr];
    if (cell && cell.v !== undefined) {
      const val = String(cell.v).trim().toUpperCase();
      for (const t of tipos) {
        // Buscar patrón como "FACTURA A", "FAC. B", o tipo aislado
        if (val === t || val.includes(` ${t}`) || val.includes(`${t} `)) {
          return t;
        }
      }
    }
  }

  // Buscar en filas cercanas arriba/abajo
  for (let r = Math.max(0, celdaFactura.r - 2); r <= celdaFactura.r + 2; r++) {
    for (let c = Math.max(0, celdaFactura.c - 1); c <= celdaFactura.c + 1; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = hoja[addr];
      if (cell && cell.v !== undefined) {
        const val = String(cell.v).trim().toUpperCase();
        for (const t of tipos) {
          if (val === t || (val.length <= 3 && val.includes(t))) {
            return t;
          }
        }
      }
    }
  }

  return "";
}

// ============================================================
// Encontrar la fila de encabezado de la tabla de productos
// y mapear las columnas
// ============================================================
function encontrarTablaProductos(
  hoja: XLSX.WorkSheet
): { filaHeader: number; cols: Record<string, number> } | null {
  if (!hoja["!ref"]) return null;
  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  // Buscar la fila que contenga al menos PRODUCTO y CANTIDAD
  for (let r = rango.s.r; r <= rango.e.r; r++) {
    let encontrados = 0;
    const cols: Record<string, number> = {};

    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const celda = hoja[addr];
      if (!celda || celda.v === undefined) continue;

      const val = String(celda.v).toUpperCase().trim();

      for (const [clave, anclas] of Object.entries(ANCLAS)) {
        if (cols[clave] !== undefined) continue; // ya encontrada
        for (const ancla of anclas) {
          if (val.includes(ancla)) {
            cols[clave] = c;
            encontrados++;
            break;
          }
        }
      }
    }

    // Necesitamos al menos PRODUCTO + CANTIDAD + VALOR
    if (
      cols.producto !== undefined &&
      cols.cantidad !== undefined &&
      cols.valor !== undefined
    ) {
      return { filaHeader: r, cols };
    }
  }

  return null;
}

// ============================================================
// EXTRAER UNA FACTURA COMPLETA DE UNA HOJA
// ============================================================
export function extraerFacturaDeHoja(
  nombreHoja: string,
  hoja: XLSX.WorkSheet
): FacturaExtraida {
  const resultado: FacturaExtraida = {
    numero: "",
    tipo: "",
    fecha: "",
    cliente: "",
    productos: [],
    total: 0,
    hoja: nombreHoja,
    errores: [],
    exito: false,
  };

  // 1. Buscar número de factura
  const celdaFactura = buscarAncla(hoja, ANCLAS.factura);
  if (celdaFactura) {
    const valor = buscarTextoContiguo(hoja, celdaFactura.r, celdaFactura.c);
    if (valor) {
      resultado.numero = valor;
      // Intentar extraer tipo de la misma celda o cercana
      resultado.tipo = extraerTipoFactura(hoja, {
        r: celdaFactura.r,
        c: celdaFactura.c,
      });
    } else {
      resultado.errores.push("No se encontró el número junto a FACTURA");
    }
  } else {
    // Si no hay ancla "FACTURA", intentar usar el nombre de la hoja
    resultado.numero = nombreHoja;
    resultado.errores.push('No se encontró ancla "FACTURA", se usó el nombre de la hoja');
  }

  // 2. Buscar fecha
  const fecha = buscarFecha(hoja);
  if (fecha) {
    resultado.fecha = fecha;
  } else {
    resultado.errores.push("No se encontró fecha");
  }

  // 3. Buscar cliente
  const celdaCliente = buscarAncla(hoja, ANCLAS.cliente);
  if (celdaCliente) {
    const valor = buscarTextoContiguo(hoja, celdaCliente.r, celdaCliente.c);
    if (valor) {
      resultado.cliente = valor;
    } else {
      resultado.errores.push("No se encontró el nombre junto a CLIENTE");
    }
  } else {
    resultado.errores.push('No se encontró ancla "CLIENTE"');
  }

  // 4. Buscar tabla de productos
  const tabla = encontrarTablaProductos(hoja);
  if (tabla) {
    if (!hoja["!ref"]) {
      resultado.errores.push("La hoja no tiene datos");
      return resultado;
    }
    const rango = XLSX.utils.decode_range(hoja["!ref"]);

    let filaActual = tabla.filaHeader + 1;

    // Recorrer filas hasta encontrar vacía o TOTAL
    while (filaActual <= rango.e.r + 500) {
      // Leer la celda de la columna PRODUCTO
      const addrProd = XLSX.utils.encode_cell({
        r: filaActual,
        c: tabla.cols.producto,
      });
      const celdaProd = hoja[addrProd];

      if (!celdaProd || celdaProd.v === undefined || String(celdaProd.v).trim() === "") {
        break; // Fila vacía, fin de la tabla
      }

      const nombreProd = String(celdaProd.v).trim().toUpperCase();

      // Verificar si es la fila de TOTAL
      if (ANCLAS.total.some((a) => nombreProd.includes(a.toUpperCase()))) {
        break;
      }

      // Leer cantidad
      let cantidad = 0;
      if (tabla.cols.cantidad !== undefined) {
        const addrCant = XLSX.utils.encode_cell({
          r: filaActual,
          c: tabla.cols.cantidad,
        });
        const celdaCant = hoja[addrCant];
        if (celdaCant && celdaCant.v !== undefined) {
          const num =
            typeof celdaCant.v === "number"
              ? celdaCant.v
              : parseFloat(String(celdaCant.v));
          if (!isNaN(num)) cantidad = num;
        }
      }

      // Leer valor unitario
      let valorUnit = 0;
      if (tabla.cols.valor !== undefined) {
        const addrVal = XLSX.utils.encode_cell({
          r: filaActual,
          c: tabla.cols.valor,
        });
        const celdaVal = hoja[addrVal];
        if (celdaVal && celdaVal.v !== undefined) {
          const num =
            typeof celdaVal.v === "number"
              ? celdaVal.v
              : parseFloat(String(celdaVal.v));
          if (!isNaN(num)) valorUnit = num;
        }
      }

      // Leer código
      let codigo = "";
      if (tabla.cols.codigo !== undefined) {
        const addrCod = XLSX.utils.encode_cell({
          r: filaActual,
          c: tabla.cols.codigo,
        });
        const celdaCod = hoja[addrCod];
        if (celdaCod && celdaCod.v !== undefined) {
          codigo = String(celdaCod.v).trim();
        }
      }

      // Leer talla
      let talla = "";
      if (tabla.cols.talla !== undefined) {
        const addrTalla = XLSX.utils.encode_cell({
          r: filaActual,
          c: tabla.cols.talla,
        });
        const celdaTalla = hoja[addrTalla];
        if (celdaTalla && celdaTalla.v !== undefined) {
          talla = String(celdaTalla.v).trim();
        }
      }

      // Solo agregar si tiene producto y cantidad válida
      if (nombreProd && cantidad > 0) {
        resultado.productos.push({
          codigo,
          producto: String(celdaProd.v).trim(),
          cantidad,
          talla,
          valorUnit,
          subtotal: cantidad * valorUnit,
        });
      }

      filaActual++;

      // Seguridad: no recorrer más de 500 filas
      if (filaActual - tabla.filaHeader > 500) break;
    }

    if (resultado.productos.length === 0) {
      resultado.errores.push("Se encontró la tabla pero sin productos válidos");
    }
  } else {
    resultado.errores.push("No se encontró la tabla de productos (encabezados)");
  }

  // 5. Buscar total general
  const celdaTotal = buscarAncla(hoja, ANCLAS.total);
  if (celdaTotal) {
    const val = buscarValorNumericoContiguo(hoja, celdaTotal.r, celdaTotal.c);
    if (val !== null) {
      resultado.total = val;
    } else {
      // Calcular desde los productos
      resultado.total = resultado.productos.reduce((s, p) => s + p.subtotal, 0);
    }
  } else {
    // Calcular desde los productos
    resultado.total = resultado.productos.reduce((s, p) => s + p.subtotal, 0);
  }

  // Determinar si la extracción fue exitosa
  resultado.exito =
    resultado.numero !== "" &&
    resultado.cliente !== "" &&
    resultado.productos.length > 0 &&
    resultado.total > 0;

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
    cellDates: true, // Intentar parsear fechas automáticamente
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
    if (
      rango.e.r - rango.s.r < 3 ||
      rango.e.c - rango.s.c < 2
    ) {
      // Hoja muy pequeña, probablemente vacía o no es factura
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