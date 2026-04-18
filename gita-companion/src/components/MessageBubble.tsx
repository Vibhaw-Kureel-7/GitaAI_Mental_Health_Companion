import { useState, useEffect, useRef } from "react";
import type { Message } from "@/types";
import { findLlmMeta } from "@/types";
import { RoutingPanel } from "./RoutingPanel";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  message: Message;
}

// ─────────────────────────────────────────────────────────────
//  SVG icons — explicit fill colors, not currentColor
//  (currentColor can resolve to wrong value inside Tauri WebView)
// ─────────────────────────────────────────────────────────────

const INK   = "#0D0D0B";   // var(--ink)
const PARCH = "#F4EDD8";   // var(--parchment)
const FIRE  = "#C85A0A";   // var(--fire)

function PlayIcon({ color }: { color: string }) {
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 11 13"
      aria-hidden
      style={{ display: "block" }}
    >
      <polygon points="0,0 11,6.5 0,13" fill={color} />
    </svg>
  );
}

function PauseIcon({ color }: { color: string }) {
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 11 13"
      aria-hidden
      style={{ display: "block" }}
    >
      <rect x="0" y="0" width="3.5" height="13" fill={color} />
      <rect x="7.5" y="0" width="3.5" height="13" fill={color} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  AudioPlayer
// ─────────────────────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate   = () => setCurrentTime(audio.currentTime);
    const onMeta         = () => {
      if (isFinite(audio.duration) && audio.duration > 0)
        setDuration(audio.duration);
    };
    const onEnded        = () => {
      setPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
    const tryPlay        = () => {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    };

    audio.addEventListener("timeupdate",      onTimeUpdate);
    audio.addEventListener("durationchange",  onMeta);
    audio.addEventListener("loadedmetadata",  onMeta);
    audio.addEventListener("ended",           onEnded);
    audio.addEventListener("canplay",         tryPlay);
    if (audio.readyState >= 3) tryPlay();

    return () => {
      audio.removeEventListener("timeupdate",      onTimeUpdate);
      audio.removeEventListener("durationchange",  onMeta);
      audio.removeEventListener("loadedmetadata",  onMeta);
      audio.removeEventListener("ended",           onEnded);
      audio.removeEventListener("canplay",         tryPlay);
    };
  }, [src]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  }

  function fmt(s: number): string {
    if (!isFinite(s) || isNaN(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  // Button background and icon color flip when playing
  const btnBg    = playing ? FIRE  : PARCH;
  const iconColor = playing ? PARCH : INK;

  return (
    <div
      style={{
        marginTop: 14,
        border: `2px solid ${INK}`,
        background: PARCH,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: `2px 2px 0 ${INK}`,
      }}
    >
      <audio ref={audioRef} src={src} preload="auto" />

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        style={{
          width: 32,
          height: 32,
          border: `2px solid ${INK}`,
          background: btnBg,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: `1px 1px 0 ${INK}`,
          padding: 0,
          // Optical center: play triangle needs a hair nudge right
          paddingLeft: playing ? 0 : "2px",
        }}
      >
        {playing
          ? <PauseIcon color={iconColor} />
          : <PlayIcon  color={iconColor} />}
      </button>

      {/* Progress track */}
      <div
        onClick={seek}
        role="slider"
        aria-label="Seek audio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        style={{
          flex: 1,
          height: 6,
          background: "rgba(0,0,0,0.12)",
          cursor: "pointer",
          position: "relative",
          border: "1px solid rgba(0,0,0,0.18)",
        }}
      >
        {/* Orange fill */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            background: FIRE,
            transition: "width 0.1s linear",
            pointerEvents: "none",
          }}
        />
        {/* Square playhead */}
        {duration > 0 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${pct}%`,
              transform: "translate(-50%, -50%)",
              width: 10,
              height: 10,
              background: FIRE,
              border: `1.5px solid ${INK}`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Time display */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: INK,
          flexShrink: 0,
          minWidth: 76,
          textAlign: "right",
          opacity: 0.8,
        }}
      >
        {fmt(currentTime)} / {fmt(duration)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MessageBubble
// ─────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const meta   = message.routing ? findLlmMeta(message.routing.selectedKey) : null;

  return (
    <div className="message-group">

      {/* Role / meta row */}
      <div className="message-meta-row">
        <span className={`message-role-tag${isUser ? "" : " assistant"}`}>
          {isUser ? "You" : "Gita AI"}
        </span>

        {!isUser && meta && (
          <>
            <span style={{ color: "var(--smoke)", fontSize: 10, fontFamily: "var(--font-mono)" }}>
              &mdash;
            </span>
            <span className="message-tradition" style={{ color: meta.color, fontSize: 10 }}>
              {meta.tradition}
            </span>
          </>
        )}

        <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
      </div>

      {/* Card */}
      <div
        className={[
          "message-card",
          isUser ? "user" : "assistant",
          message.status === "error" ? "error" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* Loading states */}
        {!isUser && message.status === "pending" && (
          <div className="message-loader">
            <div className="dots"><span /><span /><span /></div>
            <span className="message-loader-text">Thinking...</span>
          </div>
        )}

        {!isUser && message.status === "routing" && (
          <div className="message-loader">
            <div className="dots"><span /><span /><span /></div>
            <span className="message-loader-text">Finding the right wisdom...</span>
          </div>
        )}

        {!isUser && message.status === "generating" && (
          <div className="message-loader">
            <div className="dots"><span /><span /><span /></div>
            <span className="message-loader-text">
              {meta ? `Drawing from ${meta.fullName}...` : "Writing response..."}
            </span>
          </div>
        )}

        {/* Error */}
        {message.status === "error" && (
          <p className="error-msg">{message.errorText ?? "An error occurred."}</p>
        )}

        {/* Response text */}
        {message.content && (
          <p className="message-text">{message.content}</p>
        )}

        {/* Voice: preparing */}
        {!isUser && message.audioSynthesizing && (
          <div style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 14px",
            border: "1px dashed rgba(0,0,0,0.22)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "rgba(0,0,0,0.45)",
          }}>
            <div className="dots" style={{ display: "inline-flex" }}>
              <span /><span /><span />
            </div>
            <span>Preparing loved one's voice…</span>
          </div>
        )}

        {/* Custom audio player */}
        {!isUser && message.audioUrl && !message.audioSynthesizing && (
          <AudioPlayer src={convertFileSrc(message.audioUrl)} />
        )}
      </div>

      {/* Routing panel */}
      {!isUser && message.status === "done" && message.routing && (
        <RoutingPanel routing={message.routing} />
      )}

    </div>
  );
}