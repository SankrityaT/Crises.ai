import type { Server as HTTPServer } from "node:http";
import type { Socket } from "node:net";

import type { NextApiRequest } from "next";
import type { NextApiResponse } from "next";

import { initSocketServer } from "@/app/api/socket/io";

export const config = {
  api: {
    bodyParser: false,
  },
};

type SocketWithServer = Socket & {
  server: HTTPServer & {
    io?: ReturnType<typeof initSocketServer>;
  };
};

type NextApiResponseWithIO = NextApiResponse & {
  socket: SocketWithServer;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponseWithIO
) {
  const { socket } = res;
  const httpServer = socket?.server;

  if (!httpServer) {
    res.status(500).end();
    return;
  }

  if (!httpServer.io) {
    httpServer.io = initSocketServer(httpServer);
  }

  res.end();
}
