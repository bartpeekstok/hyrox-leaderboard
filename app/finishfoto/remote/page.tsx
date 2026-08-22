"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Participant,
  formatTime,
  getClassLabel,
  getRaceClass,
} from "../../lib/types";
import { getParticipants } from "../../lib/store";
import { supabase } from "../../lib/supabase";
import { useFinishfotoChannel } from "../../lib/finishfoto-channel";

export default function FinishfotoRemotePage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [input, setInput] = useState("");

  const { status, send } = useFinishfotoChannel({
    role: "remote",
    value: input,
    onValue: setInput,
  });

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

    const channel = supabase
      .channel("finishfoto-remote")
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

  function update(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, 5);
    setInput(clean);
    send(clean);
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
      <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-200 bg-white">
        <Link
          href="/finishfoto"
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 shrink-0"
        >
          Scherm
        </Link>
        <h1 className="font-bold text-gray-900">Finishfoto</h1>
        <div className="flex-1" />
        <span className="flex items-center gap-2 text-xs font-semibold text-steel-500">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === "connected"
                ? "bg-cfa-green"
                : status === "offline"
                  ? "bg-cfa-red"
                  : "bg-cfa-yellow"
            }`}
          />
          {status === "connected"
            ? "Verbonden"
            : status === "offline"
              ? "Geen verbinding"
              : "Verbinden..."}
        </span>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4">
        <div>
          <label
            htmlFor="startnummer"
            className="block text-sm font-semibold text-steel-500 mb-2"
          >
            Startnummer
          </label>
          <input
            id="startnummer"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={input}
            onChange={(e) => update(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="000"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-5 text-gray-900 text-6xl font-bold text-center tracking-widest focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
          />
        </div>

        <button
          onClick={() => update("")}
          disabled={!input}
          className="w-full py-4 rounded-xl font-semibold text-lg bg-gray-100 text-gray-600 active:bg-steel-200 disabled:opacity-40 transition-colors"
        >
          Scherm leegmaken
        </button>

        {/* Zelfde info als op het grote scherm, zodat de coach kan controleren */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-center min-h-44">
          {participant ? (
            <>
              <p className="text-3xl font-bold text-cfa-ink leading-tight break-words">
                {participant.name}
              </p>
              {participant.partnerName && (
                <p className="text-3xl font-bold text-cfa-ink leading-tight break-words">
                  {participant.partnerName}
                </p>
              )}
              <div
                className={`mt-3 px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-sm ${badgeClasses}`}
              >
                {getClassLabel(participant)}
              </div>
              {participant.status === "finished" && participant.totalTime ? (
                <div className="cfa-stat text-cfa-blue text-5xl leading-none mt-4">
                  {formatTime(participant.totalTime)}
                </div>
              ) : (
                <p className="text-steel-500 font-semibold mt-4">
                  {participant.status === "racing"
                    ? "Nog onderweg..."
                    : "Nog niet gestart"}
                </p>
              )}
            </>
          ) : input ? (
            <p className="text-steel-400 text-lg">
              Startnummer {input} niet gevonden
            </p>
          ) : (
            <p className="text-steel-500">
              Voer een startnummer in — het verschijnt direct op het scherm.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
