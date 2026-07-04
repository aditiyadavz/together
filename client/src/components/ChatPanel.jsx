import React, { useEffect, useRef, useState } from "react";

export default function ChatPanel({ messages, userId, onSend, onClose }) {
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
        <span>💬 Chat</span>
        {onClose && (
          <button className="chat-close-btn" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="empty-hint">No messages yet — say hi 👋</p>}
        {messages.map((m) => {
          const mine = m.userId === userId;
          return (
            <div key={m.id} className={"chat-msg" + (mine ? " mine" : "")}>
              {!mine && <span className="chat-msg-name">{m.name}</span>}
              <span className="chat-msg-bubble">{m.text}</span>
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
        <button className="btn-primary chat-send-btn" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}