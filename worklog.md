# Worklog - CUCIMUNDO Invoice System

---
Task ID: 1
Agent: main
Task: Fix toLocaleString crash in Dashboard

Work Log:
- Identified that /api/stats returning 500 caused Dashboard to set error object as stats
- Added `r.ok` check before parsing response JSON in Dashboard fetch
- Verified DB schema sync and API functionality

Stage Summary:
- Dashboard no longer crashes when stats API fails
- Shows loading skeletons instead of crash

---
Task ID: 2
Agent: main
Task: Change theme from green to dark purple

Work Log:
- Replaced all emerald-* Tailwind classes with purple-* equivalents across 5 component files
- Updated Excel export route color constants (VERDE → MORADO)
- Used purple-800/900 for primary, purple-100/50 for light backgrounds

Stage Summary:
- All UI components now use dark purple theme

---
Task ID: 3
Agent: main
Task: Redesign InvoiceForm to be Excel-like with Enter key navigation

Work Log:
- Rewrote InvoiceForm.tsx with spreadsheet-like table layout for items
- Implemented Enter key navigation: moves right across columns, down rows, creates new row at end
- Added Shift+Tab from first item field to go back to header fields
- Simplified design - removed step numbers, made it cleaner
- Used monospace font for codes and numbers

Stage Summary:
- Form feels like Excel: Enter advances fields, auto-creates rows
- Cleaner, more functional design

---
Task ID: 4
Agent: subagent
Task: Rewrite extractor.ts for CUCIMUNDO 3-column format variations

Work Log:
- Improved header detection with wider column scan range
- Added P.UNITARIO as valid header alias
- Better invoice number detection with regex
- Better date extraction with multi-column fallback
- Improved total extraction scanning all columns

Stage Summary:
- Extractor handles all 3 format variations dynamically
- API interface unchanged, backward compatible

---
Task ID: 5
Agent: main
Task: Add export in original CUCIMUNDO format

Work Log:
- Added `?format=original` and `?format=basedatos` query params to export route
- Original format creates one sheet per invoice with CUCIMUNDO layout
- Includes BaseDeDatos summary sheet
- Added 4th quick action button on Dashboard for original format export

Stage Summary:
- Two export options: BaseDeDatos (flat table) and Original (per-sheet invoices)
- Both accessible from Dashboard

---
Task ID: 6
Agent: main
Task: Create Excel file (.xlsm) with Plantilla, BaseDeDatos, macro, buscador

Work Log:
- Created Python script (scripts/create_excel_macro.py) that generates complete .xlsm file
- Built OLE Compound Document binary from scratch for vbaProject.bin
- Created _VBA_PROJECT stream following MS-OVBA specification
- VBA macros: GuardarFactura (save & copy sheet & clear template), BuscarFactura (search)
- Excel has 3 sheets: BaseDeDatos (formatted DB), Plantilla (invoice form), Instrucciones
- Injected VBA into .xlsx via ZIP manipulation to produce .xlsm

Stage Summary:
- /home/z/my-project/download/CUCIMUNDO_Facturas.xlsm created
- Valid OLE structure verified with olefile
- VBA macros for save and search included---
Task ID: 1
Agent: Main Agent
Task: Mega auditoría de integridad del sistema de facturas

Work Log:
- Leí todos los 15 archivos del sistema (schema, 8 APIs, 5 componentes UI, store, db)
- Identifiqué 15 puntos críticos de fallo
- Actualicé prisma/schema.prisma: agregué hojaOrigen, archivoOrigen, advertencias
- Reescribí extractor.ts: archivoOrigen, fechas no inventadas, safeNum con advertencias, validación rango fechas, _numeroDeHoja y _fechaDudosa flags
- Reescribí import/confirm: rechaza facturas sin fecha, guarda trazabilidad completa, ya no inventa new Date()
- Reescribí invoices/route POST: safeN contra Infinity, validación de fecha, items sin descripción ignorados
- Corregí invoices/[id] DELETE: eliminado delete manual de items (cascade ya lo hace)
- Corregí stats/route: consulta de items por proyecto con filtro correcto
- Reescribí export/route: columnas correctas (Número, Fecha, Cliente, Cantidad, Descripción, Costo, Hoja origen) + hoja Trazabilidad
- Reescribí Importar.tsx: muestra advertencias, indicadores de datos dudosos, archivo/hoja origen
- Reescribí InvoiceList.tsx: muestra trazabilidad, advertencias, expandible
- Actualicé Dashboard.tsx: quitada export-original, texto "no se inventa ningún dato"
- Agregué validación de extensión .xlsx y tamaño 50MB en import route
- Build exitoso sin errores

Stage Summary:
- Sistema blindado: no se inventa ni modifica ningún dato de la fuente
- Trazabilidad total: cada factura registra archivo Excel, hoja y advertencias
- Export con 2 hojas: BaseDeDatos (columnas pedidas) + Trazabilidad (origen + advertencias)
- Fechas: rechazadas si no se encuentran, no se inventa new Date()
- Números: NaN/Infinity → 0 con advertencia registrada
- 15 puntos de fallo corregidos

---
Task ID: 2
Agent: Main Agent
Task: Corregir auto-duplicados, exportar original, verificar formulario

Work Log:
- Confirm API: eliminada toda lógica de auto-detección de duplicados. Ahora importa TODO lo que el usuario seleccionó, sin excepción.
- Creada API /api/import/existing: consulta qué números ya existen en el proyecto (solo informativo)
- Importar.tsx: muestra "Ya existe" como badge informativo azul, con mensaje "Si es una compra nueva, es normal. Vos decidís"
- Importar.tsx: contador "Ya en BD" en el resumen, nota explicativa
- Export route: restaurado ?format=original — cada hoja = 1 factura en la plantilla exacta (Fila 0: número, Fila 1: tipo, Fila 2: fecha, Fila 3: cliente, Fila 11: headers, items, TOTAL)
- Export route: la hoja BaseDeDatos se inserta al principio del workbook original
- InvoiceList: 2 botones de exportar — "Base de Datos" y "Exportar Original"
- Dashboard: QuickAction "Exportar Original" — "Cada hoja = 1 factura en la plantilla original"
- Corregido bug: fetch URL faltaba / en exportarExcel de InvoiceList
- InvoiceForm: verificado que Enter-to-advance funciona (N° → Tipo → Fecha → Cliente → Código → Descripción → Cantidad → P.Unit → nueva fila)
- Build exitoso sin errores, 12 rutas incluyendo /api/import/existing

Stage Summary:
- El sistema ya NO decide nada: sin auto-duplicados, sin auto-nada
- El usuario ve "Ya existe" como info y decide
- Exportar Original genera Excel con 1 hoja por factura en formato de plantilla
- Formulario de creación con navegación Excel (Enter avanza)

