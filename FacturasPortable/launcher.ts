import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

console.log("\n=======================================================");
console.log("  SISTEMA DE FACTURAS - Iniciando...");
console.log("=======================================================\n");

const baseDir = process.cwd();
const bunExe = path.join(baseDir, "bun.exe");
const serverJs = path.join(baseDir, "app", "server.js");
const bundledDb = path.join(baseDir, "db", "custom.db");

// Use AppData for persistent database storage
const appDataDir = path.join(os.homedir(), "AppData", "Roaming", "FacturasApp");
if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
}
const dbPath = path.join(appDataDir, "custom.db");

// Copy bundled DB if user's DB doesn't exist
if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
    fs.copyFileSync(bundledDb, dbPath);
    console.log(" [OK] Base de datos inicializada en AppData.");
}

if (!fs.existsSync(bunExe)) {
    console.error("[ERROR] No se encontró bun.exe en la carpeta portable.");
    process.exit(1);
}

if (!fs.existsSync(serverJs)) {
    console.error("[ERROR] No se encontró el servidor en app/server.js");
    process.exit(1);
}

process.env.NODE_ENV = "production";
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
process.env.PORT = "3000";

console.log(" [OK] Todo listo. Levantando aplicación...\n");
console.log(" Abre tu navegador en: http://localhost:3000");
console.log(` Base de datos segura en: ${dbPath}\n`);

const serverChild = spawn(bunExe, [serverJs], { stdio: "inherit", shell: false });

serverChild.on('close', (code) => {
    process.exit(code ?? 0);
});
