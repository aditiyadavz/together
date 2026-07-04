import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 4000;
const rawOrigin = process.env.CLIENT_ORIGIN || "*";
const ALLOWED_ORIGINS = rawOrigin === "*" ? "*" : rawOrigin.split(",").map((s) => s.trim());

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.get("/health", (req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS },
});

const rooms = new Map();

const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function emptyMedia() {
  return { videoId: null, isPlaying: false, position: 0, updatedAt: Date.now(), updatedBy: null };
}
function emptyGame() {
  return { board: Array(9).fill(null), turn: "X", players: { X: null, O: null }, winner: null, line: null };
}
function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      users: new Map(),
      reactions: [],
      chat: [],
      watch: emptyMedia(),
      listen: emptyMedia(),
      game: emptyGame(),
    });
  }
  return rooms.get(code);
}
function presenceList(room) {
  const map = {};
  for (const [, u] of room.users) {
    map[u.userId] = { name: u.name, lastSeen: Date.now() };
  }
  return map;
}
function broadcastPresence(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("presence:update", presenceList(room));
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on("join_room", ({ roomCode, name, userId }) => {
    if (!roomCode || !userId) return;
    currentRoom = String(roomCode).toUpperCase();
    currentUser = { userId, name: (name || "Guest").slice(0, 24) };

    socket.join(currentRoom);
    const room = getRoom(currentRoom);
    room.users.set(socket.id, currentUser);

    socket.emit("room:snapshot", {
      presence: presenceList(room),
      watch: room.watch,
      listen: room.listen,
      game: room.game,
      reactions: room.reactions.slice(-10),
      chat: room.chat.slice(-50),
    });
    broadcastPresence(currentRoom);
  });

  socket.on("reaction", ({ emoji }) => {
    if (!currentRoom || !currentUser || !emoji) return;
    const room = getRoom(currentRoom);
    const entry = {
      id: Math.random().toString(36).slice(2),
      emoji,
      name: currentUser.name,
      userId: currentUser.userId,
      ts: Date.now(),
    };
    room.reactions.push(entry);
    if (room.reactions.length > 30) room.reactions.shift();
    socket.to(currentRoom).emit("reaction", entry);
  });

  socket.on("chat:message", ({ text }) => {
    if (!currentRoom || !currentUser) return;
    const clean = String(text || "").trim().slice(0, 500);
    if (!clean) return;
    const room = getRoom(currentRoom);
    const entry = {
      id: Math.random().toString(36).slice(2),
      text: clean,
      name: currentUser.name,
      userId: currentUser.userId,
      ts: Date.now(),
    };
    room.chat.push(entry);
    if (room.chat.length > 200) room.chat.shift();
    io.to(currentRoom).emit("chat:message", entry);
  });

  socket.on("media:update", ({ kind, state }) => {
    if (!currentRoom || (kind !== "watch" && kind !== "listen") || !state) return;
    const room = getRoom(currentRoom);
    room[kind] = {
      videoId: state.videoId ?? room[kind].videoId,
      isPlaying: !!state.isPlaying,
      position: typeof state.position === "number" ? state.position : room[kind].position,
      updatedAt: Date.now(),
      updatedBy: currentUser?.userId ?? null,
    };
    socket.to(currentRoom).emit("media:update", { kind, state: room[kind] });
  });

  socket.on("game:claim", ({ symbol }) => {
    if (!currentRoom || !currentUser || (symbol !== "X" && symbol !== "O")) return;
    const room = getRoom(currentRoom);
    if (!room.game.players[symbol]) {
      room.game.players[symbol] = currentUser.userId;
      io.to(currentRoom).emit("game:update", room.game);
    }
  });

  socket.on("game:move", ({ index }) => {
    if (!currentRoom || !currentUser) return;
    const room = getRoom(currentRoom);
    const g = room.game;
    if (typeof index !== "number" || index < 0 || index > 8) return;
    if (g.board[index] || g.winner) return;

    const symbol = g.players.X === currentUser.userId ? "X" : g.players.O === currentUser.userId ? "O" : null;
    if (!symbol || symbol !== g.turn) return;

    g.board[index] = symbol;
    let won = null;
    for (const [a, b, c] of WINS) {
      if (g.board[a] && g.board[a] === g.board[b] && g.board[b] === g.board[c]) {
        won = symbol;
        g.line = [a, b, c];
        break;
      }
    }
    if (won) g.winner = won;
    else if (g.board.every(Boolean)) g.winner = "draw";
    else g.turn = g.turn === "X" ? "O" : "X";

    io.to(currentRoom).emit("game:update", g);
  });

  socket.on("game:reset", () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.game.board = Array(9).fill(null);
    room.game.winner = null;
    room.game.line = null;
    room.game.turn = "X";
    io.to(currentRoom).emit("game:update", room.game);
  });

  socket.on("disconnect", () => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const room = rooms.get(currentRoom);
    room.users.delete(socket.id);
    broadcastPresence(currentRoom);
    if (room.users.size === 0) {
      const codeAtClose = currentRoom;
      setTimeout(() => {
        const r = rooms.get(codeAtClose);
        if (r && r.users.size === 0) rooms.delete(codeAtClose);
      }, 5 * 60 * 1000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Together server listening on :${PORT}`);
});