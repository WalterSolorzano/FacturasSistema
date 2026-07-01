import { spawnSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// 1. Ocultar la consola de comandos principal lo más rápido posible
const hideConsoleScript = `
Add-Type -Name Window -Namespace Console -MemberDefinition '
[DllImport("Kernel32.dll")]
public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
'
[Console.Window]::ShowWindow([Console.Window]::GetConsoleWindow(), 0)
`;

try {
  spawnSync("powershell", ["-WindowStyle", "Hidden", "-NoProfile", "-Command", hideConsoleScript], { stdio: "ignore", windowsHide: true });
} catch (e) {}

const runCmdSync = (cmd: string, args: string[]) => {
  const result = spawnSync(cmd, args, { shell: true, windowsHide: true });
  if (result.status !== 0) {
    process.exit(1);
  }
};

// Verificar node_modules
if (!fs.existsSync("node_modules")) {
  runCmdSync("bun", ["install"]);
}

// Verificar carpeta db
if (!fs.existsSync("db")) {
  fs.mkdirSync("db", { recursive: true });
}

// Verificar base de datos
if (!fs.existsSync("db/custom.db")) {
  process.env.DATABASE_URL = "file:./db/custom.db";
  runCmdSync("bun", ["prisma", "db", "push"]);
}

// Verificar build standalone
if (!fs.existsSync(".next/standalone")) {
  runCmdSync("bun", ["run", "build"]);
  
  if (fs.existsSync(".next/static")) {
    fs.cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  }
  if (fs.existsSync("public")) {
    fs.cpSync("public", ".next/standalone/public", { recursive: true });
  }
}

// Iniciar servidor
process.env.NODE_ENV = "production";
const dbPath = path.join(process.cwd(), "db", "custom.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORT = "3000";

let serverChild;
if (fs.existsSync(".next/standalone/server.js")) {
    serverChild = spawn("bun", [".next/standalone/server.js"], { stdio: "ignore", shell: true, detached: false, windowsHide: true });
} else {
    serverChild = spawn("bun", ["run", "dev"], { stdio: "ignore", shell: true, detached: false, windowsHide: true });
}

// 2. Abrir interfaz gráfica con PowerShell (sin que se vea la consola de PS)
const guiScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Sistema de Facturación"
$form.Size = New-Object System.Drawing.Size(360, 200)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::White

$font = New-Object System.Drawing.Font("Segoe UI", 10)
$form.Font = $font

$label = New-Object System.Windows.Forms.Label
$label.Text = "✅ El servidor está en ejecución."
$label.AutoSize = $true
$label.Location = New-Object System.Drawing.Point(30, 30)
$label.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($label)

$label2 = New-Object System.Windows.Forms.Label
$label2.Text = "Cierra esta ventana para apagar el sistema."
$label2.AutoSize = $true
$label2.Location = New-Object System.Drawing.Point(30, 60)
$label2.ForeColor = [System.Drawing.Color]::Gray
$form.Controls.Add($label2)

$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = "🌐 Abrir Programa"
$btnOpen.Size = New-Object System.Drawing.Size(140, 40)
$btnOpen.Location = New-Object System.Drawing.Point(30, 100)
$btnOpen.BackColor = [System.Drawing.Color]::FromArgb(147, 51, 234)
$btnOpen.ForeColor = [System.Drawing.Color]::White
$btnOpen.FlatStyle = "Flat"
$btnOpen.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnOpen.Add_Click({ Start-Process "http://localhost:3000" })
$form.Controls.Add($btnOpen)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = "🛑 Detener"
$btnClose.Size = New-Object System.Drawing.Size(140, 40)
$btnClose.Location = New-Object System.Drawing.Point(180, 100)
$btnClose.BackColor = [System.Drawing.Color]::FromArgb(239, 68, 68)
$btnClose.ForeColor = [System.Drawing.Color]::White
$btnClose.FlatStyle = "Flat"
$btnClose.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# Abrir el navegador automáticamente al iniciar
Start-Process "http://localhost:3000"

$form.ShowDialog()
`;

const guiChild = spawn("powershell", ["-WindowStyle", "Hidden", "-NoProfile", "-Command", guiScript], { stdio: "ignore" });

// Cuando se cierra la ventana gráfica, matamos el servidor y salimos
guiChild.on('close', () => {
    if (serverChild) {
        // En Windows, matar el proceso de forma segura
        spawnSync("taskkill", ["/pid", serverChild.pid.toString(), "/t", "/f"], { windowsHide: true });
    }
    process.exit(0);
});

