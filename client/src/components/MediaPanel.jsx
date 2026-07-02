import React, { useEffect, useRef, useState } from "react";
import { fmtTime, extractYoutubeId } from "../utils.js";

export default function MediaPanel({ kind, visible, state, playerRef, containerRef, onLoad, onToggle, onSeek }) {
  const isWatch = kind === "watch";
  const [urlInput, setUrlInput] = useState("");
  const [inputError, setInputError] = useState(false);
  const [times, setTimes] = useState({ cur: 0, dur: 0 });
  const barRef = useRef(null);

  // Tick displayed current time / duration from the live player, ~1x/sec.
  useEffect(() => {
    const t = setInterval(() => {
      const player = playerRef.current;
      if (!player || !player.getCurrentTime) return;
      setTimes({
        cur: player.getCurrentTime() || 0,
        dur: player.getDuration ? player.getDuration() || 0 : 0,
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playerRef]);

  function submitLoad() {
    const ok = onLoad(urlInput);
    if (!ok) {
      setInputError(true);
      setTimeout(() => setInputError(false), 900);
      return;
    }
    setUrlInput("");
  }

  function handleSeekClick(e) {
    if (!state.videoId || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  }

  const pct = times.dur > 0 ? Math.min(100, (times.cur / times.dur) * 100) : 0;

  return (
    <div className="panel" style={{ display: visible ? "block" : "none" }}>
      <h2 className="display">
        {isWatch ? "🎬 Watch together" : "🎧 Listen together"}
        {state.videoId && (
          <span className="synced-tag">
            <span className="d"></span>synced
          </span>
        )}
      </h2>
      <div className="sub">
        {isWatch
          ? "Paste any YouTube link — everyone in the room sees it play in sync."
          : "Paste a YouTube link (song, mix, whatever) — it plays in sync for everyone, audio-first."}
      </div>

      <div className="media-input-row">
        <input
          type="text"
          value={urlInput}
          placeholder="Paste a YouTube link…"
          style={inputError ? { borderColor: "var(--pink)" } : undefined}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitLoad()}
        />
        <button className="btn-primary" style={{ flex: "0 0 auto" }} onClick={submitLoad}>
          Load for everyone
        </button>
      </div>

      <div className={isWatch ? "video-wrap" : "video-wrap watch-mount-hidden"}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}></div>
      </div>
      {!isWatch && (
        <div className="listen-visual">
          <div className={"vinyl" + (state.isPlaying ? " spin" : "")}>
            <div className="label"></div>
          </div>
          <div className="eq" style={{ opacity: state.isPlaying ? 1 : 0.25 }}>
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      )}

      <div className="controls-row">
        <button className="icon-btn" onClick={onToggle} disabled={!state.videoId}>
          {state.isPlaying ? "⏸️" : "▶️"}
        </button>
        <span className="time-label">{fmtTime(times.cur)}</span>
        <div className="seek-bar" ref={barRef} onClick={handleSeekClick}>
          <div className="seek-fill" style={{ width: pct + "%" }}></div>
        </div>
        <span className="time-label">{fmtTime(times.dur)}</span>
      </div>

      {!state.videoId && (
        <p className="empty-hint" style={{ marginTop: 14 }}>
          Nothing loaded yet — paste a link above to start it for the whole room.
        </p>
      )}
    </div>
  );
}

// Re-export for convenience if a caller only needs ID extraction.
export { extractYoutubeId };