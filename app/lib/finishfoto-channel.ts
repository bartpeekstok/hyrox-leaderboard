"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const CHANNEL_NAME = "finishfoto-control";

export type ConnectionStatus = "connecting" | "connected" | "offline";

/**
 * Realtime broadcast tussen het castscherm (/finishfoto) en de mobiele
 * afstandsbediening (/finishfoto/remote).
 *
 * Berichten:
 * - `show`  — toon dit startnummer (afstandsbediening → scherm)
 * - `hello` — wie weet het huidige startnummer?
 * - `state` — antwoord op `hello` met het huidige startnummer
 *
 * Broadcast gaat buiten de database om, dus er is geen extra tabel of
 * realtime-publicatie voor nodig.
 */
export function useFinishfotoChannel({
  role,
  value,
  onValue,
}: {
  role: "display" | "remote";
  /** Huidig startnummer van deze pagina — wordt gedeeld bij `hello`/`state`. */
  value: string;
  /** Aangeroepen zodra de andere kant een ander startnummer doorgeeft. */
  onValue: (value: string) => void;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const valueRef = useRef(value);
  const onValueRef = useRef(onValue);

  useEffect(() => {
    valueRef.current = value;
    onValueRef.current = onValue;
  });

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);
    channelRef.current = channel;

    function broadcast(event: string, payload: Record<string, unknown> = {}) {
      channel.send({ type: "broadcast", event, payload });
    }

    function adopt(payload: unknown) {
      const raw = (payload as { value?: unknown })?.value;
      onValueRef.current(raw == null ? "" : String(raw));
    }

    // Het scherm volgt de afstandsbediening; de afstandsbediening haalt bij
    // het openen op wat er al op het scherm staat.
    if (role === "display") {
      channel.on("broadcast", { event: "show" }, ({ payload }) => adopt(payload));
    }
    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      if (role === "display" || !valueRef.current) adopt(payload);
    });
    channel.on("broadcast", { event: "hello" }, () => {
      broadcast("state", { value: valueRef.current });
    });

    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        setStatus("connected");
        // Bij (her)verbinden meteen synchroniseren: wie een nummer heeft deelt
        // het, wie niets heeft vraagt het op.
        if (role === "remote" && valueRef.current) {
          broadcast("show", { value: valueRef.current });
        } else {
          broadcast("hello");
        }
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        setStatus("offline");
      } else if (state === "CLOSED") {
        setStatus("connecting");
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [role]);

  /** Stuur een startnummer naar het castscherm. */
  const send = useCallback((next: string) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "show",
      payload: { value: next },
    });
  }, []);

  return { status, send };
}
