import React, { useCallback, useEffect, useState } from "react";
import { socket } from "./socket.js";
import { uid, extractYoutubeId } from "./utils.js";
import { useYouTubePlayer, applyStateToPlayer } from "./useYouTubePlayer.js";

import JoinScreen from "./components/JoinScreen.jsx";
import PresenceBar from "./components/PresenceBar.jsx";
import { ReactionBar, FloaterLayer } from "./components/Reactions.jsx";
import { RoomHeader, Tabs } from "./components/RoomChrome.jsx";
import MediaPanel from "./components/MediaPanel.jsx";
import GamePanel from "./components/GamePanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";

function emptyMedia() {
  return { videoId: null, isPlaying: false, position: 0, updatedAt: Date.now(), updatedBy: null };
}
function emptyGame() {
  return { board: Array(9).fill(null), turn: "X", players: { X: null, O: null }, winner: null, line: null };
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem("together_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function storeUser(u) {
  try {
    localStorage.setItem("together_user", JSON.stringify(u));
  } catch (e) {
    // ignore
  }
}

export default function App() {
  const [user, setUser] = useState(loadStoredUser());
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState("watch");

  const [presence, setPresence] = useState({});
  const [watch, setWatch] = useState(emptyMedia());
  const [listen, setListen] = useState(emptyMedia());
  const [game, setGame] = useState(emptyGame());
  const [floaters, setFloaters] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);

  const [watchContainerRef, watchPlayerRef, watchReady, watchError] = useYouTubePlayer("yt-watch-mount");
  const [listenContainerRef, listenPlayerRef, listenReady, listenError] = useYouTubePlayer("yt-listen-mount");

  const joinRoom = useCallback(
    (code, name) => {
      const u = { id: user?.id || uid(), name };
      setUser(u);
      storeUser(u);
      setRoom(code);
      socket.connect();
      socket.emit("join_room", { roomCode: code, name, userId: u.id });
    },
    [user]
  );

  const leaveRoom = useCallback(() => {
    socket.disconnect();
    setRoom(null);
    setPresence({});
    setWatch(emptyMedia());
    setListen(emptyMedia());
    setGame(emptyGame());
    setChatMessages([]);
  }, []);

  useEffect(() => {
    function onSnapshot(s) {
      setPresence(s.presence || {});
      setWatch(s.watch || emptyMedia());
      setListen(s.listen || emptyMedia());
      setGame(s.game || emptyGame());
      setChatMessages(s.chat || []);
      applyStateToPlayer(watchPlayerRef, s.watch || emptyMedia(), { force: true });
      applyStateToPlayer(listenPlayerRef, s.listen || emptyMedia(), { force: true });
    }
    function onPresenceUpdate(p) {
      setPresence(p);
    }
    function onReaction(r) {
      spawnFloater(r.emoji, r.name);
    }
    function onChatMessage(m) {
      setChatMessages((prev) => [...prev, m].slice(-200));
    }
    function onMediaUpdate({ kind, state }) {
      console.log("[Together DEBUG] received media:update", kind, state);
      if (kind === "watch") {
        setWatch(state);
        applyStateToPlayer(watchPlayerRef, state, { force: true });
      } else {
        setListen(state);
        applyStateToPlayer(listenPlayerRef, state, { force: true });
      }
    }
    function onGameUpdate(g) {
      setGame(g);
    }
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on("room:snapshot", onSnapshot);
    socket.on("presence:update", onPresenceUpdate);
    socket.on("reaction", onReaction);
    socket.on("chat:message", onChatMessage);
    socket.on("media:update", onMediaUpdate);
    socket.on("game:update", onGameUpdate);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("room:snapshot", onSnapshot);
      socket.off("presence:update", onPresenceUpdate);
      socket.off("reaction", onReaction);
      socket.off("chat:message", onChatMessage);
      socket.off("media:update", onMediaUpdate);
      socket.off("game:update", onGameUpdate);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchPlayerRef, listenPlayerRef]);

  useEffect(() => {
    if (watchReady) applyStateToPlayer(watchPlayerRef, watch, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchReady]);
  useEffect(() => {
    if (listenReady) applyStateToPlayer(listenPlayerRef, listen, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenReady]);

  function spawnFloater(emoji, name) {
    const id = uid();
    setFloaters((f) => [...f, { id, emoji, name, left: 20 + Math.random() * 60, drift: Math.random() * 80 - 40 }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2700);
  }

  function sendReaction(emoji) {
    socket.emit("reaction", { emoji });
    spawnFloater(emoji, user.name);
  }

  function loadMedia(kind, url) {
    const player = kind === "watch" ? watchPlayerRef : listenPlayerRef;
    const id = extractYoutubeId(url);
    if (!id) return false;
    const partial = { videoId: id, isPlaying: true, position: 0 };
    const full = { ...partial, updatedAt: Date.now(), updatedBy: user.id };
    kind === "watch" ? setWatch(full) : setListen(full);
    applyStateToPlayer(player, full, { force: true });
    socket.emit("media:update", { kind, state: partial });
    return true;
  }

  function togglePlay(kind) {
    const st = kind === "watch" ? watch : listen;
    if (!st.videoId) return;
    const player = kind === "watch" ? watchPlayerRef : listenPlayerRef;
    const pos = player.current?.getCurrentTime ? player.current.getCurrentTime() : st.position;
    const partial = { videoId: st.videoId, isPlaying: !st.isPlaying, position: pos };
    const full = { ...partial, updatedAt: Date.now(), updatedBy: user.id };
    kind === "watch" ? setWatch(full) : setListen(full);
    applyStateToPlayer(player, full, { force: true });
    socket.emit("media:update", { kind, state: partial });
  }

  function seekMedia(kind, pct) {
    const st = kind === "watch" ? watch : listen;
    if (!st.videoId) return;
    const player = kind === "watch" ? watchPlayerRef : listenPlayerRef;
    const dur = player.current?.getDuration ? player.current.getDuration() : 0;
    const pos = pct * dur;
    const partial = { videoId: st.videoId, isPlaying: st.isPlaying, position: pos };
    const full = { ...partial, updatedAt: Date.now(), updatedBy: user.id };
    kind === "watch" ? setWatch(full) : setListen(full);
    applyStateToPlayer(player, full, { force: true });
    socket.emit("media:update", { kind, state: partial });
  }

  function sendChatMessage(text) {
    socket.emit("chat:message", { text });
  }

  function claimSide(symbol) {
    socket.emit("game:claim", { symbol });
  }
  function makeMove(index) {
    socket.emit("game:move", { index });
  }
  function resetGame() {
    socket.emit("game:reset");
  }

  if (!user || !room) {
    return <JoinScreen defaultName={user?.name} onJoin={joinRoom} />;
  }

  return (
    <div id="app">
      <div className="main-column">
        <RoomHeader room={room} connected={connected} onLeave={leaveRoom} />
        <PresenceBar presence={presence} />
        <ReactionBar onSend={sendReaction} />
        <FloaterLayer floaters={floaters} />
        <Tabs tab={tab} setTab={setTab} />

        <MediaPanel
          kind="watch"
          visible={tab === "watch"}
          state={watch}
          playerRef={watchPlayerRef}
          containerRef={watchContainerRef}
          error={watchError}
          onLoad={(url) => loadMedia("watch", url)}
          onToggle={() => togglePlay("watch")}
          onSeek={(pct) => seekMedia("watch", pct)}
        />
        <MediaPanel
          kind="listen"
          visible={tab === "listen"}
          state={listen}
          playerRef={listenPlayerRef}
          containerRef={listenContainerRef}
          error={listenError}
          onLoad={(url) => loadMedia("listen", url)}
          onToggle={() => togglePlay("listen")}
          onSeek={(pct) => seekMedia("listen", pct)}
        />
        <GamePanel
          visible={tab === "play"}
          game={game}
          userId={user.id}
          onClaim={claimSide}
          onMove={makeMove}
          onReset={resetGame}
        />
      </div>

      <div className={"chat-column" + (chatOpen ? " open" : "")}>
        <ChatPanel
          messages={chatMessages}
          userId={user.id}
          onSend={sendChatMessage}
          onClose={() => setChatOpen(false)}
        />
      </div>

      {!chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} aria-label="Open chat">
          💬
        </button>
      )}
    </div>
  );
}