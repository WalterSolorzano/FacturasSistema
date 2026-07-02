export async function logError(error: Error | string, context?: any) {
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: typeof error === "string" ? error : error.message,
        stack: typeof error === "string" ? undefined : error.stack,
        context,
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    });
  } catch (e) {
    console.error("Failed to send log:", e);
  }
}
