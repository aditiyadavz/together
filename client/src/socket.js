import { io } from "socket.io-client";

// Set VITE_SERVER_URL in a .env file for production (e.g. https://your-server.onrender.com)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export const socket = io(SERVER_URL, { autoConnect: false });
