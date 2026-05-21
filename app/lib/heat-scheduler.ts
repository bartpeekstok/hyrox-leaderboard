import { Participant, Heat, Category, Division } from './types';

/**
 * Heat Scheduling Algorithm for HYROX Race Simulation - CrossFit Alkmaar
 *
 * Only the SLEDS need weight changes (push + pull). All other stations:
 * participants grab their own weight (wall balls, sandbag, farmers carry)
 * or have no weight (SkiErg, rowing, burpees).
 *
 * Duo MM en WW hebben Pro/Open (volgen single-gewicht). Duo MW heeft geen
 * Pro/Open en loopt altijd op 152/103 kg.
 *
 * 3 Sled Weight Blocks (only 2 changes the entire day):
 *   Block 1 - 202/153 kg: Pro Men (single), Pro Duo MM
 *   Block 2 - 152/103 kg: Open Men (single), Pro Women (single),
 *                         Open Duo MM, Pro Duo WW, ALL Duo MW
 *   Block 3 - 102/78 kg:  Open Women (single), Open Duo WW
 *
 * Run order: Block 3 → Block 2 → Block 1 (lightest first, Pro block closes the day).
 * Within each block: duo-categorieën eerst, dan singles. Binnen één
 * (category, division) groep: snelste eerst (voorkomt inhalen). Tussen
 * categorieën binnen een blok een kleine buffer omdat de snelste van de
 * volgende categorie anders de langzaamste van de vorige inhaalt.
 * Tussen blokken: grotere buffer voor sled-gewichtswissel.
 */

export type SledBlock = 1 | 2 | 3;

export const SLED_BLOCK_WEIGHTS: Record<SledBlock, { label: string; men: number; women: number }> = {
  1: { label: '202/153 kg', men: 202, women: 153 },
  2: { label: '152/103 kg', men: 152, women: 103 },
  3: { label: '102/78 kg', men: 102, women: 78 },
};

export function getSledBlock(division: Division, category: Category): SledBlock {
  // Duo MW: vast op 152/103, geen pro/open
  if (category === 'duo_mw') return 2;
  // Duo MM/WW: pro/open bepaalt blok (één stap lichter dan singles)
  if (category === 'duo_mm') return division === 'pro' ? 1 : 2;
  if (category === 'duo_ww') return division === 'pro' ? 2 : 3;

  // Singles: pro/open bepaalt het blok
  if (division === 'pro' && category === 'single_men') return 1;
  if (division === 'open' && category === 'single_women') return 3;

  // Block 2: Open Men, Pro Women
  return 2;
}

// Volgorde binnen een sled-blok: duo's eerst, dan singles. Binnen die twee
// een stabiele volgorde over de categorieën en pro vóór open.
const CATEGORY_ORDER: Category[] = [
  'duo_mm',
  'duo_ww',
  'duo_mw',
  'single_men',
  'single_women',
];
const DIVISION_ORDER: Division[] = ['pro', 'open'];

function groupSortKey(category: Category, division: Division): number {
  return CATEGORY_ORDER.indexOf(category) * 10 + DIVISION_ORDER.indexOf(division);
}

function groupKey(category: Category, division: Division): string {
  return `${category}_${division}`;
}

export function generateHeats(
  participants: Participant[],
  startTimeBase: string,
  intervalMinutes: number
): Heat[] {
  if (participants.length === 0) return [];

  // Step 1: Group participants by sled block and within each block by
  // (category, division) sub-group.
  type Group = {
    block: SledBlock;
    category: Category;
    division: Division;
    participants: Participant[];
  };

  const groupMap = new Map<string, Group>();

  for (const p of participants) {
    const block = getSledBlock(p.division, p.category);
    const key = `${block}_${groupKey(p.category, p.division)}`;
    let g = groupMap.get(key);
    if (!g) {
      g = { block, category: p.category, division: p.division, participants: [] };
      groupMap.set(key, g);
    }
    g.participants.push(p);
  }

  // Step 2: Sort participants within each group, fastest first.
  for (const g of groupMap.values()) {
    g.participants.sort((a, b) => a.estimatedTime - b.estimatedTime);
  }

  // Step 3: Order groups — blocks 3 → 2 → 1 (lightest sled first), and
  // within each block duos before singles using CATEGORY_ORDER.
  const orderedGroups = [...groupMap.values()].sort((a, b) => {
    const blockOrder = [3, 2, 1] as SledBlock[];
    const blockDiff = blockOrder.indexOf(a.block) - blockOrder.indexOf(b.block);
    if (blockDiff !== 0) return blockDiff;
    return (
      groupSortKey(a.category, a.division) - groupSortKey(b.category, b.division)
    );
  });

  // Step 4: Create heats of 3 within each group and remember the
  // group/block boundary so we can insert buffers when they change.
  // Als een groep eindigt met één losse deelnemer (rest 1 bij delen door 3),
  // herverdelen we de laatste 4 in twee heats van 2 i.p.v. een heat van 3 + 1.
  type HeatDraft = {
    participants: Participant[];
    block: SledBlock;
    groupKey: string;
  };

  const allHeats: HeatDraft[] = [];
  for (const g of orderedGroups) {
    const gk = groupKey(g.category, g.division);
    const n = g.participants.length;
    const splitLastFour = n >= 4 && n % 3 === 1;
    const cutoff = splitLastFour ? n - 4 : n;

    for (let i = 0; i < cutoff; i += 3) {
      allHeats.push({
        participants: g.participants.slice(i, i + 3),
        block: g.block,
        groupKey: gk,
      });
    }

    if (splitLastFour) {
      allHeats.push({
        participants: g.participants.slice(cutoff, cutoff + 2),
        block: g.block,
        groupKey: gk,
      });
      allHeats.push({
        participants: g.participants.slice(cutoff + 2, cutoff + 4),
        block: g.block,
        groupKey: gk,
      });
    }
  }

  // Step 5: Assign heat numbers and scheduled times.
  // Eén leeg slot tussen categorieën én tussen blokken (sled-wissel past
  // binnen die buffer omdat de laatste heat sowieso doorloopt).
  const BUFFER_SLOTS_BETWEEN_BLOCKS = 1;
  const BUFFER_SLOTS_BETWEEN_CATEGORIES = 1;

  const [baseHours, baseMinutes] = startTimeBase.split(':').map(Number);
  const baseMinutesTotal = baseHours * 60 + baseMinutes;

  let slotIndex = 0;
  let previousBlock: SledBlock | null = null;
  let previousGroupKey: string | null = null;

  return allHeats.map((h, heatIndex) => {
    if (previousBlock !== null && h.block !== previousBlock) {
      slotIndex += BUFFER_SLOTS_BETWEEN_BLOCKS;
    } else if (previousGroupKey !== null && h.groupKey !== previousGroupKey) {
      slotIndex += BUFFER_SLOTS_BETWEEN_CATEGORIES;
    }
    previousBlock = h.block;
    previousGroupKey = h.groupKey;

    const minutesOffset = slotIndex * intervalMinutes;
    const totalMinutes = baseMinutesTotal + minutesOffset;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const scheduledTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    slotIndex++;

    return {
      id: `heat_${heatIndex + 1}`,
      heatNumber: heatIndex + 1,
      scheduledTime,
      participantIds: h.participants.map((p) => p.id),
      status: 'scheduled' as const,
    };
  });
}
