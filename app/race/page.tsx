"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  Heat,
  CATEGORY_LABELS,
  DIVISION_LABELS,
  formatTime,
} from "../lib/types";
import {
  getParticipants,
  getHeats,
  startHeat as startHeatDb,
  finishParticipant as finishParticipantDb,
} from "../lib/store";
import { supabase } from "../lib/supabase";

export default function RaceControlPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

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

    // Subscribe to realtime changes
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

  // Update clock every second for live timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleStartHeat(heatId: string) {
    try {
      await startHeatDb(heatId);
      fetchData();
    } catch (err) {
      console.error("Error starting heat:", err);
    }
  }

  async function handleFinish(participantId: string) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-cfa-navy border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Image
                src="/logo-hyrox.svg"
                alt="CrossFit Alkmaar"
                width={140}
                height={56}
              />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Race Control</h1>
              <p className="text-sm text-gray-400">HYROX Race Simulation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-cfa-yellow/20 text-cfa-yellow px-3 py-1 rounded-full text-sm font-bold">
              {racingHeats.length} racing
            </div>
            <div className="bg-cfa-green/20 text-cfa-green px-3 py-1 rounded-full text-sm font-bold">
              {finishedHeats.length}/{heats.length} klaar
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Next Heat to Start */}
        {nextHeat && (
          <div className="bg-cfa-navy/80 border-2 border-cfa-yellow/30 rounded-xl p-6 animate-pulse-glow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Volgende: Heat {nextHeat.heatNumber}
                </h2>
                <p className="text-cfa-yellow text-lg">
                  Gepland om {nextHeat.scheduledTime}
                </p>
              </div>
              <button
                onClick={() => handleStartHeat(nextHeat.id)}
                className="bg-cfa-yellow hover:bg-cfa-yellow-hover text-black font-bold text-xl px-10 py-4 rounded-xl transition-colors shadow-lg"
              >
                START HEAT
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {nextHeat.participantIds.map((id) => {
                const p = participants.find((pp) => pp.id === id);
                if (!p) return null;
                return (
                  <div
                    key={id}
                    className="bg-black/30 rounded-lg p-3 text-center"
                  >
                    <div className="font-bold text-lg">
                      {p.name}
                      {p.partnerName && (
                        <span className="text-gray-400">
                          {" "}
                          & {p.partnerName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {DIVISION_LABELS[p.division]} -{" "}
                      {CATEGORY_LABELS[p.category]}
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
            <h2 className="text-xl font-bold mb-4 text-cfa-yellow">
              Nu aan het racen
            </h2>
            <div className="space-y-4">
              {racingHeats.map((heat) => (
                <div
                  key={heat.id}
                  className="bg-cfa-navy/60 border border-cfa-yellow/20 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">
                      Heat {heat.heatNumber}{" "}
                      <span className="text-gray-400 text-sm">
                        gestart om{" "}
                        {heat.startTime
                          ? new Date(heat.startTime).toLocaleTimeString(
                              "nl-NL",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "?"}
                      </span>
                    </h3>
                    {heat.startTime && (
                      <span className="text-cfa-yellow font-mono text-lg">
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
                              : "bg-black/30 border border-white/10"
                          }`}
                        >
                          <div className="font-bold text-center">
                            {p.name}
                            {p.partnerName && (
                              <span className="text-gray-400">
                                {" "}
                                & {p.partnerName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {DIVISION_LABELS[p.division]} -{" "}
                            {CATEGORY_LABELS[p.category]}
                          </div>
                          {isFinished ? (
                            <div className="text-cfa-green font-mono font-bold text-lg">
                              {p.totalTime
                                ? formatTime(p.totalTime)
                                : "FINISHED"}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleFinish(p.id)}
                              className="bg-cfa-green hover:bg-emerald-500 text-black font-bold px-6 py-3 rounded-lg transition-colors text-lg w-full"
                            >
                              FINISH
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
            <h2 className="text-xl font-bold mb-4 text-gray-400">
              Wachtrij ({scheduledHeats.length - 1} heats)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {scheduledHeats.slice(1, 10).map((heat) => (
                <div
                  key={heat.id}
                  className="bg-cfa-navy/40 border border-white/5 rounded-lg p-3"
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
                      <div key={id} className="text-sm text-gray-400">
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

        {/* No heats */}
        {heats.length === 0 && (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500 mb-4">Geen heats gevonden</p>
            <Link href="/admin" className="text-cfa-yellow hover:underline">
              Ga naar Admin om heats te genereren
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
