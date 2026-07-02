"use client";

import { useEffect } from "react";
import { logError } from "@/lib/logger";

export function GlobalLogger() {
  useEffect(() => {
    const handleUncaught = (event: ErrorEvent) => {
      logError(event.error || event.message);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      logError(event.reason);
    };
    
    window.addEventListener("error", handleUncaught);
    window.addEventListener("unhandledrejection", handleRejection);
    
    return () => {
      window.removeEventListener("error", handleUncaught);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Timer para respaldar automáticamente a GitHub
  useEffect(() => {
    const sync = async () => {
      try { await fetch("/api/backup", { method: "POST" }); } catch {}
    };
    
    // Respaldar 10 segundos después de iniciar la aplicación
    const t1 = setTimeout(sync, 10000);
    
    // Y luego respaldar cada 60 minutos
    const t2 = setInterval(sync, 60 * 60 * 1000);
    
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, []);

  return null;
}
