"use client";

// Transport-swappable event source. Two modes, ONE reducer:
//   - replay: timed fold over a canned tape (fetch JSON).
//   - live:   POST /api/cases to start a deliberation, then tail the SSE stream.
// Both feed the identical Envelope -> reduce() pipeline, so components never change
// (README "Swapping to a live backend"). State is a PURE FOLD over events[0..cursor].

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Envelope, Tape } from "./events";
import { CaseState, initialState, reduce } from "./reducer";

const BASE_DELAY_MS = 850; // inter-seq delay at 1x for replay; pacing only — never alters payloads

export type StreamSource =
  | { mode: "replay"; url: string }
  | { mode: "live"; apiBase: string; caseKey: string };

export type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export interface StreamControls {
  state: CaseState;
  playing: boolean;
  speed: number;
  cursor: number; // number of events applied
  total: number;
  title: string;
  live: boolean;
  status: StreamStatus;
  play: () => void;
  pause: () => void;
  restart: () => void;
  step: () => void;
  scrubTo: (n: number) => void;
  setSpeed: (s: number) => void;
}

function sourceKey(s: StreamSource): string {
  return s.mode === "replay" ? `replay:${s.url}` : `live:${s.apiBase}:${s.caseKey}`;
}

export function useEventStream(source: StreamSource): StreamControls {
  const [events, setEvents] = useState<Envelope[]>([]);
  const [title, setTitle] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [nonce, setNonce] = useState(0); // bump to re-run a live deliberation
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const following = useRef(true); // live: cursor auto-tracks the tail until the user intervenes

  const live = source.mode === "live";
  const key = `${sourceKey(source)}#${nonce}`;

  // Connect / load when the source (or live nonce) changes.
  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    setCursor(0);
    setTitle("");
    setPlaying(true);
    following.current = true;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    if (source.mode === "replay") {
      setStatus("streaming");
      fetch(source.url)
        .then((r) => r.json())
        .then((tape: Tape) => {
          if (cancelled) return;
          setEvents(tape.events);
          setTitle(tape.title);
          setCursor(0);
          setPlaying(true);
        })
        .catch(() => !cancelled && setStatus("error"));
    } else {
      setStatus("connecting");
      const { apiBase, caseKey } = source;
      (async () => {
        try {
          const res = await fetch(`${apiBase}/api/cases`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ case: caseKey }),
          });
          const { case_id, title: t } = await res.json();
          if (cancelled) return;
          setTitle(t ?? "");
          const seen = new Set<number>();
          const es = new EventSource(`${apiBase}/api/cases/${case_id}/stream`);
          esRef.current = es;
          setStatus("streaming");
          es.onmessage = (m) => {
            const env: Envelope = JSON.parse(m.data);
            if (seen.has(env.seq)) return; // reducer is idempotent, but skip the work
            seen.add(env.seq);
            setEvents((prev) => [...prev, env].sort((a, b) => a.seq - b.seq));
            if (env.event === "case.closed") {
              es.close();
              setStatus("done");
            }
          };
          es.onerror = () => {
            setStatus((s) => (s === "done" ? s : "error"));
            es.close();
          };
        } catch {
          if (!cancelled) setStatus("error");
        }
      })();
    }

    return () => {
      cancelled = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Pure fold — recomputed when cursor advances.
  const state = useMemo<CaseState>(
    () => events.slice(0, cursor).reduce(reduce, initialState()),
    [events, cursor]
  );

  // Live: follow the tail as events arrive (until the user pauses/scrubs).
  useEffect(() => {
    if (live && following.current) setCursor(events.length);
  }, [events, live]);

  // Replay: timer-paced advance. Disabled in live mode (events arrive in real time).
  useEffect(() => {
    if (live || !playing || events.length === 0 || cursor >= events.length) return;
    timer.current = setTimeout(
      () => setCursor((c) => Math.min(c + 1, events.length)),
      BASE_DELAY_MS / speed
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [live, playing, cursor, events, speed]);

  const play = useCallback(() => {
    setPlaying(true);
    if (live) {
      following.current = true;
      setCursor(events.length); // jump to the live tail
    }
  }, [live, events.length]);
  const pause = useCallback(() => {
    setPlaying(false);
    following.current = false;
  }, []);
  const step = useCallback(() => {
    setPlaying(false);
    following.current = false;
    setCursor((c) => Math.min(c + 1, events.length));
  }, [events.length]);
  const restart = useCallback(() => {
    following.current = false;
    if (live) {
      setNonce((n) => n + 1); // start a fresh deliberation
    } else {
      setCursor(0);
      setPlaying(true);
    }
  }, [live]);
  const scrubTo = useCallback(
    (n: number) => {
      setPlaying(false);
      following.current = false;
      setCursor(Math.max(0, Math.min(n, events.length)));
    },
    [events.length]
  );

  return {
    state,
    playing,
    speed,
    cursor,
    total: events.length,
    title,
    live,
    status,
    play,
    pause,
    restart,
    step,
    scrubTo,
    setSpeed,
  };
}
