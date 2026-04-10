export type Division = 'pro' | 'open';

export type Category =
  | 'single_men'
  | 'single_women'
  | 'duo_mm'
  | 'duo_ww'
  | 'duo_mw';

export type WeightClass = 'men' | 'women' | 'mixed';

export interface Participant {
  id: string;
  name: string;
  partnerName?: string; // For duo categories
  division: Division;
  category: Category;
  estimatedTime: number; // Estimated finish time in minutes
  heatId?: string;
  startTime?: number; // Unix timestamp when heat started
  finishTime?: number; // Unix timestamp when finished
  totalTime?: number; // Total time in milliseconds
  status: 'registered' | 'racing' | 'finished';
}

export interface Heat {
  id: string;
  heatNumber: number;
  scheduledTime: string; // Display time like "09:00"
  participantIds: string[];
  status: 'scheduled' | 'racing' | 'finished';
  startTime?: number; // Actual unix timestamp when started
}

export interface RaceData {
  participants: Participant[];
  heats: Heat[];
  raceDate: string;
  startTimeBase: string; // e.g. "09:00" - first heat starts at
  heatInterval: number; // minutes between heats (default 10)
}

export const CATEGORY_LABELS: Record<Category, string> = {
  single_men: 'Single Mannen',
  single_women: 'Single Vrouwen',
  duo_mm: 'Duo Man/Man',
  duo_ww: 'Duo Vrouw/Vrouw',
  duo_mw: 'Duo Man/Vrouw',
};

export const DIVISION_LABELS: Record<Division, string> = {
  pro: 'Pro',
  open: 'Open',
};

export function getCategoryWeightClass(category: Category): WeightClass {
  switch (category) {
    case 'single_men':
    case 'duo_mm':
      return 'men';
    case 'single_women':
    case 'duo_ww':
      return 'women';
    case 'duo_mw':
      return 'mixed';
  }
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
