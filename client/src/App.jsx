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
    // ignore (e.g. private browsing storage errors)
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

  const [watchContainerRef, watchPlayerRef, watchReady] = useYouTubePlayer("yt-watch-mount");
  const [listenContainerRef, listenPlayerRef, listenReady] = useYouTubePlayer("yt-listen-mount");

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
  }, []);

  // Wire up socket listeners once, and re-attach handlers if player refs/readiness change.
  useEffect(() => {
    function onSnapshot(s) {
      setPresence(s.presence || {});
      setWatch(s.watch || emptyMedia());
      setListen(s.listen || emptyMedia());
      setGame(s.game || emptyGame());
      applyStateToPlayer(watchPlayerRef, s.watch || emptyMedia(), { force: true });
      applyStateToPlayer(listenPlayerRef, s.listen || emptyMedia(), { force: true });
    }
    function onPresenceUpdate(p) {
      setPresence(p);
    }
    function onReaction(r) {
      spawnFloater(r.emoji, r.name);
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
    socket.on("media:update", onMediaUpdate);
    socket.on("game:update", onGameUpdate);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("room:snapshot", onSnapshot);
      socket.off("presence:update", onPresenceUpdate);
      socket.off("reaction", onReaction);
      socket.off("media:update", onMediaUpdate);
      socket.off("game:update", onGameUpdate);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchPlayerRef, listenPlayerRef]);

  // The fix for "nothing happens": if a video was already chosen (e.g. from the
  // room snapshot on join, or a socket update) before the YouTube player finished
  // initializing, the load attempt above silently no-ops. Once the player signals
  // it's actually ready, re-apply whatever media state we currently know about.
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
    spawnFloater(emoji, user.name); // optimistic local echo, server only relays to others
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
  );
}