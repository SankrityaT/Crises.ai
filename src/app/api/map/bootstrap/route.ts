import { NextResponse } from "next/server";

import { getBootstrapPayload } from "../../../../../backend/services/bootstrap";

export async function GET() {
  try {
    const payload = await getBootstrapPayload();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[API][Bootstrap] Failed to build payload", error);
    return NextResponse.json(
      { message: "Failed to load bootstrap payload" },
      { status: 500 }
    );
  }
}
