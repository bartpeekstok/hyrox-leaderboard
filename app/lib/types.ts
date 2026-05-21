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

// Race classes combine division + category into one user-facing label.
// These are the strings that come through the registration sheet.
// MM en WW doubles hebben Pro/Open; MW doubles loopt op één vast gewicht.
export type RaceClass =
  | 'men_pro'
  | 'men_open'
  | 'women_pro'
  | 'women_open'
  | 'doubles_men_pro'
  | 'doubles_men_open'
  | 'doubles_women_pro'
  | 'doubles_women_open'
  | 'doubles_mixed';

export const CLASS_LABELS: Record<RaceClass, string> = {
  men_pro: 'Men Pro',
  men_open: 'Men Open',
  women_pro: 'Women Pro',
  women_open: 'Women Open',
  doubles_men_pro: 'Doubles men Pro',
  doubles_men_open: 'Doubles men Open',
  doubles_women_pro: 'Doubles women Pro',
  doubles_women_open: 'Doubles women Open',
  doubles_mixed: 'Doubles mixed',
};

export const RACE_CLASSES: RaceClass[] = [
  'men_pro',
  'men_open',
  'women_pro',
  'women_open',
  'doubles_men_pro',
  'doubles_men_open',
  'doubles_women_pro',
  'doubles_women_open',
  'doubles_mixed',
];

export function getRaceClass(division: Division, category: Category): RaceClass {
  if (category === 'duo_mm') return division === 'pro' ? 'doubles_men_pro' : 'doubles_men_open';
  if (category === 'duo_ww') return division === 'pro' ? 'doubles_women_pro' : 'doubles_women_open';
  if (category === 'duo_mw') return 'doubles_mixed';
  if (category === 'single_men') return division === 'pro' ? 'men_pro' : 'men_open';
  return division === 'pro' ? 'women_pro' : 'women_open';
}

export function classToDivisionCategory(rc: RaceClass): { division: Division; category: Category } {
  switch (rc) {
    case 'men_pro': return { division: 'pro', category: 'single_men' };
    case 'men_open': return { division: 'open', category: 'single_men' };
    case 'women_pro': return { division: 'pro', category: 'single_women' };
    case 'women_open': return { division: 'open', category: 'single_women' };
    case 'doubles_men_pro': return { division: 'pro', category: 'duo_mm' };
    case 'doubles_men_open': return { division: 'open', category: 'duo_mm' };
    case 'doubles_women_pro': return { division: 'pro', category: 'duo_ww' };
    case 'doubles_women_open': return { division: 'open', category: 'duo_ww' };
    case 'doubles_mixed': return { division: 'open', category: 'duo_mw' };
  }
}

export function getClassLabel(p: { division: Division; category: Category }): string {
  return CLASS_LABELS[getRaceClass(p.division, p.category)];
}

// Parse a free-form sheet value like "Men Pro", "Doubles women", or legacy
// "Individual Mannen" + separate "Pro" column. Returns null if not recognized.
export function parseClass(raw: string): { division: Division; category: Category } | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  const isDoubles = lower.includes('doubles') || lower.includes('duo');
  const isPro = /\bpro\b/.test(lower);
  const isOpen = /\bopen\b/.test(lower);

  if (isDoubles) {
    if (lower.includes('mixed') || lower.includes('mix') || lower.includes('m/v') || lower.includes('mw')) {
      return classToDivisionCategory('doubles_mixed');
    }
    if (lower.includes('women') || lower.includes('vrouw')) {
      return classToDivisionCategory(isPro ? 'doubles_women_pro' : 'doubles_women_open');
    }
    if (lower.includes('men') || lower.includes('mannen')) {
      return classToDivisionCategory(isPro ? 'doubles_men_pro' : 'doubles_men_open');
    }
    return null;
  }

  // Singles — only treat as full class if division is present in the string
  if (!isPro && !isOpen) return null;
  const division: Division = isPro ? 'pro' : 'open';

  // Check 'women' before 'men' (substring trap)
  if (lower.includes('women') || lower.includes('vrouw')) {
    return { division, category: 'single_women' };
  }
  if (/\bmen\b/.test(lower) || lower.includes('mannen')) {
    return { division, category: 'single_men' };
  }
  return null;
}

export function isDuoCategory(category: Category): boolean {
  return category.startsWith('duo_');
}

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

// Parse estimated time from Google Sheets format to minutes
// "1:10" → 70, "01:15:00" → 75, "Tussen 1:15 en 1:18" → 77, "weet het niet" → 90
export function parseEstimatedTime(raw: string): number {
  if (!raw || raw.trim() === '' || raw.toLowerCase().includes('weet het niet')) {
    return 90;
  }

  // "Tussen X en Y" → average of the two times
  if (raw.toLowerCase().includes('tussen') || raw.toLowerCase().includes('en')) {
    const times = raw.match(/\d+:\d+(?::\d+)?/g);
    if (times && times.length >= 2) {
      const t1 = parseTimeToMinutes(times[0]);
      const t2 = parseTimeToMinutes(times[1]);
      return Math.round((t1 + t2) / 2);
    }
  }

  // Single time value like "1:10" or "01:15:00"
  const timeMatch = raw.match(/\d+:\d+(?::\d+)?/);
  if (timeMatch) {
    return parseTimeToMinutes(timeMatch[0]);
  }

  // Just a number (minutes)
  const numMatch = raw.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);

  return 90;
}

// Convert "H:MM", "HH:MM:SS" to total minutes
function parseTimeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    // HH:MM:SS → hours*60 + minutes
    return parts[0] * 60 + parts[1];
  }
  // H:MM → hours:minutes (all values in sheet are 0-2 hours)
  return parts[0] * 60 + parts[1];
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
