"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  Division,
  Category,
  CLASS_LABELS,
  RACE_CLASSES,
  RaceClass,
  getRaceClass,
  getClassLabel,
  classToDivisionCategory,
  Heat,
} from "../lib/types";
import { generateHeats } from "../lib/heat-scheduler";
import {
  getParticipants,
  addParticipant,
  updateParticipant,
  deleteParticipant,
  deleteAllParticipants,
  getHeats,
  saveHeats,
  getSettings,
  updateSettings,
  syncFromGoogleSheet,
} from "../lib/store";

export default function AdminPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [raceClass, setRaceClass] = useState<RaceClass>("men_open");
  const [estimatedTime, setEstimatedTime] = useState(60);
  const { division, category } = classToDivisionCategory(raceClass);

  // Settings
  const [startTime, setStartTime] = useState("09:00");
  const [heatInterval, setHeatInterval] = useState(10);
  const [sheetUrl, setSheetUrl] = useState("");
  const [raceDate, setRaceDate] = useState("2026-05-30");
  const [dateSaved, setDateSaved] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [p, h, s] = await Promise.all([
        getParticipants(),
        getHeats(),
        getSettings(),
      ]);
      setParticipants(p);
      setHeats(h);
      setStartTime(s.startTimeBase);
      setHeatInterval(s.heatInterval);
      setRaceDate(s.raceDate);
      if (s.sheetUrl) setSheetUrl(s.sheetUrl);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-enable sync when sheet URL is loaded
  useEffect(() => {
    if (sheetUrl && !autoSync) {
      setAutoSync(true);
    }
  }, [sheetUrl]);

  // Auto-sync every 30 seconds when enabled. Nieuwe deelnemers komen
  // ongeplaatst binnen — admin wijst ze handmatig toe via "Alle deelnemers".
  useEffect(() => {
    if (!autoSync || !sheetUrl) return;
    const interval = setInterval(async () => {
      try {
        const result = await syncFromGoogleSheet(sheetUrl);
        if (result.added > 0) {
          setSyncResult(`+${result.added} nieuwe deelnemers (totaal: ${result.total}) — nog toewijzen`);
          fetchData();
        }
      } catch {
        // Silent fail for auto-sync
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [autoSync, sheetUrl, fetchData]);

  const isDuo = category.startsWith("duo_");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        await updateParticipant(editingId, {
          name: name.trim(),
          partnerName: isDuo ? partnerName.trim() : undefined,
          division,
          category,
          estimatedTime,
        });
        setEditingId(null);
      } else {
        await addParticipant({
          name: name.trim(),
          partnerName: isDuo ? partnerName.trim() : undefined,
          division,
          category,
          estimatedTime,
        });
      }
      setName("");
      setPartnerName("");
      fetchData();
    } catch (err) {
      console.error("Error saving participant:", err);
    }
  }

  async function handleDelete(id: string) {
    await deleteParticipant(id);
    fetchData();
  }

  async function handleDeleteAll() {
    if (!confirm("Weet je zeker dat je ALLE deelnemers wilt verwijderen?"))
      return;
    await deleteAllParticipants();
    fetchData();
  }

  function handleEdit(p: Participant) {
    setEditingId(p.id);
    setName(p.name);
    setPartnerName(p.partnerName || "");
    setRaceClass(getRaceClass(p.division, p.category));
    setEstimatedTime(p.estimatedTime);
  }

  async function handleSaveEventDate() {
    await updateSettings(startTime, heatInterval, sheetUrl, raceDate);
    setDateSaved(true);
    setTimeout(() => setDateSaved(false), 3000);
  }

  async function handleGenerateHeats() {
    await updateSettings(startTime, heatInterval, sheetUrl, raceDate);
    const newHeats = generateHeats(participants, startTime, heatInterval);
    await saveHeats(newHeats);
    fetchData();
  }

  async function handleUpdateHeatTime(heatId: string, newTime: string) {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    const updated = heats.map((h) =>
      h.id === heatId ? { ...h, scheduledTime: newTime } : h
    );
    setHeats(updated);
    await saveHeats(updated);
    fetchData();
  }

  async function handleMoveParticipant(
    participantId: string,
    fromHeatId: string,
    toHeatId: string
  ) {
    if (fromHeatId === toHeatId) return;
    const updated = heats.map((h) => {
      const hadIt = h.participantIds.includes(participantId);
      if (h.id === toHeatId) {
        return hadIt ? h : { ...h, participantIds: [...h.participantIds, participantId] };
      }
      if (hadIt) {
        return { ...h, participantIds: h.participantIds.filter((id) => id !== participantId) };
      }
      return h;
    });
    setHeats(updated);
    await saveHeats(updated);
    fetchData();
  }

  async function handleSync() {
    if (!sheetUrl) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      await updateSettings(startTime, heatInterval, sheetUrl, raceDate);
      const result = await syncFromGoogleSheet(sheetUrl);
      setSyncResult(
        result.added > 0
          ? `${result.added} nieuwe deelnemers toegevoegd (totaal: ${result.total}) — nog toewijzen aan heat`
          : `Geen nieuwe deelnemers (totaal: ${result.total})`
      );
      fetchData();
    } catch (err) {
      setSyncResult(`Fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    }
    setSyncing(false);
  }

  const participantsByCategory = participants.reduce(
    (acc, p) => {
      const key = `${p.division}_${p.category}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {} as Record<string, Participant[]>
  );

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
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-sm text-gray-600">HYROX Race Simulation</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/finishfoto"
              className="bg-cfa-blue text-white px-3 py-1 rounded-full text-sm font-semibold hover:bg-cfa-blue-hover transition-colors"
            >
              Finishfoto
            </Link>
            <span className="bg-cfa-blue/10 text-cfa-blue border border-cfa-blue/20 px-3 py-1 rounded-full text-sm font-semibold">
              {participants.reduce((sum, p) => sum + (p.category.startsWith("duo_") ? 2 : 1), 0)} deelnemers
            </span>
            <span className="bg-cfa-green/10 text-cfa-green border border-cfa-green/20 px-3 py-1 rounded-full text-sm font-semibold">
              {heats.length} heats
            </span>
            {heats.length > 0 && participants.some((p) => !p.heatId) && (
              <span className="bg-cfa-yellow/15 text-cfa-yellow-hover border border-cfa-yellow/40 px-3 py-1 rounded-full text-sm font-semibold">
                {participants.filter((p) => !p.heatId).length} zonder heat
              </span>
            )}
            {autoSync && (
              <span className="bg-cfa-green/20 text-cfa-green px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                Auto-sync AAN
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Google Sheets Sync */}
          <div className="bg-white border border-cfa-blue/30 shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4 text-cfa-blue">
              Google Sheets Sync
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Google Sheets URL
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing || !sheetUrl}
                  className="flex-1 bg-cfa-blue hover:bg-cfa-blue-hover disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {syncing ? "Syncing..." : "Sync nu"}
                </button>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    autoSync
                      ? "bg-cfa-green/20 text-cfa-green border border-cfa-green/30"
                      : "bg-gray-100 text-gray-600 hover:bg-steel-200"
                  }`}
                >
                  Auto {autoSync ? "AAN" : "UIT"}
                </button>
              </div>
              {syncResult && (
                <p className="text-sm text-cfa-green bg-cfa-green/10 rounded-lg px-3 py-2">
                  {syncResult}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Sheet moet &quot;Iedereen met link&quot; toegang hebben. Kolommen: IND/DUO, DIVISIE, NAAM, TELEFOON, E-MAIL, GESCHATTE EINDTIJD
              </p>
            </div>
          </div>

          {/* Add Participant Form */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Deelnemer bewerken" : "Handmatig toevoegen"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Naam
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                  placeholder="Volledige naam"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Klasse
                </label>
                <select
                  value={raceClass}
                  onChange={(e) => setRaceClass(e.target.value as RaceClass)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                >
                  {RACE_CLASSES.map((rc) => (
                    <option key={rc} value={rc}>
                      {CLASS_LABELS[rc]}
                    </option>
                  ))}
                </select>
              </div>

              {isDuo && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Partner naam
                  </label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                    placeholder="Naam van partner"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Geschatte eindtijd (minuten)
                </label>
                <input
                  type="number"
                  value={estimatedTime}
                  onChange={(e) =>
                    setEstimatedTime(parseInt(e.target.value) || 60)
                  }
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                  min={20}
                  max={180}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-cfa-blue hover:bg-cfa-blue-hover text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {editingId ? "Opslaan" : "Toevoegen"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setName("");
                      setPartnerName("");
                    }}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-steel-200 transition-colors"
                  >
                    Annuleren
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Event Settings */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Event</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Datum van het event
                </label>
                <input
                  type="date"
                  value={raceDate}
                  onChange={(e) => setRaceDate(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Wordt getoond op de homepage, startlijst en het leaderboard.
                </p>
              </div>
              <button
                onClick={handleSaveEventDate}
                className="w-full bg-cfa-blue hover:bg-cfa-blue-hover text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Datum opslaan
              </button>
              {dateSaved && (
                <p className="text-sm text-cfa-green bg-cfa-green/10 rounded-lg px-3 py-2">
                  Datum opgeslagen
                </p>
              )}
            </div>
          </div>

          {/* Heat Settings */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Heat Instellingen</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Eerste heat start om
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Interval tussen heats (min)
                </label>
                <input
                  type="number"
                  value={heatInterval}
                  onChange={(e) =>
                    setHeatInterval(parseInt(e.target.value) || 10)
                  }
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none"
                  min={3}
                  max={30}
                />
              </div>
              <button
                onClick={handleGenerateHeats}
                className="w-full bg-cfa-yellow hover:bg-cfa-yellow-hover text-cfa-ink font-bold py-3 rounded-lg transition-colors text-lg"
              >
                Heat-indeling genereren
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white border border-cfa-red/30 rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-bold text-cfa-red mb-3 uppercase tracking-wider">
              Danger Zone
            </h3>
            <button
              onClick={handleDeleteAll}
              className="w-full bg-cfa-red hover:bg-cfa-red/85 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
            >
              Alle deelnemers verwijderen
            </button>
          </div>
        </div>

        {/* Right: Participants & Heats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Class summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {RACE_CLASSES.map((rc) => {
              const count = participants.filter(
                (p) => getRaceClass(p.division, p.category) === rc
              ).length;
              return (
                <div
                  key={rc}
                  className="bg-white border border-gray-200 shadow-sm rounded-lg p-3 text-center"
                >
                  <div className="text-2xl font-bold text-cfa-blue">
                    {count}
                  </div>
                  <div className="text-xs text-gray-600">{CLASS_LABELS[rc]}</div>
                </div>
              );
            })}
          </div>

          {/* Heats view */}
          {heats.length > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-bold mb-4">
                Heat-indeling ({heats.length} heats)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {heats.map((heat) => {
                  const heatParticipants = heat.participantIds
                    .map((id) => participants.find((p) => p.id === id))
                    .filter(Boolean) as Participant[];
                  return (
                    <div
                      key={heat.id}
                      className="bg-surface-muted border border-border rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">
                          Heat {heat.heatNumber}
                        </span>
                        <input
                          type="time"
                          defaultValue={heat.scheduledTime}
                          disabled={heat.status !== 'scheduled'}
                          onBlur={(e) => {
                            if (e.target.value && e.target.value !== heat.scheduledTime) {
                              handleUpdateHeatTime(heat.id, e.target.value);
                            }
                          }}
                          className="text-xs text-cfa-blue font-mono bg-white border border-gray-300 rounded px-1 py-0.5 focus:border-cfa-blue focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          title={heat.status !== 'scheduled' ? 'Heat is gestart of afgerond' : 'Klik om tijd te wijzigen'}
                        />
                      </div>
                      {heatParticipants.map((p) => (
                        <div key={p.id} className="text-sm text-gray-900 flex items-center justify-between gap-2 py-0.5">
                          <span className="truncate">
                            <span className="text-cfa-blue font-mono font-bold mr-2">
                              #{p.startNumber}
                            </span>
                            {p.name}
                            {p.partnerName && ` & ${p.partnerName}`}
                          </span>
                          <select
                            value={heat.id}
                            onChange={(e) => handleMoveParticipant(p.id, heat.id, e.target.value)}
                            disabled={heat.status !== 'scheduled'}
                            className="text-xs bg-white border border-gray-300 rounded px-1 py-0.5 text-gray-700 focus:border-cfa-blue focus:outline-none disabled:opacity-50"
                            title={heat.status !== 'scheduled' ? 'Heat is gestart of afgerond' : 'Verplaats naar andere heat'}
                          >
                            {heats.map((h) => (
                              <option key={h.id} value={h.id} disabled={h.status !== 'scheduled' && h.id !== heat.id}>
                                Heat {h.heatNumber} ({h.scheduledTime})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Participants list by category */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Alle deelnemers</h2>
            {Object.entries(participantsByCategory)
              .sort()
              .map(([key, ps]) => {
                const [div, ...catParts] = key.split("_");
                const cat = catParts.join("_") as Category;
                return (
                  <div key={key} className="mb-6 last:mb-0">
                    <h3 className="text-sm font-semibold text-cfa-blue mb-2 uppercase tracking-wider">
                      {getClassLabel({ division: div as Division, category: cat })} ({ps.length})
                    </h3>
                    <div className="space-y-1">
                      {ps
                        .sort((a, b) => a.startNumber - b.startNumber)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between bg-cfa-cream border border-gray-200 rounded-lg px-3 py-2 group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-cfa-blue font-mono font-bold text-sm w-8">
                                #{p.startNumber}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {p.name}
                                {p.partnerName && (
                                  <span>
                                    {" "}
                                    & {p.partnerName}
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                ~{p.estimatedTime}m
                              </span>
                              {heats.length > 0 && (
                                <select
                                  value={p.heatId || ""}
                                  onChange={(e) => handleMoveParticipant(p.id, p.heatId || "", e.target.value)}
                                  className={`text-xs border rounded px-1 py-0.5 focus:outline-none ${
                                    p.heatId
                                      ? "bg-cfa-blue/10 text-cfa-blue border-cfa-blue/20"
                                      : "bg-cfa-yellow/10 text-cfa-yellow-hover border-cfa-yellow/40 font-semibold"
                                  }`}
                                >
                                  <option value="" disabled>
                                    Geen heat
                                  </option>
                                  {heats.map((h) => (
                                    <option key={h.id} value={h.id} disabled={h.status !== 'scheduled' && h.id !== p.heatId}>
                                      Heat {h.heatNumber} ({h.scheduledTime})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEdit(p)}
                                className="text-xs px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100 font-medium"
                              >
                                Bewerk
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="text-xs px-3 py-1 bg-white border border-red-300 text-red-600 rounded hover:bg-red-50 font-medium"
                              >
                                Verwijder
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            {participants.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                Nog geen deelnemers. Sync vanuit Google Sheets of voeg ze handmatig toe.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
