"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Participant,
  formatTime,
  formatEventDate,
  getClassLabel,
  getRaceClass,
} from "../lib/types";
import { getParticipants, getSettings } from "../lib/store";
import { supabase } from "../lib/supabase";
import { useFinishfotoChannel } from "../lib/finishfoto-channel";

const LAST_NUMBER_KEY = "finishfoto-startnummer";

export default function FinishfotoPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [raceDate, setRaceDate] = useState("2026-05-30");
  // Laatst getoonde nummer onthouden, zodat een herladen scherm niet leeg opent
  const [input, setInput] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem(LAST_NUMBER_KEY) ?? ""
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // De telefoon van de coach stuurt startnummers via een realtime broadcast —
  // het scherm hoeft daarvoor nooit herladen te worden.
  const { status } = useFinishfotoChannel({
    role: "display",
    value: input,
    onValue: setInput,
  });

  useEffect(() => {
    localStorage.setItem(LAST_NUMBER_KEY, input);
  }, [input]);

  // In fullscreen: bedieningsbalk verbergen na 2,5s zonder muisbeweging
  useEffect(() => {
    function poke() {
      setBarVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (document.fullscreenElement) {
        hideTimerRef.current = setTimeout(() => setBarVisible(false), 2500);
      }
    }
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
      poke();
    }
    window.addEventListener("mousemove", poke);
    window.addEventListener("touchstart", poke);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("touchstart", poke);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

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
    getSettings()
      .then((s) => setRaceDate(s.raceDate))
      .catch(() => {});

    const channel = supabase
      .channel("finishfoto")
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

  // QR-code naar de mobiele afstandsbediening
  async function openQr() {
    const url = `${window.location.origin}/finishfoto/remote`;
    setRemoteUrl(url);
    setQrSvg("");
    setQrOpen(true);
    try {
      setQrSvg(await QRCode.toString(url, { type: "svg", margin: 1, width: 320 }));
    } catch {
      setQrSvg("");
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
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
    <div className="relative h-screen overflow-hidden bg-background flex flex-col">
      {/* Bedieningsbalk — zweeft bovenop, verdwijnt in fullscreen bij stilstaande muis */}
      <header
        className={`absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center gap-3 transition-opacity duration-500 ${
          barVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Link
          href="/"
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors shrink-0"
        >
          Home
        </Link>
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Startnummer"
          className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-lg font-bold text-center focus:border-cfa-blue focus:ring-2 focus:ring-cfa-blue/20 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {input && (
          <button
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors"
          >
            Wissen
          </button>
        )}
        <div className="flex-1" />
        <span
          className="flex items-center gap-2 text-xs font-semibold text-steel-500"
          title={
            status === "connected"
              ? "Verbonden met de mobiele bediening"
              : "Geen verbinding met de mobiele bediening"
          }
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === "connected"
                ? "bg-cfa-green"
                : status === "offline"
                  ? "bg-cfa-red"
                  : "bg-cfa-yellow"
            }`}
          />
          Mobiel
        </span>
        <button
          onClick={openQr}
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors"
        >
          QR voor telefoon
        </button>
        <button
          onClick={toggleFullscreen}
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-steel-200 transition-colors"
        >
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </header>

      {/* Foto-kader — alle maten in vh zodat alles altijd in beeld past */}
      <main className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-8 pb-[2vh] text-center">
        {/* CFA-logo linksboven als zichtbare brand stamp */}
        <Image
          src="/logo_dark.png"
          alt="CrossFit Alkmaar"
          width={400}
          height={200}
          priority
          className="absolute top-[6vh] left-[4vw] w-auto h-[14vh]"
        />

        {/* CFA-logo als watermerk achter de content */}
        <Image
          src="/logo_dark.png"
          alt=""
          width={800}
          height={400}
          priority
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto h-[70vh] max-w-[90vw] object-contain opacity-[0.07] pointer-events-none select-none"
        />

        <div className="relative flex flex-col items-center max-w-full">
          {/* Naamblok bovenaan */}
          {participant ? (
            <>
              <h2 className="cfa-display text-cfa-ink text-[14vh] leading-[0.95] break-words max-w-full">
                {participant.name}
              </h2>
              {participant.partnerName && (
                <h2 className="cfa-display text-cfa-ink text-[14vh] leading-[0.95] break-words max-w-full">
                  {participant.partnerName}
                </h2>
              )}

              <div
                className={`mt-[2.5vh] px-10 py-[1.4vh] rounded-lg font-bold uppercase tracking-wider text-[4vh] ${badgeClasses}`}
              >
                {getClassLabel(participant)}
              </div>

              {participant.status === "finished" && participant.totalTime ? (
                <div className="cfa-stat text-cfa-blue text-[16vh] leading-none mt-[2.5vh]">
                  {formatTime(participant.totalTime)}
                </div>
              ) : (
                <p className="text-steel-500 font-semibold text-[3.5vh] mt-[3vh]">
                  {participant.status === "racing"
                    ? "Nog onderweg..."
                    : "Nog niet gestart"}
                </p>
              )}
            </>
          ) : input ? (
            <p className="text-steel-400 text-3xl">
              Startnummer {input} niet gevonden
            </p>
          ) : (
            <p className="text-steel-500 text-2xl">
              Voer linksboven een startnummer in
            </p>
          )}

          {/* Eventblok: titel + datum onder de naam */}
          <h1 className="cfa-display text-cfa-ink text-[12vh] leading-none mt-[5vh]">
            HYROX <span className="text-cfa-blue">RACE SIMULATION</span>
          </h1>
          <p className="text-cfa-ink font-semibold text-[3.5vh] mt-[1vh]">
            {formatEventDate(raceDate, true)}
          </p>
        </div>
      </main>

      {/* QR-overlay: coach scant en bedient het scherm vanaf zijn telefoon */}
      {qrOpen && (
        <div
          onClick={() => setQrOpen(false)}
          className="absolute inset-0 z-20 bg-cfa-ink/70 flex items-center justify-center p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Bedien vanaf je telefoon
            </h2>
            <p className="text-steel-500 mb-6">
              Scan de code, log in met het adminwachtwoord en typ het
              startnummer — dit scherm volgt direct.
            </p>
            {qrSvg ? (
              <div
                className="mx-auto w-64 h-64 [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <p className="text-steel-400">QR-code laden...</p>
            )}
            <p className="mt-4 text-sm text-steel-500 break-all">{remoteUrl}</p>
            <button
              onClick={() => setQrOpen(false)}
              className="mt-6 w-full bg-cfa-blue text-white font-semibold py-3 rounded-lg hover:bg-cfa-blue-hover transition-colors"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
