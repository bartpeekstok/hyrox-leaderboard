-- HYROX Race Simulation Tables
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/btcjtsaufsztbllztcwt/sql)

-- Participants table
CREATE TABLE IF NOT EXISTS hyrox_participants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  partner_name TEXT,
  division TEXT NOT NULL CHECK (division IN ('pro', 'open')),
  category TEXT NOT NULL CHECK (category IN ('single_men', 'single_women', 'duo_mm', 'duo_ww', 'duo_mw')),
  estimated_time INTEGER NOT NULL,
  heat_id TEXT,
  start_time BIGINT,
  finish_time BIGINT,
  total_time BIGINT,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'racing', 'finished')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heats table
CREATE TABLE IF NOT EXISTS hyrox_heats (
  id TEXT PRIMARY KEY,
  heat_number INTEGER NOT NULL,
  scheduled_time TEXT NOT NULL,
  participant_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'racing', 'finished')),
  start_time BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS hyrox_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  race_date TEXT DEFAULT '2026-05-30',
  start_time_base TEXT DEFAULT '09:00',
  heat_interval INTEGER DEFAULT 10
);

INSERT INTO hyrox_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security but allow all operations (public event tool)
ALTER TABLE hyrox_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyrox_heats ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyrox_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on hyrox_participants" ON hyrox_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hyrox_heats" ON hyrox_heats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hyrox_settings" ON hyrox_settings FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for live leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE hyrox_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE hyrox_heats;
