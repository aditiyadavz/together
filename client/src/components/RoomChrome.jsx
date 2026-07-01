import React, { useState } from "react";

export function RoomHeader({ room, connected, onLeave }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(room);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="room-top">
      <div className="room-code-chip">
        <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Room</span>
        <span className="mono">{room}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? "copied!" : "copy"}
        </button>
        {!connected && (
          <span style={{ color: "var(--pink)", fontSize: "0.72rem" }}>reconnecting…</span>
        )}
      </div>
      <button className="leave-btn" onClick={onLeave}>
        leave room
      </button>
    </div>
  );
}

export function Tabs({ tab, setTab }) {
  const items = [
    { id: "watch", label: "🎬 Watch" },
    { id: "listen", label: "🎧 Listen" },
    { id: "play", label: "🎮 Play" },
  ];
  return (
    <div className="tabs">
      {items.map((it) => (
        <button
          key={it.id}
          className={"tab-btn" + (tab === it.id ? " active" : "")}
          onClick={() => setTab(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
