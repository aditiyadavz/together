import React, { useEffect, useRef, useState } from "react";
import { colorFor, initials, fmtClockTime } from "../utils.js";

export default function ChatPanel({ messages, userId, unreadCount, onSend, onClose }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  function submit(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setText("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>
          💬 Chat
          {!!unreadCount && <span className="chat-header-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </span>
        {onClose && (
          <button className="chat-close-btn" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="empty-hint chat-empty">No messages yet — say hi 👋</p>
        )}
        {messages.map((m, i) => {
          const mine = m.userId === userId;
          const prev = messages[i - 1];
          const grouped = prev && prev.userId === m.userId && m.ts - prev.ts < 5 * 60 * 1000;
          return (
            <div key={m.id} className={"chat-msg" + (mine ? " mine" : "") + (grouped ? " grouped" : "")}>
              {!mine && (
                <div className="chat-msg-avatar" style={{ background: colorFor(m.userId) }}>
                  {grouped ? "" : initials(m.name)}
                </div>
              )}
              <div className="chat-msg-body">
                {!mine && !grouped && <span className="chat-msg-name">{m.name}</span>}
                <span className="chat-msg-bubble" title={fmtClockTime(m.ts)}>
                  {m.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <form className="chat-input-row" onSubmit={submit}>
        <input
          type="text"
          value={text}
          maxLength={500}
          placeholder="Type a message…"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="chat-send-btn" type="submit" aria-label="Send" disabled={!text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}