import { RaceData, Participant, Heat } from './types';

// In-memory store - works on Vercel serverless
// For a one-day event this is sufficient
// Data persists as long as the serverless function is warm
// Import/export JSON is available as backup

let data: RaceData = {
  participants: [],
  heats: [],
  raceDate: '2026-05-30',
  startTimeBase: '09:00',
  heatInterval: 10,
};

export function loadData(): RaceData {
  return data;
}

export function saveData(newData: RaceData): void {
  data = newData;
}

export function importData(imported: RaceData): void {
  data = imported;
}

export function addParticipant(participant: Participant): RaceData {
  data.participants.push(participant);
  return data;
}

export function updateParticipant(id: string, updates: Partial<Participant>): RaceData {
  const idx = data.participants.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Participant not found');
  data.participants[idx] = { ...data.participants[idx], ...updates };
  return data;
}

export function deleteParticipant(id: string): RaceData {
  data.participants = data.participants.filter((p) => p.id !== id);
  return data;
}

export function setHeats(heats: Heat[]): RaceData {
  data.heats = heats;
  for (const heat of heats) {
    for (const pid of heat.participantIds) {
      const p = data.participants.find((pp) => pp.id === pid);
      if (p) p.heatId = heat.id;
    }
  }
  return data;
}

export function startHeat(heatId: string): RaceData {
  const heat = data.heats.find((h) => h.id === heatId);
  if (!heat) throw new Error('Heat not found');

  const now = Date.now();
  heat.status = 'racing';
  heat.startTime = now;

  for (const pid of heat.participantIds) {
    const p = data.participants.find((pp) => pp.id === pid);
    if (p) {
      p.status = 'racing';
      p.startTime = now;
    }
  }

  return data;
}

export function finishParticipant(participantId: string): RaceData {
  const p = data.participants.find((pp) => pp.id === participantId);
  if (!p) throw new Error('Participant not found');
  if (!p.startTime) throw new Error('Participant has not started');

  const now = Date.now();
  p.finishTime = now;
  p.totalTime = now - p.startTime;
  p.status = 'finished';

  const heat = data.heats.find((h) => h.id === p.heatId);
  if (heat) {
    const allFinished = heat.participantIds.every((pid) => {
      const pp = data.participants.find((ppp) => ppp.id === pid);
      return pp?.status === 'finished';
    });
    if (allFinished) {
      heat.status = 'finished';
    }
  }

  return data;
}
