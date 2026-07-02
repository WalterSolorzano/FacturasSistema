import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const dbDir = path.join(appData, "FacturasApp");
    
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    
    const logPath = path.join(dbDir, "app.log");
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR: ${data.message}\nURL: ${data.url}\nUSER_AGENT: ${data.userAgent}\nSTACK: ${data.stack}\n\n`;
    
    fs.appendFileSync(logPath, logEntry);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
