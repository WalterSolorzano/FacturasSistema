import { NextResponse } from "next/server";
import { db } from "@/lib/db";

let initialized = false;

export async function GET() {
  if (initialized) {
    return NextResponse.json({ status: "already_initialized" });
  }
  
  try {
    // Enable Write-Ahead Logging for high concurrency and robust locking
    await db.$executeRawUnsafe("PRAGMA journal_mode = WAL;");
    await db.$executeRawUnsafe("PRAGMA synchronous = NORMAL;");
    await db.$executeRawUnsafe("PRAGMA busy_timeout = 5000;");
    
    initialized = true;
    console.log("SQLite WAL mode activated successfully.");
    
    return NextResponse.json({ success: true, message: "WAL enabled" });
  } catch (error) {
    console.error("Error initializing WAL mode:", error);
    return NextResponse.json({ error: "Failed to init WAL" }, { status: 500 });
  }
}
