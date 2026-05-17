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
      <header className="bg-white border-b border-gray-200 shadow-sm px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 sticky top-0 z-10">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo_dark.png"
            alt="CrossFit Alkmaar"
            width={120}
            height={60}
            className="w-20 sm:w-[120px] h-auto"
          />
        </Link>
        <div className="h-10 w-px bg-gray-300 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900">
            STARTLIJST
          </h1>
          <p className="text-xs text-gray-500 truncate leading-tight">
            CrossFit Alkmaar
          </p>
          <p className="text-xs text-gray-500 truncate leading-tight">
            30 mei 2026
          </p>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-6 py-6 max-w-5xl w-full mx-auto">
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
            {sortedHeats.map((heat) => {
              const heatParticipants = heat.participantIds
                .map((id) => participantById.get(id))
                .filter((p): p is Participant => Boolean(p));

              return (
                <section
                  key={heat.id}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
                >
                  <div className="bg-gray-50 px-3 sm:px-6 py-3 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="text-cfa-blue font-bold text-lg sm:text-xl">
                        Heat {heat.heatNumber}
                      </div>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-gray-900">
                        {heatStartTime(heat)}
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500">
                      {heatParticipants.length}{" "}
                      {heatParticipants.length === 1 ? "deelnemer" : "deelnemers"}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {heatParticipants.map((p) => (
                        <div
                          key={p.id}
                          className="px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="text-cfa-blue font-mono font-bold text-base sm:text-lg w-12 sm:w-14 shrink-0">
                            #{p.startNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {p.name}
                              {p.partnerName && (
                                <span>{" "}& {p.partnerName}</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 truncate sm:hidden">
                              {p.category.startsWith("duo_") ? (
                                <span>{CATEGORY_LABELS[p.category]}</span>
                              ) : (
                                <>
                                  {DIVISION_LABELS[p.division]}{" "}
                                  <span className="text-gray-400">
                                    &middot; {CATEGORY_LABELS[p.category]}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="hidden sm:block text-sm text-gray-600 whitespace-nowrap">
                            {p.category.startsWith("duo_") ? (
                              <span>{CATEGORY_LABELS[p.category]}</span>
                            ) : (
                              <>
                                {DIVISION_LABELS[p.division]}{" "}
                                <span className="text-gray-400">
                                  &middot; {CATEGORY_LABELS[p.category]}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    {heatParticipants.length === 0 && (
                      <div className="px-6 py-4 text-sm text-gray-500 italic">
                        Nog geen deelnemers ingedeeld.
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
