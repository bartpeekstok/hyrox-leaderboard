"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  Heat,
  getClassLabel,
  formatTime,
} from "../lib/types";
import {
  getParticipants,
  getHeats,
  startHeat as startHeatDb,
  finishParticipant as finishParticipantDb,
} from "../lib/store";
import { supabase } from "../lib/supabase";
import { getSledBlock, SledBlock, SLED_BLOCK_WEIGHTS } from "../lib/heat-scheduler";

const BLOCK_STYLES: Record<SledBlock, { badge: string; label: string }> = {
  1: { badge: "bg-red-500/15 text-red-700 border border-red-500/30", label: "Blok 1" },
  2: { badge: "bg-cfa-yellow/15 text-amber-700 border border-cfa-yellow/30", label: "Blok 2" },
  3: { badge: "bg-cfa-green/15 text-emerald-700 border border-cfa-green/30", label: "Blok 3" },
};

function getHeatBlock(heat: Heat, participants: Participant[]): SledBlock | null {
  const firstId = heat.participantIds[0];
  if (!firstId) return null;
  const p = participants.find((pp) => pp.id === firstId);
  if (!p) return null;
  return getSledBlock(p.division, p.category);
}

type Wissel = {
  id: string;
  fromBlock: SledBlock;
  toBlock: SledBlock;
  lastHeatNumber: number;
  firstNextHeatNumber: number;
  firstNextHeatTime: string;
};

function getActiveWissels(
  heats: Heat[],
  participants: Participant[]
): Wissel[] {
  const sorted = [...heats].sort((a, b) => a.heatNumber - b.heatNumber);
  const wissels: Wissel[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentBlock = getHeatBlock(current, participants);
    const nextBlock = getHeatBlock(next, participants);

    if (
      currentBlock !== null &&
      nextBlock !== null &&
      currentBlock !== nextBlock &&
      (current.status === "racing" || current.status === "finished")
    ) {
      // Verify this is the LAST heat of currentBlock (no later heats in same block)
      const hasLaterInSameBlock = sorted
        .slice(i + 1)
        .some((h) => getHeatBlock(h, participants) === currentBlock);
      if (hasLaterInSameBlock) continue;

      wissels.push({
        id: `wissel_${currentBlock}_to_${nextBlock}`,
        fromBlock: currentBlock,
        toBlock: nextBlock,
        lastHeatNumber: current.heatNumber,
        firstNextHeatNumber: next.heatNumber,
        firstNextHeatTime: next.scheduledTime,
      });
    }
  }

  return wissels;
}

export default function RaceControlPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Finish input
  const [finishInput, setFinishInput] = useState("");
  const [finishFeedback, setFinishFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const finishInputRef = useRef<HTMLInputElement>(null);

  // Start heat confirmation state
  const [confirmingStartId, setConfirmingStartId] = useState<string | null>(
    null
  );
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dismissed wissels (persisted in localStorage)
  const [dismissedWissels, setDismissedWissels] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dismissedWissels");
      if (raw) setDismissedWissels(new Set(JSON.parse(raw)));
    } catch {
      // ignore
    }
  }, []);

  function dismissWissel(id: string) {
    setDismissedWissels((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("dismissedWissels", JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const fetchData = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([getParticipants(), getHeats()]);
      setParticipants(p);
      setHeats(h);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("race-control")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hyrox_participants" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hyrox_heats" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-focus finish input
  useEffect(() => {
    finishInputRef.current?.focus();
  }, []);

  async function handleStartHeat(heatId: string) {
    if (confirmingStartId !== heatId) {
      setConfirmingStartId(heatId);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmingStartId(null);
      }, 5000);
      return;
    }

    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingStartId(null);
    try {
      await startHeatDb(heatId);
      fetchData();
    } catch (err) {
      console.error("Error starting heat:", err);
    }
  }

  async function handleFinishByNumber(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(finishInput);
    if (isNaN(num)) {
      setFinishFeedback({ message: "Voer een geldig nummer in", type: "error" });
      return;
    }

    const participant = participants.find((p) => p.startNumber === num);
    if (!participant) {
      setFinishFeedback({
        message: `Nummer ${num} niet gevonden`,
        type: "error",
      });
      setFinishInput("");
      return;
    }

    if (participant.status === "finished") {
      setFinishFeedback({
        message: `#${num} ${participant.name} is al gefinisht`,
        type: "error",
      });
      setFinishInput("");
      return;
    }

    if (participant.status !== "racing") {
      setFinishFeedback({
        message: `#${num} ${participant.name} is nog niet gestart`,
        type: "error",
      });
      setFinishInput("");
      return;
    }

    try {
      await finishParticipantDb(participant.id);
      const elapsed = participant.startTime
        ? formatTime(Date.now() - participant.startTime)
        : "";
      setFinishFeedback({
        message: `#${num} ${participant.name} gefinisht! ${elapsed}`,
        type: "success",
      });
      setFinishInput("");
      fetchData();
    } catch (err) {
      setFinishFeedback({
        message: `Fout bij finishen: ${err instanceof Error ? err.message : "onbekend"}`,
        type: "error",
      });
    }

    // Auto-clear feedback after 5 seconds
    setTimeout(() => setFinishFeedback(null), 5000);
  }

  async function handleFinishClick(participantId: string) {
    try {
      await finishParticipantDb(participantId);
      fetchData();
    } catch (err) {
      console.error("Error finishing participant:", err);
    }
  }

  const scheduledHeats = heats.filter((h) => h.status === "scheduled");
  const racingHeats = heats.filter((h) => h.status === "racing");
  const finishedHeats = heats.filter((h) => h.status === "finished");
  const nextHeat = scheduledHeats[0];

  const activeWissels = getActiveWissels(heats, participants).filter(
    (w) => !dismissedWissels.has(w.id)
  );

  // Preview: show who the finish input would match
  const finishPreview = finishInput
    ? participants.find((p) => p.startNumber === parseInt(finishInput))
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="shrink-0">
              <Image
                src="/logo_dark.png"
                alt="CrossFit Alkmaar"
                width={120}
                height={60}
              />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Race Control</h1>
              <p className="text-sm text-gray-600">HYROX Race Simulation</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-cfa-blue/20 text-cfa-blue px-3 py-1 rounded-full text-sm font-bold">
              {racingHeats.length} racing
            </div>
            <div className="bg-cfa-green/20 text-cfa-green px-3 py-1 rounded-full text-sm font-bold">
              {finishedHeats.length}/{heats.length} klaar
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* FINISH INPUT - Always visible at top */}
        <div className="bg-white/80 border-2 border-cfa-green/30 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-3 text-cfa-green">
            Finish registreren
          </h2>
          <form onSubmit={handleFinishByNumber} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative order-2 sm:order-2">
              <input
                ref={finishInputRef}
                type="number"
                value={finishInput}
                onChange={(e) => setFinishInput(e.target.value)}
                className="w-full bg-white border-2 border-cfa-green/40 rounded-xl px-6 py-4 text-gray-900 text-3xl font-mono text-center focus:border-cfa-green focus:ring-2 focus:ring-cfa-green/20 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Startnummer"
                autoFocus
              />
              {finishPreview && (
                <div className="absolute -bottom-7 left-0 right-0 text-center">
                  <span
                    className={`text-sm ${
                      finishPreview.status === "racing"
                        ? "text-cfa-green"
                        : finishPreview.status === "finished"
                          ? "text-gray-500"
                          : "text-cfa-blue"
                    }`}
                  >
                    {finishPreview.name}
                    {finishPreview.partnerName &&
                      ` & ${finishPreview.partnerName}`}{" "}
                    — {finishPreview.status === "racing" ? "AAN HET RACEN" : finishPreview.status === "finished" ? "AL GEFINISHT" : "NOG NIET GESTART"}
                  </span>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="bg-cfa-green hover:bg-cfa-green/85 text-white font-bold text-xl px-10 py-4 rounded-xl transition-colors order-1 sm:order-1"
            >
              FINISH
            </button>
          </form>
          {finishFeedback && (
            <div
              className={`mt-4 text-center text-lg font-bold py-2 rounded-lg ${
                finishFeedback.type === "success"
                  ? "bg-cfa-green/20 text-cfa-green"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {finishFeedback.message}
            </div>
          )}
        </div>

        {/* Active sled wissels */}
        {activeWissels.map((w) => (
          <div
            key={w.id}
            className="bg-amber-50 border-2 border-cfa-yellow rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🔧</div>
                <div>
                  <h2 className="text-xl font-bold text-amber-900">
                    Sled wissel
                  </h2>
                  <p className="text-2xl font-mono font-bold text-amber-800 mt-1">
                    {SLED_BLOCK_WEIGHTS[w.fromBlock].label}
                    <span className="mx-3 text-amber-600">→</span>
                    {SLED_BLOCK_WEIGHTS[w.toBlock].label}
                  </p>
                  <p className="text-sm text-amber-700 mt-2">
                    Wisselen zodra deelnemers heat {w.lastHeatNumber} voorbij
                    de sleds zijn. Eerstvolgende blok-{w.toBlock} heat: heat{" "}
                    {w.firstNextHeatNumber} om {w.firstNextHeatTime}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismissWissel(w.id)}
                className="bg-cfa-green hover:bg-cfa-green/85 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow"
              >
                Wissel voltooid
              </button>
            </div>
          </div>
        ))}

        {/* Next Heat to Start */}
        {nextHeat && (
          <div className="bg-white/80 border-2 border-cfa-yellow/30 rounded-xl p-6 animate-pulse-glow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold">
                    Volgende: Heat {nextHeat.heatNumber}
                  </h2>
                  {(() => {
                    const block = getHeatBlock(nextHeat, participants);
                    if (!block) return null;
                    return (
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${BLOCK_STYLES[block].badge}`}
                      >
                        {BLOCK_STYLES[block].label} · {SLED_BLOCK_WEIGHTS[block].label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-cfa-blue text-lg">
                  Gepland om {nextHeat.scheduledTime}
                </p>
              </div>
              <button
                onClick={() => handleStartHeat(nextHeat.id)}
                className={`font-bold text-xl px-10 py-4 rounded-xl transition-colors shadow-lg ${
                  confirmingStartId === nextHeat.id
                    ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                    : "bg-cfa-blue hover:bg-cfa-blue-hover text-white"
                }`}
              >
                {confirmingStartId === nextHeat.id
                  ? "KLIK NOGMAALS OM TE STARTEN"
                  : "START HEAT"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {nextHeat.participantIds.map((id) => {
                const p = participants.find((pp) => pp.id === id);
                if (!p) return null;
                return (
                  <div
                    key={id}
                    className="bg-surface-muted border border-border rounded-lg p-3 text-center"
                  >
                    <div className="text-cfa-blue font-mono font-bold text-2xl mb-1">
                      #{p.startNumber}
                    </div>
                    <div className="font-bold">
                      {p.name}
                      {p.partnerName && (
                        <span>
                          {" "}
                          & {p.partnerName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {getClassLabel(p)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Currently Racing */}
        {racingHeats.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-cfa-blue">
              Nu aan het racen
            </h2>
            <div className="space-y-4">
              {racingHeats.map((heat) => (
                <div
                  key={heat.id}
                  className="bg-white border border-gray-200 shadow-sm border border-cfa-yellow/20 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2 flex-wrap">
                      <span>Heat {heat.heatNumber}</span>
                      {(() => {
                        const block = getHeatBlock(heat, participants);
                        if (!block) return null;
                        return (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${BLOCK_STYLES[block].badge}`}
                          >
                            {BLOCK_STYLES[block].label}
                          </span>
                        );
                      })()}
                      <span className="text-gray-600 text-sm font-normal">
                        gestart om{" "}
                        {heat.startTime
                          ? new Date(heat.startTime).toLocaleTimeString(
                              "nl-NL",
                              { hour: "2-digit", minute: "2-digit" }
                            )
                          : "?"}
                      </span>
                    </h3>
                    {heat.startTime && (
                      <span className="text-cfa-blue font-mono text-lg">
                        {formatTime(now - heat.startTime)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {heat.participantIds.map((id) => {
                      const p = participants.find((pp) => pp.id === id);
                      if (!p) return null;
                      const isFinished = p.status === "finished";
                      return (
                        <div
                          key={id}
                          className={`rounded-lg p-4 flex flex-col items-center gap-2 ${
                            isFinished
                              ? "bg-cfa-green/10 border border-cfa-green/30"
                              : "bg-white border border-gray-300"
                          }`}
                        >
                          <div className="text-cfa-blue font-mono font-bold text-xl">
                            #{p.startNumber}
                          </div>
                          <div className="font-bold text-center">
                            {p.name}
                            {p.partnerName && (
                              <span>
                                {" "}
                                & {p.partnerName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">
                            {getClassLabel(p)}
                          </div>
                          {isFinished ? (
                            <div className="text-cfa-green font-mono font-bold text-lg">
                              {p.totalTime
                                ? formatTime(p.totalTime)
                                : "FINISHED"}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleFinishClick(p.id)}
                              className="bg-cfa-green hover:bg-cfa-green/85 text-white font-bold px-6 py-2 rounded-lg transition-colors w-full"
                            >
                              FINISH #{p.startNumber}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Heats */}
        {scheduledHeats.length > 1 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-gray-600">
              Wachtrij ({scheduledHeats.length - 1} heats)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {scheduledHeats.slice(1, 10).map((heat) => (
                <div
                  key={heat.id}
                  className="bg-surface border border-border rounded-lg p-3"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">
                      Heat {heat.heatNumber}
                    </span>
                    <span className="text-xs text-gray-500">
                      {heat.scheduledTime}
                    </span>
                  </div>
                  {heat.participantIds.map((id) => {
                    const p = participants.find((pp) => pp.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="text-sm text-gray-600">
                        <span className="text-cfa-blue font-mono">
                          #{p.startNumber}
                        </span>{" "}
                        {p.name}
                        {p.partnerName && ` & ${p.partnerName}`}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {scheduledHeats.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">
                ...en nog {scheduledHeats.length - 10} heats
              </p>
            )}
          </div>
        )}

        {heats.length === 0 && (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500 mb-4">Geen heats gevonden</p>
            <Link href="/admin" className="text-cfa-blue hover:underline">
              Ga naar Admin om heats te genereren
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
