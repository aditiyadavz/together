import React from "react";

const EMOJI = ["❤️", "😂", "👏", "🔥", "😮", "🙌"];

export function ReactionBar({ onSend }) {
  return (
    <div className="reaction-bar">
      {EMOJI.map((e) => (
        <button key={e} className="react-btn" onClick={() => onSend(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}

export function FloaterLayer({ floaters }) {
  return (
    <div className="float-layer">
      {floaters.map((f) => (
        <div
          key={f.id}
          className="floater"
          style={{ left: f.left + "%", "--drift": f.drift + "px" }}
        >
          {f.emoji}
          <span className="who">{f.name}</span>
        </div>
      ))}
    </div>
  );
}
