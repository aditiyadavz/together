import { useCallback, useRef, useState } from "react";

let apiPromise = null;
function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/**
 * Mounts a YouTube player using a React *callback ref* instead of a plain
 * ref + useEffect. React calls a callback ref with the real DOM node the
 * instant it's attached (and with null right before it's removed) — there is
 * no separate render/commit/effect timing to reason about, so this can't
 * race the way a useRef+useEffect pairing sometimes can.
 *
 * It also still avoids handing YouTube a DOM node that React renders
 * declaratively: we create our own plain child div imperatively and give
 * that to YouTube, so React never tries to reconcile the iframe YouTube
 * creates.
 */
export function useYouTubePlayer(mountId) {
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);

  const containerRef = useCallback(
    (node) => {
      if (node) {
        const inner = document.createElement("div");
        inner.id = mountId;
        inner.style.width = "100%";
        inner.style.height = "100%";
        node.appendChild(inner);

        loadYouTubeAPI().then((YT) => {
          // If the component unmounted before the API finished loading,
          // `node` will already be disconnected — bail out instead of
          // creating a player nobody can see.
          if (!inner.isConnected) return;
          playerRef.current = new YT.Player(inner, {
            height: "100%",
            width: "100%",
            playerVars: { rel: 0, modestbranding: 1 },
            events: {
              onReady: () => setReady(true),
            },
          });
        });
      } else {
        // node is null: React is about to remove the container (unmount).
        try {
          playerRef.current?.destroy();
        } catch (e) {
          // player may not be fully initialized yet
        }
        playerRef.current = null;
        setReady(false);
      }
    },
    [mountId]
  );

  return [containerRef, playerRef, ready];
}

/** Push a shared media state into a player, correcting drift or loading a new video. */
export function applyStateToPlayer(playerRef, state, { force = false } = {}) {
  const player = playerRef.current;
  if (!player || !player.loadVideoById || !state || !state.videoId) return;
  const predicted = state.isPlaying ? state.position + (Date.now() - state.updatedAt) / 1000 : state.position;
  try {
    const data = player.getVideoData ? player.getVideoData() : {};
    if (data.video_id !== state.videoId) {
      if (state.isPlaying) player.loadVideoById(state.videoId, Math.max(0, predicted));
      else player.cueVideoById(state.videoId, Math.max(0, predicted));
      return;
    }
    if (force) {
      player.seekTo(Math.max(0, predicted), true);
    } else {
      const cur = player.getCurrentTime ? player.getCurrentTime() : 0;
      if (Math.abs(cur - predicted) > 2.5) player.seekTo(Math.max(0, predicted), true);
    }
    state.isPlaying ? player.playVideo() : player.pauseVideo();
  } catch (e) {
    console.warn("[Together] applyStateToPlayer failed, will retry on next update:", e);
  }
}