import { io } from "socket.io-client";

const getSignalingUrl = () => {
  if (import.meta.env.VITE_SIGNALING_SERVER_URL) {
    return import.meta.env.VITE_SIGNALING_SERVER_URL;
  }
  const hostname = window.location.hostname || "localhost";
  return `${window.location.protocol}//${hostname}:5000`;
};

const SOCKET_SERVER_URL = getSignalingUrl();

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true
    });

    socketInstance.on("connect", () => {
      console.log(`[Socket Connected] Client ID: ${socketInstance.id}`);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("[Socket Connection Error]:", err.message);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log(`[Socket Disconnected]: ${reason}`);
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
