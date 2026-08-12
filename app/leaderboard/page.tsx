"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  Category,
  Division,
  getClassLabel,
  getRaceClass,
  formatTime,
  formatEventDate,
} from "../lib/types";
import { getParticipants, getSettings } from "../lib/store";
import { supabase } from "../lib/supabase";

type FilterKey = "all" | `${Division}_${Category}`;
type View = "ranking" | "feed";

const PUBLIC_ONLY = process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true";

export default function LeaderboardPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<View>("ranking");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [autoRotate, setAutoRotate] = useState(!PUBLIC_ONLY);
  const filtersRef = useRef<FilterKey[]>(["all"]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [raceDate, setRaceDate] = useState("2026-05-30");

  useEffect(() => {
    getSettings()
      .then((s) => setRaceDate(s.raceDate))
      .catch(() => {});
  }, []);

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
    if (!autoRotate || view !== "ranking") return;

    const interval = setInterval(() => {
      const filters = filtersRef.current;
      if (filters.length <= 1) return;
      setFilter((current) => {
        const idx = filters.indexOf(current);
        return filters[(idx + 1) % filters.length];
      });
    }, 10000); // 10 seconds per category

    return () => clearInterval(interval);
  }, [autoRotate, view]);

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
    if (f === "all") return "Alle";
    const [div, ...catParts] = f.split("_");
    const cat = catParts.join("_") as Category;
    return getClassLabel({ division: div as Division, category: cat });
  }

  function getMedalColor(rank: number): string {
    switch (rank) {
      case 1: return "text-yellow-500";
      case 2: return "text-gray-500";
      case 3: return "text-amber-700";
      default: return "text-gray-400";
    }
  }

  function getMedalBg(rank: number): string {
    switch (rank) {
      case 1: return "bg-yellow-50 border-yellow-300";
      case 2: return "bg-gray-50 border-gray-300";
      case 3: return "bg-amber-50 border-amber-300";
      default: return "bg-white border-gray-200";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-cfa-ink overflow-hidden lg:py-[4vh] lg:px-[3vw]">
    <div className="h-full w-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-3 sm:px-8 lg:px-12 py-3 sm:py-4 lg:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo_dark.png"
              alt="CrossFit Alkmaar"
              width={160}
              height={80}
              className="w-20 sm:w-[160px] h-auto"
            />
          </Link>
          <div className="hidden sm:block h-10 w-px bg-gray-300" />
          <div className="min-w-0">
            <h1 className="cfa-display text-xl sm:text-4xl text-cfa-ink truncate">
              HYROX <span className="text-cfa-blue">LEADERBOARD</span>
            </h1>
            <p className="text-xs text-steel-500 truncate leading-tight">
              CrossFit Alkmaar
            </p>
            <p className="text-xs text-steel-500 truncate leading-tight">
              {formatEventDate(raceDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-around sm:justify-end gap-3 sm:gap-6 sm:shrink-0">
          <div className="text-center">
            <div className="cfa-stat text-2xl sm:text-4xl text-cfa-green leading-none">
              {totalRacing}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
              onderweg
            </div>
          </div>
          <div className="text-center">
            <div className="cfa-stat text-2xl sm:text-4xl text-cfa-blue leading-none">
              {totalFinished}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
              gefinisht
            </div>
          </div>
          <div className="text-center">
            <div className="cfa-stat text-2xl sm:text-4xl text-steel-400 leading-none">
              {totalParticipants}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
              totaal
            </div>
          </div>
        </div>
      </header>

      {/* View title bar with controls */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-8 py-2 sm:py-3 flex items-center justify-between gap-2 flex-shrink-0">
        <h2 className="text-base sm:text-2xl font-bold text-cfa-blue uppercase tracking-wider truncate">
          {view === "feed" ? "Laatste finishers" : "Klassement"}
        </h2>
        <div className="flex items-center gap-3">
          {/* View toggle (admin only) */}
          {!PUBLIC_ONLY && (
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setView("ranking")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  view === "ranking"
                    ? "bg-cfa-blue text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Klassement
              </button>
              <button
                onClick={() => setView("feed")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  view === "feed"
                    ? "bg-cfa-blue text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Laatste finishers
              </button>
            </div>
          )}

          {!PUBLIC_ONLY && view === "ranking" && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                autoRotate
                  ? "bg-cfa-green/15 text-cfa-green"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Auto {autoRotate ? "AAN" : "UIT"}
            </button>
          )}
          {!PUBLIC_ONLY && (
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          )}
        </div>
      </div>

      {/* Filter pills (only in ranking view) */}
      {view === "ranking" && availableFilters.length > 1 && (
        <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-8 py-2 sm:py-3 flex gap-2 overflow-x-auto sm:flex-wrap sm:items-center flex-shrink-0">
          {availableFilters.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setAutoRotate(false);
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                filter === f
                  ? "bg-cfa-blue text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-cfa-blue/40"
              }`}
            >
              {getFilterLabel(f)}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard content */}
      <div
        className={`flex-1 min-h-0 px-3 sm:px-8 lg:px-12 py-3 sm:py-4 lg:py-6 ${
          view === "feed"
            ? "overflow-hidden"
            : "leaderboard-scroll overflow-y-auto"
        }`}
      >
        {view === "feed" ? (
          <LatestFinishersFeed participants={participants} />
        ) : (
        <>
        {/* Currently Racing */}
        {racingParticipants.length > 0 && (
          <div className="mb-5">
            <div className="text-sm text-cfa-green font-semibold uppercase tracking-wider mb-2">
              Onderweg ({racingParticipants.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {racingParticipants.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-cfa-green/40 shadow-sm rounded-lg px-3 sm:px-4 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-cfa-blue font-mono font-bold text-base sm:text-lg shrink-0">
                      #{p.startNumber}
                    </span>
                    <span className="font-medium text-gray-900 truncate">
                      {p.name}
                      {p.partnerName && (
                        <span>
                          {" "}& {p.partnerName}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-cfa-green font-bold text-base sm:text-lg shrink-0">
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
                className={`${getMedalBg(rank)} border shadow-sm rounded-lg px-3 sm:px-6 py-2 sm:py-4 flex items-center gap-2 sm:gap-5 animate-slide-in`}
              >
                {/* Rank */}
                <div
                  className={`w-8 sm:w-12 text-center font-bold text-xl sm:text-3xl shrink-0 ${getMedalColor(rank)}`}
                >
                  {rank}
                </div>

                {/* Number */}
                <div className="text-cfa-blue font-mono font-bold text-base sm:text-2xl w-12 sm:w-16 shrink-0">
                  #{p.startNumber}
                </div>

                {/* Name & Category */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base sm:text-2xl text-gray-900 truncate">
                    {p.name}
                    {p.partnerName && <span>{" "}& {p.partnerName}</span>}
                  </div>
                  {filter === "all" && (
                    <div className="text-xs sm:text-sm text-gray-500 truncate">
                      {getClassLabel(p)}
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="text-right shrink-0">
                  <div
                    className={`font-mono font-bold text-lg sm:text-3xl ${
                      rank <= 3 ? getMedalColor(rank) : "text-gray-900"
                    }`}
                  >
                    {p.totalTime ? formatTime(p.totalTime) : "--:--"}
                  </div>
                  {rank > 1 &&
                    finishedParticipants[0].totalTime &&
                    p.totalTime && (
                      <div className="text-[10px] sm:text-sm text-gray-500 font-mono">
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
        </>
        )}
      </div>

      {/* Footer: recent finishes ticker + clock */}
      <footer className="bg-white border-t border-gray-200 px-3 sm:px-8 lg:px-12 py-2 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          {view === "ranking" ? (
            <>
              <span className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Laatste finishes:
              </span>
              <div className="flex gap-4 overflow-hidden">
                {recentFinishes.map((p) => (
                  <span key={p.id} className="text-sm text-gray-700 whitespace-nowrap">
                    <span className="text-cfa-blue font-mono font-bold">#{p.startNumber}</span>
                    {" "}{p.name}
                    {" "}
                    <span className="text-cfa-green font-mono font-semibold">
                      {p.totalTime ? formatTime(p.totalTime) : ""}
                    </span>
                  </span>
                ))}
                {recentFinishes.length === 0 && (
                  <span className="text-sm text-gray-400">Nog geen finishers</span>
                )}
              </div>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 ml-2 sm:ml-4 shrink-0">
          <span className="hidden sm:inline text-sm text-gray-500">
            CrossFit Alkmaar &mdash; {formatEventDate(raceDate)}
          </span>
          <span className="font-mono text-sm sm:text-lg text-gray-600">
            {new Date().toLocaleTimeString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </footer>
    </div>
    </div>
  );
}

const FEED_SIZE = 6;
const FEED_GAP = 12; // px between rows
const MIN_ROW_HEIGHT = 72;

function LatestFinishersFeed({ participants }: { participants: Participant[] }) {
  const latest = useMemo(
    () =>
      participants
        .filter((p) => p.status === "finished" && p.finishTime)
        .sort((a, b) => (b.finishTime || 0) - (a.finishTime || 0))
        .slice(0, FEED_SIZE),
    [participants]
  );

  const prevIdsRef = useRef<Set<string>>(new Set());
  const newIds = useMemo(() => {
    const fresh = new Set<string>();
    for (const p of latest) {
      if (!prevIdsRef.current.has(p.id)) fresh.add(p.id);
    }
    return fresh;
  }, [latest]);

  useEffect(() => {
    prevIdsRef.current = new Set(latest.map((p) => p.id));
  }, [latest]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(800);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const h = el.clientHeight;
      if (h > 0) setContainerHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowHeight = Math.max(
    MIN_ROW_HEIGHT,
    Math.floor((containerHeight - FEED_GAP * (FEED_SIZE - 1)) / FEED_SIZE)
  );

  if (latest.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">&#127939;</div>
        <p className="text-2xl text-gray-500">
          Wachten op de eerste finishers...
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full">
      {latest.map((p, i) => {
          const isNew = newIds.has(p.id);
          const rc = getRaceClass(p.division, p.category);
          const badgeLabel = getClassLabel(p).toUpperCase();
          const badgeClasses = rc.startsWith("doubles_")
            ? "bg-cfa-yellow text-black"
            : rc.endsWith("_pro")
              ? "bg-cfa-blue text-white"
              : "bg-cfa-green text-white";
          return (
            <div
              key={p.id}
              className={`absolute left-0 right-0 transition-all duration-700 ease-out ${
                isNew ? "animate-slide-in-top" : ""
              }`}
              style={{ top: i * (rowHeight + FEED_GAP), height: rowHeight }}
            >
              <div
                className={`h-full bg-white border border-gray-200 shadow-sm rounded-lg px-10 flex items-center gap-8 ${
                  isNew ? "animate-flash-glow" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-5xl text-gray-900 truncate">
                    {p.name}
                    {p.partnerName && <span>{" "}& {p.partnerName}</span>}
                  </div>
                </div>
                <div
                  className={`px-5 py-2 rounded-lg ${badgeClasses} font-bold uppercase tracking-wider text-2xl`}
                >
                  {badgeLabel}
                </div>
                <div className="cfa-stat text-6xl text-cfa-blue w-72 text-right">
                  {p.totalTime ? formatTime(p.totalTime) : "--:--"}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
