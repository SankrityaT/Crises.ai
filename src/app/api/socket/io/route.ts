import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Simple endpoint to confirm Socket.IO route exists
  return new Response("Socket.IO endpoint available", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

export async function POST(request: NextRequest) {
  return new Response("Socket.IO polling endpoint", {
    status: 200,
  });
}
