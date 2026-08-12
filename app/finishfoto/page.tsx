"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  formatTime,
  formatEventDate,
  getClassLabel,
  getRaceClass,
} from "../lib/types";
import { getParticipants, getSettings } from "../lib/store";
import { supabase } from "../lib/supabase";

export default function FinishfotoPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [raceDate, setRaceDate] = useState("2026-05-30");
  const [input, setInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const p = await getParticipants();
      setParticipants(p);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    getSettings()
      .then((s) => setRaceDate(s.raceDate))
      .catch(() => {});

    const channel = supabase
      .channel("finishfoto")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hyrox_participants" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  const participant = input
    ? participants.find((p) => p.startNumber === parseInt(input))
    : null;

  const badgeClasses = participant
    ? getRaceClass(participant.division, participant.category).startsWith("doubles_")
      ? "bg-cfa-yellow text-cfa-ink"
      : getRaceClass(participant.division, participant.category).endsWith("_pro")
        ? "bg-cfa-blue text-white"
        : "bg-cfa-green text-white"
    : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Bedieningsbalk — klein, valt weg op de foto */}
      <header className="px-4 py-3 flex items-center gap-3">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo_dark.png"
            alt="CrossFit Alkmaar"
            width={80}
            height={40}
            className="h-auto w-16"
          />
        </Link>
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Startnummer"
          className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-lg font-bold text-center focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {input && (
          <button
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors"
          >
            Wissen
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={toggleFullscreen}
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors"
        >
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </header>

      {/* Foto-kader */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 pb-16 text-center">
        {participant ? (
          <>
            <p className="cfa-eyebrow !text-[clamp(14px,1.6vw,26px)] mb-2">
              HYROX Race Simulation &mdash; CrossFit Alkmaar
            </p>
            <p className="text-steel-500 font-semibold text-[clamp(14px,1.4vw,24px)] mb-8">
              {formatEventDate(raceDate, true)}
            </p>

            <div className="cfa-stat text-cfa-blue/60 text-[clamp(20px,2.5vw,44px)] mb-4">
              #{participant.startNumber}
            </div>

            <h1 className="cfa-display text-cfa-ink text-[clamp(40px,7.5vw,140px)] leading-[0.95] break-words max-w-full">
              {participant.name}
            </h1>
            {participant.partnerName && (
              <h1 className="cfa-display text-cfa-ink text-[clamp(40px,7.5vw,140px)] leading-[0.95] break-words max-w-full">
                {participant.partnerName}
              </h1>
            )}

            <div
              className={`mt-8 px-8 py-3 rounded-lg font-bold uppercase tracking-wider text-[clamp(18px,2.2vw,40px)] ${badgeClasses}`}
            >
              {getClassLabel(participant)}
            </div>

            {participant.status === "finished" && participant.totalTime ? (
              <div className="cfa-stat text-cfa-blue text-[clamp(70px,13vw,240px)] leading-none mt-8">
                {formatTime(participant.totalTime)}
              </div>
            ) : (
              <p className="text-steel-500 font-semibold text-[clamp(20px,2.5vw,44px)] mt-10">
                {participant.status === "racing"
                  ? "Nog onderweg..."
                  : "Nog niet gestart"}
              </p>
            )}
          </>
        ) : input ? (
          <p className="text-steel-400 text-3xl">
            Startnummer {input} niet gevonden
          </p>
        ) : (
          <div>
            <p className="cfa-display text-steel-300 text-6xl mb-4">Finishfoto</p>
            <p className="text-steel-500 text-2xl">
              Voer linksboven een startnummer in
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
