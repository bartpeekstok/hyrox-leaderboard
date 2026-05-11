"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "hyrox-admin-auth";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!expected) {
      // No password configured: allow through (dev convenience)
      setAuthenticated(true);
    } else if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setAuthenticated(true);
    }
    setChecked(true);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (input === expected) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthenticated(true);
      setError(false);
      setInput("");
    } else {
      setError(true);
    }
  }

  if (!checked) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-cfa-navy/80 border border-white/10 rounded-2xl p-8"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Admin login</h1>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          autoFocus
          placeholder="Wachtwoord"
          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:border-cfa-yellow"
        />
        {error && (
          <p className="text-cfa-red text-sm mb-3">Onjuist wachtwoord</p>
        )}
        <button
          type="submit"
          className="w-full bg-cfa-yellow text-cfa-navy font-bold py-3 rounded-lg hover:bg-cfa-yellow-hover transition-colors"
        >
          Inloggen
        </button>
      </form>
    </div>
  );
}
