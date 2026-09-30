import { io } from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    // In dev, connects to proxy or window.location.origin
    socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to CodeMeet WebSocket server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket server:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('WebSocket connection error:', error.message);
    });
  }

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
