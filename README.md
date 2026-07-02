# Sistema de Gestión de Facturas 

Aplicación de escritorio auto-contenida (portable) diseñada para procesar, auditar, almacenar y analizar facturas masivas en formato Excel. 

El sistema fue creado para resolver el problema de la captura manual de facturas, ofreciendo una interfaz visual intuitiva, detección automática de errores (precios en cero, valores negativos) y un motor de estadísticas de alto rendimiento.

##  Funcionalidades Principales

1. **Importación Inteligente de Lotes:** Sube múltiples archivos Excel a la vez. El sistema lee el formato específico, extrae el cliente, la fecha, y desglosa los productos.
2. **Auditoría Visual:** Antes de guardar, los usuarios pueden revisar las facturas. El sistema alerta sobre productos con precio `$0` o valores negativos, permitiendo corregirlos antes de ingresarlos a la base de datos.
3. **Gestión por Proyectos:** Las facturas se agrupan en "Proyectos", lo que permite mantener separada la contabilidad de distintos clientes o meses.
4. **Análisis y Estadísticas "Wow":** Un dashboard interactivo que muestra:
   - Tarjetas de impacto (Mejor/Peor Mes, Mejor/Peor Año).
   - Evolución gráfica dinámica (Mes a mes vs Histórico).
   - Gráfico de Dona con el Top 5 de productos más vendidos.
5. **Exportación Consolidada:** Selecciona varios proyectos y expórtalos en un único archivo Excel que contiene:
   - Una hoja tabular ("Base de Datos") perfecta para tablas dinámicas.
   - Hojas individuales por cada factura recreando exactamente la plantilla original.
6. **Actualizaciones Automáticas (OTA):** El programa detecta automáticamente nuevas versiones en GitHub y se actualiza a sí mismo de forma segura, incluyendo un mecanismo de Rollback para volver atrás si es necesario.

---

##  Tecnologías y Arquitectura

El sistema utiliza una arquitectura híbrida moderna que combina el ecosistema web con capacidades de escritorio nativo en Windows:

### Stack Tecnológico
- **Frontend & Backend Web:** [Next.js 16 (App Router)](https://nextjs.org/) + React.
- **Base de Datos & ORM:** [SQLite](https://www.sqlite.org/) + [Prisma ORM](https://www.prisma.io/).
- **Estilos y UI:** [Tailwind CSS](https://tailwindcss.com/) + Componentes [Radix UI / shadcn/ui](https://ui.shadcn.com/).
- **Motor JS y Compilación:** [Bun](https://bun.sh/) para builds ultrarrápidos y `node.exe` portable para ejecución nativa en clientes sin instalación.
- **Lectura/Escritura Excel:** [ExcelJS](https://github.com/exceljs/exceljs) y `xlsx`.
- **Capa Nativa (Desktop):** [C# / WinForms (.NET 4.0)](https://dotnet.microsoft.com/) - Actúa como el orquestador y la interfaz de ventana principal.

### Metodología de Empaquetado (El flujo "Portable")
Para que el cliente final no tenga que instalar absolutamente nada (ni Node, ni bases de datos), la app se distribuye mediante una arquitectura de **Self-Extracting Archive (SFX)** y **Standalone Mode**.

1. **Next.js Standalone:** Next.js compila solo los archivos necesarios (`.next/standalone`).
2. **Motor Portable:** Se descarga un `node.exe` aislado (renombrado a `node_zemer.exe`) y se adjunta a la compilación.
3. **C# Launcher (`GUI.cs`):** Un programa de 1MB que:
   - Escanea puertos dinámicamente (ej. 3000-3010) para evitar bloqueos.
   - Inyecta la variable de entorno de SQLite en `%APPDATA%\FacturasApp` para que **la base de datos persista y nunca se borre al actualizar.**
   - Inicia `node_zemer.exe` y abre el navegador automáticamente en la interfaz.
4. **Empaquetado (WinRAR):** Todo se comprime en un único `Facturas_Produccion.exe`.

---

##  Guía para el Desarrollador (Cómo trabajar en el proyecto)

### Requisitos Locales
- Node.js (v20+) o Bun instalado en tu PC.
- C# Compiler (viene por defecto en Windows `C:\Windows\Microsoft.NET\Framework64\...`)
- WinRAR instalado en `C:\Program Files\WinRAR\WinRAR.exe`.
- GitHub CLI (`gh`) para lanzar actualizaciones.

### Flujo de Desarrollo

1. **Pruebas Locales (Modo Web):**
   Abre la consola en esta carpeta y ejecuta:
   ```bash
   bun run dev
   ```
   Abre `http://localhost:3000`. Todo el código está en `src/`.

2. **Compilar y Probar el `.exe` Localmente:**
   Para ver cómo queda la versión de escritorio, abre PowerShell como Administrador y ejecuta:
   ```powershell
   .\build-portable.ps1
   ```
   Esto generará el archivo `Facturas_Produccion.exe`. Dale doble clic para probarlo.

3. **Lanzar una Actualización a los Clientes (OTA):**
   Cuando hagas una mejora que quieras enviar a todos tus usuarios, sigue este flujo:
   - Abre `package.json` y sube la versión (ej. `"version": "0.3.0"`).
   - Abre PowerShell y ejecuta el script automático:
     ```powershell
     .\publish-release.ps1 -Notes "Arreglé un fallo y mejoré el diseño"
     ```
   - El script compilará todo, aplicará el ícono Zemer, firmará el `.exe` por seguridad y lo subirá a GitHub Releases.
   - En ese momento, tus clientes verán el botón de actualización en sus pantallas.

---

## 🛡️ Seguridad y Firmas
El proyecto utiliza una generación en tiempo real de iconos e inyección de recursos (`rcedit`). Además, el script de publicación (`build-portable.ps1`) genera automáticamente un certificado CodeSigning local a nombre de **"Zemer"** y firma el instalador para reducir falsos positivos en Windows SmartScreen. 
