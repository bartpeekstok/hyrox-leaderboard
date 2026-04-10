"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Participant,
  Division,
  Category,
  CATEGORY_LABELS,
  DIVISION_LABELS,
  Heat,
} from "../lib/types";
import { generateHeats } from "../lib/heat-scheduler";
import {
  getParticipants,
  addParticipant,
  addParticipantsBulk,
  updateParticipant,
  deleteParticipant,
  deleteAllParticipants,
  getHeats,
  saveHeats,
  getSettings,
  updateSettings,
} from "../lib/store";

export default function AdminPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [division, setDivision] = useState<Division>("open");
  const [category, setCategory] = useState<Category>("single_men");
  const [estimatedTime, setEstimatedTime] = useState(60);

  // Settings
  const [startTime, setStartTime] = useState("09:00");
  const [heatInterval, setHeatInterval] = useState(10);

  // Bulk import
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

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
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    setDivision(p.division);
    setCategory(p.category);
    setEstimatedTime(p.estimatedTime);
  }

  async function handleGenerateHeats() {
    await updateSettings(startTime, heatInterval);
    const newHeats = generateHeats(participants, startTime, heatInterval);
    await saveHeats(newHeats);
    fetchData();
  }

  async function handleBulkImport() {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    const items = lines.map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length === 5) {
        return {
          name: parts[0],
          partnerName: parts[1],
          division: parts[2] as Division,
          category: parts[3] as Category,
          estimatedTime: parseInt(parts[4]),
        };
      }
      return {
        name: parts[0],
        division: parts[1] as Division,
        category: parts[2] as Category,
        estimatedTime: parseInt(parts[3]),
      };
    });

    await addParticipantsBulk(items);
    setBulkText("");
    setShowBulk(false);
    fetchData();
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
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-sm text-gray-400">HYROX Race Simulation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-cfa-blue/30 text-cfa-yellow px-3 py-1 rounded-full text-sm font-semibold">
              {participants.length} deelnemers
            </span>
            <span className="bg-cfa-blue/30 text-cfa-green px-3 py-1 rounded-full text-sm font-semibold">
              {heats.length} heats
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Participant Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-cfa-navy/60 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Deelnemer bewerken" : "Deelnemer toevoegen"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Naam
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
                  placeholder="Volledige naam"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Divisie
                  </label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as Division)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
                  >
                    {Object.entries(DIVISION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Categorie
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isDuo && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Partner naam
                  </label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
                    placeholder="Naam van partner"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Geschatte eindtijd (minuten)
                </label>
                <input
                  type="number"
                  value={estimatedTime}
                  onChange={(e) =>
                    setEstimatedTime(parseInt(e.target.value) || 60)
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
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
                    className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Annuleren
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Bulk Import */}
          <div className="bg-cfa-navy/60 border border-white/10 rounded-xl p-6">
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="text-sm text-cfa-yellow hover:underline mb-3"
            >
              {showBulk ? "Verberg" : "Toon"} bulk import
            </button>
            {showBulk && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  Formaat per regel: naam,divisie,categorie,minuten
                  <br />
                  Duo: naam,partnernaam,divisie,categorie,minuten
                  <br />
                  Voorbeeld: Jan Jansen,open,single_men,65
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono h-32 focus:border-cfa-yellow focus:outline-none"
                  placeholder={
                    "Jan Jansen,open,single_men,65\nLisa de Vries,pro,single_women,55"
                  }
                />
                <button
                  onClick={handleBulkImport}
                  className="w-full bg-cfa-yellow hover:bg-cfa-yellow-hover text-black font-semibold py-2 rounded-lg transition-colors"
                >
                  Importeren
                </button>
              </div>
            )}
          </div>

          {/* Heat Settings */}
          <div className="bg-cfa-navy/60 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Heat Instellingen</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Eerste heat start om
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Interval tussen heats (min)
                </label>
                <input
                  type="number"
                  value={heatInterval}
                  onChange={(e) =>
                    setHeatInterval(parseInt(e.target.value) || 10)
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cfa-yellow focus:outline-none"
                  min={3}
                  max={30}
                />
              </div>
              <button
                onClick={handleGenerateHeats}
                className="w-full bg-cfa-yellow hover:bg-cfa-yellow-hover text-black font-bold py-3 rounded-lg transition-colors text-lg"
              >
                Heat-indeling genereren
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-6">
            <h3 className="text-sm font-bold text-red-400 mb-3">
              Danger Zone
            </h3>
            <button
              onClick={handleDeleteAll}
              className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 font-semibold py-2 rounded-lg transition-colors text-sm border border-red-500/30"
            >
              Alle deelnemers verwijderen
            </button>
          </div>
        </div>

        {/* Right: Participants & Heats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const count = participants.filter(
                (p) => p.category === key
              ).length;
              return (
                <div
                  key={key}
                  className="bg-cfa-navy/60 border border-white/10 rounded-lg p-3 text-center"
                >
                  <div className="text-2xl font-bold text-cfa-yellow">
                    {count}
                  </div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              );
            })}
          </div>

          {/* Heats view */}
          {heats.length > 0 && (
            <div className="bg-cfa-navy/60 border border-white/10 rounded-xl p-6">
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
                      className="bg-black/20 border border-white/5 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">
                          Heat {heat.heatNumber}
                        </span>
                        <span className="text-xs text-cfa-yellow">
                          {heat.scheduledTime}
                        </span>
                      </div>
                      {heatParticipants.map((p) => (
                        <div
                          key={p.id}
                          className="text-sm text-gray-300 flex justify-between"
                        >
                          <span>
                            {p.name}
                            {p.partnerName && ` & ${p.partnerName}`}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {DIVISION_LABELS[p.division]} - {p.estimatedTime}m
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Participants list by category */}
          <div className="bg-cfa-navy/60 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Alle deelnemers</h2>
            {Object.entries(participantsByCategory)
              .sort()
              .map(([key, ps]) => {
                const [div, ...catParts] = key.split("_");
                const cat = catParts.join("_") as Category;
                return (
                  <div key={key} className="mb-6 last:mb-0">
                    <h3 className="text-sm font-semibold text-cfa-yellow mb-2 uppercase tracking-wider">
                      {DIVISION_LABELS[div as Division]} -{" "}
                      {CATEGORY_LABELS[cat] || key}
                    </h3>
                    <div className="space-y-1">
                      {ps
                        .sort((a, b) => a.estimatedTime - b.estimatedTime)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2 group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">
                                {p.name}
                                {p.partnerName && (
                                  <span className="text-gray-400">
                                    {" "}
                                    & {p.partnerName}
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                ~{p.estimatedTime}m
                              </span>
                              {p.heatId && (
                                <span className="text-xs bg-cfa-blue/30 text-cfa-yellow px-2 py-0.5 rounded">
                                  Heat{" "}
                                  {heats.find((h) => h.id === p.heatId)
                                    ?.heatNumber || "?"}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(p)}
                                className="text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20"
                              >
                                Bewerk
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
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
                Nog geen deelnemers. Voeg ze toe via het formulier links.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
