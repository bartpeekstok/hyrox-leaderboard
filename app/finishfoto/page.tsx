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
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Bedieningsbalk — klein, valt weg op de foto */}
      <header className="px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors shrink-0"
        >
          Home
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

      {/* Foto-kader — alle maten in vh zodat alles altijd in beeld past */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 pb-[2vh] text-center">
        {/* Vast kader: logo, eventnaam, datum */}
        <Image
          src="/logo_dark.png"
          alt="CrossFit Alkmaar"
          width={400}
          height={200}
          priority
          className="w-auto h-[20vh] mb-[1.5vh]"
        />
        <h1 className="cfa-display text-cfa-ink text-[9vh] leading-none">
          HYROX <span className="text-cfa-blue">RACE SIMULATION</span>
        </h1>
        <p className="text-cfa-ink font-semibold text-[3vh] mt-[1vh] mb-[6vh]">
          {formatEventDate(raceDate, true)}
        </p>

        {participant ? (
          <>
            <h2 className="cfa-display text-cfa-ink text-[9vh] leading-[0.95] break-words max-w-full">
              {participant.name}
            </h2>
            {participant.partnerName && (
              <h2 className="cfa-display text-cfa-ink text-[9vh] leading-[0.95] break-words max-w-full">
                {participant.partnerName}
              </h2>
            )}

            <div
              className={`mt-[2.5vh] px-8 py-[1.2vh] rounded-lg font-bold uppercase tracking-wider text-[3vh] ${badgeClasses}`}
            >
              {getClassLabel(participant)}
            </div>

            {participant.status === "finished" && participant.totalTime ? (
              <div className="cfa-stat text-cfa-blue text-[13vh] leading-none mt-[2.5vh]">
                {formatTime(participant.totalTime)}
              </div>
            ) : (
              <p className="text-steel-500 font-semibold text-[3.5vh] mt-[3vh]">
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
          <p className="text-steel-500 text-2xl">
            Voer linksboven een startnummer in
          </p>
        )}
      </main>
    </div>
  );
}
