"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  Heat,
  CATEGORY_LABELS,
  DIVISION_LABELS,
} from "../lib/types";
import { getParticipants, getHeats, getSettings } from "../lib/store";
import { supabase } from "../lib/supabase";

export default function StartlijstPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [startTimeBase, setStartTimeBase] = useState("09:00");
  const [heatInterval, setHeatInterval] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [p, h, s] = await Promise.all([
        getParticipants(),
        getHeats(),
        getSettings(),
      ]);
      setParticipants(p);
      setHeats(h);
      setStartTimeBase(s.startTimeBase);
      setHeatInterval(s.heatInterval);
    } catch (err) {
      console.error("Error fetching startlijst:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("startlijst")
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

  const participantById = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  function heatStartTime(heat: Heat): string {
    if (heat.scheduledTime) return heat.scheduledTime;
    const [h, m] = startTimeBase.split(":").map(Number);
    const total = h * 60 + m + (heat.heatNumber - 1) * heatInterval;
    const hh = Math.floor(total / 60).toString().padStart(2, "0");
    const mm = (total % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const lowerSearch = search.toLowerCase().trim();
  const hasSearch = lowerSearch.length > 0;

  function isMatch(p: Participant): boolean {
    if (!hasSearch) return false;
    if (p.name.toLowerCase().includes(lowerSearch)) return true;
    if (p.partnerName?.toLowerCase().includes(lowerSearch)) return true;
    if (String(p.startNumber).includes(lowerSearch)) return true;
    return false;
  }

  const matchCount = hasSearch
    ? participants.filter(isMatch).length
    : 0;

  const sortedHeats = useMemo(
    () => [...heats].sort((a, b) => a.heatNumber - b.heatNumber),
    [heats]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200">
        <div className="text-xl text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Image
              src="/logo_dark.png"
              alt="CrossFit Alkmaar"
              width={120}
              height={60}
            />
          </Link>
          <div className="h-10 w-px bg-gray-300" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              STARTLIJST
            </h1>
            <p className="text-xs text-gray-500">
              CrossFit Alkmaar &mdash; 30 mei 2026
            </p>
          </div>
        </div>
        <div className="flex-1 max-w-md ml-6">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op naam of startnummer..."
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-5 py-2.5 pr-24 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20"
            />
            {hasSearch && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                {matchCount} {matchCount === 1 ? "resultaat" : "resultaten"}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-5xl w-full mx-auto">
        {sortedHeats.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">&#128197;</div>
            <p className="text-2xl text-gray-600">
              De heat-indeling is nog niet beschikbaar.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Kom binnenkort terug.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const visibleHeats = sortedHeats.filter((heat) => {
                if (!hasSearch) return true;
                return heat.participantIds
                  .map((id) => participantById.get(id))
                  .filter((p): p is Participant => Boolean(p))
                  .some(isMatch);
              });

              if (hasSearch && visibleHeats.length === 0) {
                return (
                  <div className="text-center py-20 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="text-5xl mb-4">&#128269;</div>
                    <p className="text-xl text-gray-700 font-medium">
                      Geen deelnemer gevonden voor &ldquo;{search}&rdquo;
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Probeer een andere naam of startnummer.
                    </p>
                  </div>
                );
              }

              return visibleHeats.map((heat) => {
              const heatParticipants = heat.participantIds
                .map((id) => participantById.get(id))
                .filter((p): p is Participant => Boolean(p));
              const heatHasMatch =
                hasSearch && heatParticipants.some(isMatch);

              return (
                <section
                  key={heat.id}
                  className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-colors ${
                    heatHasMatch
                      ? "border-cfa-blue ring-2 ring-cfa-blue/20"
                      : "border-gray-200"
                  }`}
                >
                  <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="text-cfa-blue font-bold text-xl">
                        Heat {heat.heatNumber}
                      </div>
                      <div className="text-3xl font-mono font-bold text-gray-900">
                        {heatStartTime(heat)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {heatParticipants.length}{" "}
                      {heatParticipants.length === 1 ? "deelnemer" : "deelnemers"}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {heatParticipants.map((p) => {
                      const matched = isMatch(p);
                      return (
                        <div
                          key={p.id}
                          className={`px-6 py-3 flex items-center gap-4 transition-colors ${
                            matched
                              ? "bg-cfa-blue/10"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="text-cfa-blue font-mono font-bold text-lg w-14">
                            #{p.startNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {p.name}
                              {p.partnerName && (
                                <span className="font-normal">
                                  {" "}& {p.partnerName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 whitespace-nowrap">
                            {DIVISION_LABELS[p.division]}{" "}
                            <span className="text-gray-400">
                              &middot; {CATEGORY_LABELS[p.category]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {heatParticipants.length === 0 && (
                      <div className="px-6 py-4 text-sm text-gray-500 italic">
                        Nog geen deelnemers ingedeeld.
                      </div>
                    )}
                  </div>
                </section>
              );
            });
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
