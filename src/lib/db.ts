import { PrismaClient } from '@prisma/client'
import path from 'path'
import os from 'os'

// ============================================================
// En producción (ejecutable portable), el DATABASE_URL debe
// apuntar a AppData/Roaming/FacturasApp/custom.db para que
// la base de datos persista aunque el exe se mueva de lugar.
//
// El launcher C# ya inyecta DATABASE_URL antes de lanzar este
// proceso, pero si por alguna razón no viene (edge case),
// lo calculamos aquí como fallback robusto.
// ============================================================

function resolveDbUrl(): string {
  // Si ya viene del entorno (lo normal), usarlo tal cual
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Fallback: construir la ruta a AppData
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const dbDir   = path.join(appData, 'FacturasApp');

  // Asegurarse de que existe la carpeta
  try {
    const fs = require('fs');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  } catch { /* ignorar si falla */ }

  const dbPath = path.join(dbDir, 'custom.db').replace(/\\/g, '/');
  const url    = `file:${dbPath}`;
  process.env.DATABASE_URL = url;
  console.warn(`[DB] DATABASE_URL no estaba definido. Usando fallback: ${url}`);
  return url;
}

// ============================================================
// Singleton de Prisma (patrón recomendado para Next.js)
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = resolveDbUrl();
  return new PrismaClient({
    datasources: {
      db: { url },
    },
    // En producción silenciamos los logs de queries para rendimiento
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'],
  });
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient();

// Solo cachear en desarrollo para evitar hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}