"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Participant,
  Category,
  Division,
  CATEGORY_LABELS,
  DIVISION_LABELS,
  formatTime,
} from "../lib/types";
import { getParticipants } from "../lib/store";
import { supabase } from "../lib/supabase";

type FilterKey = "all" | `${Division}_${Category}`;

export default function LeaderboardPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [autoRotate, setAutoRotate] = useState(false);
  const filtersRef = useRef<FilterKey[]>(["all"]);

  const fetchData = useCallback(async () => {
    try {
      const p = await getParticipants();
      setParticipants(p);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes for instant leaderboard updates
    const channel = supabase
      .channel("leaderboard")
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Update available filters ref
  useEffect(() => {
    filtersRef.current = getAvailableFilters();
  }, [participants]);

  // Auto-rotate through categories
  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      const filters = filtersRef.current;
      if (filters.length <= 1) return;
      setFilter((current) => {
        const idx = filters.indexOf(current);
        return filters[(idx + 1) % filters.length];
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [autoRotate]);

  function getAvailableFilters(): FilterKey[] {
    const filters: FilterKey[] = ["all"];
    const seen = new Set<string>();
    for (const p of participants) {
      const key = `${p.division}_${p.category}` as FilterKey;
      if (!seen.has(key)) {
        seen.add(key);
        filters.push(key);
      }
    }
    return filters;
  }

  const finishedParticipants = participants
    .filter((p) => p.status === "finished" && p.totalTime)
    .filter((p) => {
      if (filter === "all") return true;
      const [div, ...catParts] = filter.split("_");
      const cat = catParts.join("_");
      return p.division === div && p.category === cat;
    })
    .sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));

  const racingParticipants = participants
    .filter((p) => p.status === "racing")
    .filter((p) => {
      if (filter === "all") return true;
      const [div, ...catParts] = filter.split("_");
      const cat = catParts.join("_");
      return p.division === div && p.category === cat;
    });

  const availableFilters = getAvailableFilters();

  function getFilterLabel(f: FilterKey): string {
    if (f === "all") return "Alle";
    const [div, ...catParts] = f.split("_");
    const cat = catParts.join("_") as Category;
    return `${DIVISION_LABELS[div as Division]} ${CATEGORY_LABELS[cat] || cat}`;
  }

  function getMedalColor(rank: number): string {
    switch (rank) {
      case 1:
        return "text-yellow-400";
      case 2:
        return "text-gray-300";
      case 3:
        return "text-amber-600";
      default:
        return "text-gray-500";
    }
  }

  function getMedalBg(rank: number): string {
    switch (rank) {
      case 1:
        return "bg-yellow-400/10 border-yellow-400/30";
      case 2:
        return "bg-gray-300/10 border-gray-300/20";
      case 3:
        return "bg-amber-600/10 border-amber-600/20";
      default:
        return "bg-white/5 border-white/5";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-cfa-navy/90 border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/logo-hyrox.png"
            alt="CrossFit Alkmaar"
            width={140}
            height={70}
          />
          <div className="h-8 w-px bg-white/20" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              HYROX <span className="text-cfa-yellow">LEADERBOARD</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-cfa-yellow">
              {finishedParticipants.length}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">
              gefinisht
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-cfa-green">
              {racingParticipants.length}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">
              racing
            </div>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="bg-cfa-navy/50 px-6 py-2 flex items-center gap-2 overflow-x-auto">
        {availableFilters.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setAutoRotate(false);
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-cfa-yellow text-black"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {getFilterLabel(f)}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            autoRotate
              ? "bg-cfa-green/20 text-cfa-green"
              : "bg-white/5 text-gray-500 hover:bg-white/10"
          }`}
        >
          Auto-rotatie {autoRotate ? "AAN" : "UIT"}
        </button>
      </div>

      {/* Current filter label */}
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-lg font-bold text-cfa-yellow uppercase tracking-wider">
          {getFilterLabel(filter)}
        </h2>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 px-6 pb-6 leaderboard-scroll overflow-y-auto">
        {/* Currently Racing */}
        {racingParticipants.length > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {racingParticipants.map((p) => (
                <div
                  key={p.id}
                  className="bg-cfa-yellow/5 border border-cfa-yellow/20 rounded-lg px-4 py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cfa-yellow font-mono font-bold">
                      #{p.startNumber}
                    </span>
                    <span className="font-medium">
                      {p.name}
                      {p.partnerName && (
                        <span className="text-gray-400">
                          {" "}
                          & {p.partnerName}
                        </span>
                      )}
                    </span>
                    {filter === "all" && (
                      <span className="text-xs text-gray-500">
                        {DIVISION_LABELS[p.division]}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-cfa-yellow text-sm">
                    {p.startTime ? formatTime(now - p.startTime) : "--:--"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Finished Rankings */}
        <div className="space-y-1">
          {finishedParticipants.map((p, index) => {
            const rank = index + 1;
            return (
              <div
                key={p.id}
                className={`${getMedalBg(rank)} border rounded-lg px-4 py-3 flex items-center gap-4 animate-slide-in`}
              >
                {/* Rank */}
                <div
                  className={`w-10 text-center font-bold text-xl ${getMedalColor(rank)}`}
                >
                  {rank}
                </div>

                {/* Number & Name */}
                <div className="text-cfa-yellow font-mono font-bold text-lg w-12">
                  #{p.startNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg truncate">
                    {p.name}
                    {p.partnerName && (
                      <span className="text-gray-400 font-normal">
                        {" "}
                        & {p.partnerName}
                      </span>
                    )}
                  </div>
                  {filter === "all" && (
                    <div className="text-xs text-gray-500">
                      {DIVISION_LABELS[p.division]} -{" "}
                      {CATEGORY_LABELS[p.category]}
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-2xl ${
                      rank <= 3 ? getMedalColor(rank) : "text-white"
                    }`}
                  >
                    {p.totalTime ? formatTime(p.totalTime) : "--:--"}
                  </div>
                  {rank > 1 &&
                    finishedParticipants[0].totalTime &&
                    p.totalTime && (
                      <div className="text-xs text-gray-500 font-mono">
                        +
                        {formatTime(
                          p.totalTime - finishedParticipants[0].totalTime
                        )}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {finishedParticipants.length === 0 &&
          racingParticipants.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">&#127939;</div>
              <p className="text-xl text-gray-500">
                Wachten op de eerste finishers...
              </p>
            </div>
          )}
      </div>

      {/* Footer ticker */}
      <footer className="bg-cfa-navy/90 border-t border-white/10 px-6 py-2 flex items-center justify-between text-sm text-gray-500">
        <span>
          HYROX Race Simulation - CrossFit Alkmaar - 30 mei 2026
        </span>
        <span className="font-mono">
          {new Date().toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </footer>
    </div>
  );
}
