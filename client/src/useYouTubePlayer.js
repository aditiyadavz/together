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

function friendlyYouTubeError(code) {
  if (code === 101 || code === 150) {
    return "This video's owner has disabled playback outside youtube.com — try a different link.";
  }
  if (code === 100) {
    return "That video is private or was removed.";
  }
  if (code === 2) {
    return "That doesn't look like a valid YouTube video.";
  }
  return "That video couldn't be played here — try a different link.";
}

export function useYouTubePlayer(mountId) {
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useCallback(
    (node) => {
      if (node) {
        const inner = document.createElement("div");
        inner.id = mountId;
        inner.style.width = "100%";
        inner.style.height = "100%";
        node.appendChild(inner);

        loadYouTubeAPI().then((YT) => {
          if (!inner.isConnected) return;
          playerRef.current = new YT.Player(inner, {
            height: "100%",
            width: "100%",
            playerVars: { rel: 0, modestbranding: 1 },
            events: {
              onReady: () => setReady(true),
              onError: (e) => setError(friendlyYouTubeError(e?.data)),
              onStateChange: (e) => {
                if (e?.data === 1 || e?.data === -1) setError(null);
              },
            },
          });
        });
      } else {
        try {
          playerRef.current?.destroy();
        } catch (e) {
          // player may not be fully initialized yet
        }
        playerRef.current = null;
        setReady(false);
        setError(null);
      }
    },
    [mountId]
  );

  return [containerRef, playerRef, ready, error];
}

/** Push a shared media state into a player, correcting drift or loading a new video. */
export function applyStateToPlayer(playerRef, state, { force = false } = {}) {
  const player = playerRef.current;
  if (!player || !player.loadVideoById || !state || !state.videoId) {
    console.log("[Together DEBUG] applyStateToPlayer bailed early", {
      hasPlayer: !!player,
      hasLoadVideoById: !!(player && player.loadVideoById),
      hasState: !!state,
      videoId: state && state.videoId,
    });
    return;
  }
  const predicted = state.isPlaying ? state.position + (Date.now() - state.updatedAt) / 1000 : state.position;
  console.log("[Together DEBUG] applyStateToPlayer running", {
    isPlaying: state.isPlaying,
    loadedVideoId: player.__loadedVideoId,
    stateVideoId: state.videoId,
    sameVideo: player.__loadedVideoId === state.videoId,
  });
  try {
    if (player.__loadedVideoId !== state.videoId) {
      player.__loadedVideoId = state.videoId;
      if (state.isPlaying) player.loadVideoById(state.videoId, Math.max(0, predicted));
      else player.cueVideoById(state.videoId, Math.max(0, predicted));
      return;
    }
    if (!state.isPlaying) {
      player.pauseVideo();
      return;
    }

    const cur = player.getCurrentTime ? player.getCurrentTime() : 0;
    if (force || Math.abs(cur - predicted) > 1.5) {
      player.seekTo(Math.max(0, predicted), true);
    }
    player.playVideo();
    setTimeout(() => {
      try {
        if (player.getPlayerState && player.getPlayerState() !== 1) player.playVideo();
      } catch (e) {
        // ignore — player may have been torn down by then
      }
    }, 400);
  } catch (e) {
    console.warn("[Together] applyStateToPlayer failed, will retry on next update:", e);
  }
}