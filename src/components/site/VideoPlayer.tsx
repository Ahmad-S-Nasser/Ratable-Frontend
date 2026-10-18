"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from "@/components/ui/Icons";

type Labels = { play: string; pause: string; mute: string; unmute: string; label: string };

/**
 * One approved video. The poster shows at once (no JavaScript needed to see it); the player loads only when the video comes into view, and the
 * streaming library is loaded only for browsers that cannot play HLS themselves, so pages stay fast. It plays muted and looped when it is on screen
 * in the feed, and the viewer can turn the sound on.
 */
export function VideoPlayer({
  playlistUrl, posterUrl, labels, autoPlayWhenVisible = false, width, height, className = "",
}: { playlistUrl: string; posterUrl: string | null; labels: Labels; autoPlayWhenVisible?: boolean; width?: number | null; height?: number | null; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Start loading when near the screen; play when mostly visible.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setArmed(true);
          if (!autoPlayWhenVisible) continue;
          if (e.isIntersecting && e.intersectionRatio > 0.6) void el.play().catch(() => undefined);
          else el.pause();
        }
      },
      { threshold: [0, 0.6], rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoPlayWhenVisible]);

  // Attach the stream once armed: natively where the browser can, otherwise through hls.js (loaded then).
  useEffect(() => {
    const el = video.current;
    if (!armed || !el) return;
    let destroy: (() => void) | undefined;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = playlistUrl;
    } else {
      void (async () => {
        const { default: Hls } = await import("hls.js");
        if (!Hls.isSupported()) return;
        const hls = new Hls({ capLevelToPlayerSize: true });
        hls.loadSource(playlistUrl);
        hls.attachMedia(el);
        destroy = () => hls.destroy();
      })();
    }
    return () => destroy?.();
  }, [armed, playlistUrl]);

  function toggle() {
    const el = video.current;
    if (!el) return;
    setArmed(true);
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  return (
    <div className={`relative overflow-hidden rounded-card bg-surface-2 ${className}`} style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}>
      <video
        ref={video}
        poster={posterUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="none"
        aria-label={labels.label}
        className="size-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
        <button type="button" onClick={toggle} aria-label={playing ? labels.pause : labels.play} className="inline-flex size-11 items-center justify-center rounded-full bg-scrim text-on-scrim">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? labels.unmute : labels.mute} aria-pressed={!muted} className="inline-flex size-11 items-center justify-center rounded-full bg-scrim text-on-scrim">
          {muted ? <VolumeOffIcon /> : <VolumeIcon />}
        </button>
      </div>
    </div>
  );
}
