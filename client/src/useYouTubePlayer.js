import { useEffect, useRef } from "react";

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
 * Mounts a YouTube player into the DOM node with id `mountId` and keeps a
 * ref to the player instance. The mount node should stay in the DOM for the
 * lifetime of the app (don't conditionally render it away) so the player
 * doesn't get destroyed and recreated when switching tabs.
 */
export function useYouTubePlayer(mountId) {
  const playerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mountId, {
        height: "100%",
        width: "100%",
        playerVars: { rel: 0, modestbranding: 1 },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch (e) {
        // player may not be fully initialized yet
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountId]);

  return playerRef;
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
    // player not ready yet; next poll/update will retry
  }
}
