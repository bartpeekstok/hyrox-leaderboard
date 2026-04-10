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
  startNumber: number; // Startnummer op arm
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
  email?: string;
  phone?: string;
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

// Parse estimated time from Google Sheets format
// "1:10" → 70, "Tussen 1:15 en 1:18" → 76.5, "weet het niet" / "" → 75 (default)
export function parseEstimatedTime(raw: string): number {
  if (!raw || raw.trim() === '' || raw.toLowerCase().includes('weet het niet')) {
    return 90; // default
  }

  // "Tussen X en Y" → average
  const tussenMatch = raw.match(/(\d+):(\d+)\s*en\s*(\d+):(\d+)/);
  if (tussenMatch) {
    const t1 = parseInt(tussenMatch[1]) * 60 + parseInt(tussenMatch[2]);
    const t2 = parseInt(tussenMatch[3]) * 60 + parseInt(tussenMatch[4]);
    return Math.round((t1 + t2) / 2);
  }

  // Simple "H:MM" or "M:SS" format
  const timeMatch = raw.match(/(\d+):(\d+)/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const mins = parseInt(timeMatch[2]);
    // If first number is 0 or 1, it's hours:minutes
    if (hours <= 2) {
      return hours * 60 + mins;
    }
    // Otherwise it's minutes:seconds
    return hours;
  }

  // Just a number (minutes)
  const numMatch = raw.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);

  return 75;
}

// Map Google Sheets category to our Category type
export function mapSheetCategory(indDuo: string): Category {
  const lower = indDuo.toLowerCase().trim();
  if (lower.includes('individual') && lower.includes('man')) return 'single_men';
  if (lower.includes('individual') && lower.includes('vrouw')) return 'single_women';
  if (lower.includes('duo') && lower.includes('mannen')) return 'duo_mm';
  if (lower.includes('duo') && lower.includes('vrouw')) return 'duo_ww';
  if (lower.includes('duo') && lower.includes('mix')) return 'duo_mw';
  // Fallback
  if (lower.includes('duo')) return 'duo_mw';
  if (lower.includes('vrouw')) return 'single_women';
  return 'single_men';
}

export function mapSheetDivision(divisie: string): Division {
  return divisie.toLowerCase().trim() === 'pro' ? 'pro' : 'open';
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
