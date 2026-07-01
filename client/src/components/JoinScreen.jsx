import React, { useState } from "react";
import { genRoomCode } from "../utils.js";

export default function JoinScreen({ defaultName, onJoin }) {
  const [name, setName] = useState(defaultName || "");
  const [code, setCode] = useState("");

  function join(forceNew) {
    const finalName = name.trim() || "Guest";
    const finalCode = forceNew ? genRoomCode() : code.trim().toUpperCase() || genRoomCode();
    onJoin(finalCode, finalName);
  }

  return (
    <div className="join-wrap">
      <div className="join-glow" />
      <h1 className="display">Together</h1>
      <p>
        A little room for the people you miss. Watch something, play something, or just sit in the
        same virtual couch — from wherever you all are.
      </p>
      <div className="join-card">
        <label htmlFor="nameInput">Your name</label>
        <input
          id="nameInput"
          type="text"
          value={name}
          maxLength={18}
          placeholder="What should we call you?"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join(false)}
        />
        <label htmlFor="roomInput">Room code</label>
        <input
          id="roomInput"
          type="text"
          value={code}
          maxLength={8}
          placeholder="e.g. FOX7 (leave blank to start one)"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join(false)}
        />
        <div className="row-btns">
          <button className="btn-primary" onClick={() => join(false)}>
            Join room
          </button>
        </div>
        <div className="divider-or">— or —</div>
        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => join(true)}>
          Start a brand new room
        </button>
      </div>
    </div>
  );
}
