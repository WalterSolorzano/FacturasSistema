import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("Shutting down database connection safely...");
    await db.$disconnect();
    
    // We do NOT call process.exit() here because Next.js standalone process 
    // will be killed by the C# Launcher after 1000ms.
    // Calling process.exit() here could interrupt HTTP response.
    
    return NextResponse.json({ success: true, message: "Database disconnected gracefully." });
  } catch (error) {
    console.error("Error during shutdown:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
