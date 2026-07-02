import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(req: Request) {
  const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "WalterSolorzano/FacturasSistema";
  const BRANCH = "main"; // Por defecto se subirá a main a menos que se cambie

  if (!GITHUB_TOKEN || GITHUB_TOKEN === "TU_TOKEN_DE_GITHUB_AQUI") {
    return NextResponse.json({ error: "No GitHub token configured" }, { status: 400 });
  }

  async function uploadFileToGithub(filePath: string, repoPath: string) {
    if (!fs.existsSync(filePath)) return null;
    
    // Leer archivo y convertir a base64
    const content = fs.readFileSync(filePath).toString("base64");
    
    // 1. Obtener el SHA si el archivo ya existe (requerido por GitHub API para actualizar)
    let sha = undefined;
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${repoPath}?ref=${BRANCH}`, {
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "User-Agent": "Facturas-App-Backup",
          "Accept": "application/vnd.github.v3+json"
        },
        // Siguientes fetches en Next.js no deben cachearse
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        sha = data.sha;
      }
    } catch (e) {}

    // 2. Subir / Actualizar archivo
    const resPut = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${repoPath}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "Facturas-App-Backup",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Backup automático ${new Date().toISOString()}`,
        content: content,
        branch: BRANCH,
        sha: sha
      })
    });
    
    return resPut.ok;
  }

  try {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const dbDir = path.join(appData, "FacturasApp");
    
    // Identificador único por cliente/computadora
    const machineId = os.hostname().replace(/[^a-zA-Z0-9]/g, "_");
    
    // Archivos a respaldar
    const dbPath = path.join(dbDir, "custom.db");
    const logPath = path.join(dbDir, "app.log");
    const serverLogPath = path.join(dbDir, "server_log.txt");

    const results = [];
    
    if (fs.existsSync(dbPath)) {
      const ok = await uploadFileToGithub(dbPath, `backups/${machineId}/custom.db`);
      results.push({ file: 'custom.db', ok });
    }
    
    if (fs.existsSync(logPath)) {
      const ok = await uploadFileToGithub(logPath, `backups/${machineId}/app.log`);
      results.push({ file: 'app.log', ok });
    }
    
    if (fs.existsSync(serverLogPath)) {
      const ok = await uploadFileToGithub(serverLogPath, `backups/${machineId}/server_log.txt`);
      results.push({ file: 'server_log.txt', ok });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Backup failed:", error);
    return NextResponse.json({ error: "Backup failed", details: String(error) }, { status: 500 });
  }
}
