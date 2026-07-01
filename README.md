# Together — client + server

Real client/server version of the prototype: presence, reactions, watch-together,
listen-together, and tic-tac-toe, all synced instantly over WebSockets instead of polling.

```
together-app/
  server/   Node.js + Express + Socket.IO — the source of truth for each room
  client/   React + Vite — the UI, talks to the server over a socket
```

## Run it locally

**1. Start the server**
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
Runs on `http://localhost:4000`. Check `http://localhost:4000/health` to confirm it's up.

**2. Start the client** (in a second terminal)
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
Runs on `http://localhost:5173`. Open it in two browser windows, join the same room
code in both, and you should see presence/reactions/watch/listen/game sync live.

## How it's wired

- **Server holds room state in memory** (`server/index.js`) — one object per room code with
  connected users, reactions, watch state, listen state, and game state. No database yet;
  restarting the server clears all rooms. Good enough for now, see "Next steps" below.
- **All sync is push-based via Socket.IO events**, not polling:
  - `join_room` → server replies with `room:snapshot` (full current state) and broadcasts `presence:update`
  - `reaction` → server relays to everyone else in the room; sender shows their own optimistically
  - `media:update` (watch/listen) → server stamps `updatedAt`/`updatedBy` and relays; clients correct
    drift by comparing predicted playback position to the real YouTube player position
  - `game:claim` / `game:move` / `game:reset` → server is authoritative (validates whose turn it is)
    and broadcasts the new board to everyone including the sender
- **YouTube players stay mounted at all times** (`client/src/useYouTubePlayer.js`), even when you're
  on a different tab — the Watch/Listen panels are just hidden with CSS, not unmounted. This avoids
  the "player got destroyed when I switched tabs" class of bugs the prototype had to work around.
- **User identity persists across refreshes** via `localStorage` (a real browser, not the
  claude.ai artifact sandbox, so this is safe to use here) — same name/id survives a reload as
  long as you rejoin the same room code.

## Known limitations (fine for a v1, worth fixing before real users)

- **No persistence** — server restart wipes all rooms. Add Redis or Postgres if you want rooms
  to survive deploys, or to support horizontal scaling across multiple server instances.
- **No auth** — anyone with a room code can join as anyone. Fine for friends/family sharing a
  link; add real accounts if this grows beyond that.
- **Single server instance** — Socket.IO rooms are in-process. To run more than one server
  instance you'd need the Socket.IO Redis adapter so instances can relay events to each other.
- **Only YouTube** — watch/listen both take YouTube links. Netflix/Disney+/Spotify don't offer
  embeddable players with programmatic sync control, so "watch together" for those services
  needs a different approach (e.g. a browser extension that syncs playback across users' own
  logged-in sessions, which is how existing watch-party products handle it).

## Suggested next steps

1. **Deploy it** — server to Render/Railway/Fly.io (anything that keeps a long-lived Node
   process for WebSockets), client to Vercel/Netlify. Set `CLIENT_ORIGIN` on the server and
   `VITE_SERVER_URL` on the client to point at each other.
2. **Persistence** — swap the in-memory `Map` in `server/index.js` for Redis so rooms survive
   restarts and reconnects are smoother.
3. **More games** — the tic-tac-toe pattern (claim a side → server validates turns → broadcast)
   generalizes easily to other simple synced games (Connect 4, trivia, drawing/Pictionary).
4. **Voice chat** — would need WebRTC (e.g. via a service like LiveKit or Daily) layered on top;
   the room/presence model here would carry over directly.
