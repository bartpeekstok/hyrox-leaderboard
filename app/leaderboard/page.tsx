"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
  const [autoRotate, setAutoRotate] = useState(true); // ON by default for TV
  const filtersRef = useRef<FilterKey[]>(["all"]);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    filtersRef.current = getAvailableFilters();
  }, [participants]);

  // Auto-rotate through categories (skip "all" for TV - show each category)
  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      const filters = filtersRef.current;
      if (filters.length <= 1) return;
      setFilter((current) => {
        const idx = filters.indexOf(current);
        return filters[(idx + 1) % filters.length];
      });
    }, 10000); // 10 seconds per category

    return () => clearInterval(interval);
  }, [autoRotate]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

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

  // Recent finishes across ALL categories (for ticker)
  const recentFinishes = participants
    .filter((p) => p.status === "finished" && p.finishTime)
    .sort((a, b) => (b.finishTime || 0) - (a.finishTime || 0))
    .slice(0, 5);

  const isDuo = (p: Participant) => p.category.startsWith("duo_");
  const countPeople = (list: Participant[]) =>
    list.reduce((sum, p) => sum + (isDuo(p) ? 2 : 1), 0);

  const totalFinished = countPeople(participants.filter((p) => p.status === "finished"));
  const totalRacing = countPeople(participants.filter((p) => p.status === "racing"));
  const totalParticipants = countPeople(participants);

  const availableFilters = getAvailableFilters();

  function getFilterLabel(f: FilterKey): string {
    if (f === "all") return "Alle categorieën";
    const [div, ...catParts] = f.split("_");
    const cat = catParts.join("_") as Category;
    return `${DIVISION_LABELS[div as Division]} ${CATEGORY_LABELS[cat] || cat}`;
  }

  function getMedalColor(rank: number): string {
    switch (rank) {
      case 1: return "text-yellow-400";
      case 2: return "text-gray-300";
      case 3: return "text-amber-600";
      default: return "text-gray-500";
    }
  }

  function getMedalBg(rank: number): string {
    switch (rank) {
      case 1: return "bg-yellow-400/10 border-yellow-400/30";
      case 2: return "bg-gray-300/10 border-gray-300/20";
      case 3: return "bg-amber-600/10 border-amber-600/20";
      default: return "bg-white/5 border-white/5";
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
      <header className="bg-cfa-navy/90 border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/">
            <Image
              src="/logo-hyrox.png"
              alt="CrossFit Alkmaar"
              width={160}
              height={80}
            />
          </Link>
          <div className="h-10 w-px bg-white/20" />
          <h1 className="text-3xl font-bold tracking-tight">
            HYROX <span className="text-cfa-yellow">LEADERBOARD</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-cfa-green">
              {totalRacing}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">
              onderweg
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-cfa-yellow">
              {totalFinished}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">
              gefinisht
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-white/40">
              {totalParticipants}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">
              totaal
            </div>
          </div>
        </div>
      </header>

      {/* Category title bar with dots indicator */}
      <div className="bg-cfa-navy/60 px-8 py-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-cfa-yellow uppercase tracking-wider">
          {getFilterLabel(filter)}
        </h2>
        <div className="flex items-center gap-3">
          {/* Category dots */}
          <div className="flex gap-1.5">
            {availableFilters.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setAutoRotate(false);
                }}
                className={`w-3 h-3 rounded-full transition-all ${
                  filter === f
                    ? "bg-cfa-yellow scale-125"
                    : "bg-white/20 hover:bg-white/40"
                }`}
                title={getFilterLabel(f)}
              />
            ))}
          </div>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              autoRotate
                ? "bg-cfa-green/20 text-cfa-green"
                : "bg-white/5 text-gray-500 hover:bg-white/10"
            }`}
          >
            Auto {autoRotate ? "AAN" : "UIT"}
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Leaderboard content */}
      <div className="flex-1 px-8 py-4 leaderboard-scroll overflow-y-auto">
        {/* Currently Racing */}
        {racingParticipants.length > 0 && (
          <div className="mb-5">
            <div className="text-sm text-cfa-green font-semibold uppercase tracking-wider mb-2">
              Onderweg ({racingParticipants.length})
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {racingParticipants.map((p) => (
                <div
                  key={p.id}
                  className="bg-cfa-yellow/5 border border-cfa-yellow/20 rounded-lg px-4 py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cfa-yellow font-mono font-bold text-lg">
                      #{p.startNumber}
                    </span>
                    <span className="font-medium truncate">
                      {p.name}
                      {p.partnerName && (
                        <span>
                          {" "}& {p.partnerName}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-cfa-yellow text-lg ml-2">
                    {p.startTime ? formatTime(now - p.startTime) : "--:--"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Finished Rankings */}
        <div className="space-y-1.5">
          {finishedParticipants.map((p, index) => {
            const rank = index + 1;
            return (
              <div
                key={p.id}
                className={`${getMedalBg(rank)} border rounded-xl px-6 py-4 flex items-center gap-5 animate-slide-in`}
              >
                {/* Rank */}
                <div
                  className={`w-12 text-center font-bold text-3xl ${getMedalColor(rank)}`}
                >
                  {rank}
                </div>

                {/* Number */}
                <div className="text-cfa-yellow font-mono font-bold text-2xl w-16">
                  #{p.startNumber}
                </div>

                {/* Name & Category */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-2xl truncate">
                    {p.name}
                    {p.partnerName && (
                      <span className="font-normal">
                        {" "}& {p.partnerName}
                      </span>
                    )}
                  </div>
                  {filter === "all" && (
                    <div className="text-sm text-gray-500">
                      {DIVISION_LABELS[p.division]} - {CATEGORY_LABELS[p.category]}
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-3xl ${
                      rank <= 3 ? getMedalColor(rank) : "text-white"
                    }`}
                  >
                    {p.totalTime ? formatTime(p.totalTime) : "--:--"}
                  </div>
                  {rank > 1 &&
                    finishedParticipants[0].totalTime &&
                    p.totalTime && (
                      <div className="text-sm text-gray-500 font-mono">
                        +{formatTime(p.totalTime - finishedParticipants[0].totalTime)}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {finishedParticipants.length === 0 && racingParticipants.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">&#127939;</div>
            <p className="text-2xl text-gray-500">
              Wachten op de eerste finishers...
            </p>
          </div>
        )}
      </div>

      {/* Footer: recent finishes ticker + clock */}
      <footer className="bg-cfa-navy/90 border-t border-white/10 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <span className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Laatste finishes:
          </span>
          <div className="flex gap-4 overflow-hidden">
            {recentFinishes.map((p) => (
              <span key={p.id} className="text-sm text-gray-400 whitespace-nowrap">
                <span className="text-cfa-yellow font-mono font-bold">#{p.startNumber}</span>
                {" "}{p.name}
                {" "}
                <span className="text-cfa-green font-mono">
                  {p.totalTime ? formatTime(p.totalTime) : ""}
                </span>
              </span>
            ))}
            {recentFinishes.length === 0 && (
              <span className="text-sm text-gray-600">Nog geen finishers</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4">
          <span className="text-sm text-gray-500">
            CrossFit Alkmaar - 30 mei 2026
          </span>
          <span className="font-mono text-lg text-white/60">
            {new Date().toLocaleTimeString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </footer>
    </div>
  );
}
