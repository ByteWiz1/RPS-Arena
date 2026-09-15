import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
const SERVER_URL = 'https://your-server.onrender.com';

export function connectToServer(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      resolve(socket);
      return;
    }

    socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => resolve(socket!));
    socket.on('connect_error', (error) => reject(error));
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectFromServer(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}