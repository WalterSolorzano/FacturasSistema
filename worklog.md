---
Task ID: 1
Agent: main
Task: Correcciones importación, exportación y mejoras UX

Work Log:
- Leí todos los archivos clave del proyecto (extractor, Importar, export, store, etc.)
- Verificé que no hay colores amarillo/amber en advertencias (ya usan sky/blue)
- Verificé que las rutas de dependencia son correctas
- Verificé que la detección de TOTAL ya escanea toda la hoja (rango.e.r)
- Agregué `esEtiquetaTotal()` helper para detección más robusta de etiquetas TOTAL
- Mejoré `extraerTotalGeneral` para buscar valor en TODAS las columnas de la fila TOTAL
- Pre-selección de TODAS las facturas exitosas en paso 2 de importación
- Agregué selector de proyecto destino en paso 2 (con opción de cambiar o crear nuevo)
- Reescribí export formato original: sin celdas combinadas, sin colores, sin bordes, plano
- Verificación con Agent Browser: dashboard, importar, consultar, crear — todos funcionan

Stage Summary:
- Importar.tsx: pre-selección + selector de proyecto + creación de proyecto desde importación
- export/route.ts: formato original ahora es plano (sin merge, sin color, sin bordes)
- extractor.ts: detección TOTAL más robusta con búsqueda en todas las columnas
- Colores de advertencia: ya no usan amarillo (usaban sky, verificado OK)
- Precio=0: advertencias ya funcionan con badge naranja