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
 * Within each block: sorted by estimated time, fastest first (prevents overtaking).
 * Between blocks: sled weight change (plates are added progressively).
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

export function generateHeats(
  participants: Participant[],
  startTimeBase: string,
  intervalMinutes: number
): Heat[] {
  if (participants.length === 0) return [];

  // Step 1: Assign each participant to a sled block and group them
  const blocks = new Map<SledBlock, Participant[]>();
  blocks.set(1, []);
  blocks.set(2, []);
  blocks.set(3, []);

  for (const p of participants) {
    const block = getSledBlock(p.division, p.category);
    blocks.get(block)!.push(p);
  }

  // Step 2: Within each block, sort by estimated time (fastest first)
  for (const ps of blocks.values()) {
    ps.sort((a, b) => a.estimatedTime - b.estimatedTime);
  }

  // Step 3: Create heats of 3 within each block
  type HeatDraft = {
    participants: Participant[];
    avgEstimatedTime: number;
    block: SledBlock;
  };

  const allHeats: HeatDraft[] = [];

  // Process blocks in order: 3 (lightest) → 2 (middle) → 1 (heaviest, Pro)
  for (const blockNum of [3, 2, 1] as SledBlock[]) {
    const ps = blocks.get(blockNum)!;
    for (let i = 0; i < ps.length; i += 3) {
      const heatParticipants = ps.slice(i, i + 3);
      const avg =
        heatParticipants.reduce((sum, p) => sum + p.estimatedTime, 0) /
        heatParticipants.length;
      allHeats.push({
        participants: heatParticipants,
        avgEstimatedTime: avg,
        block: blockNum,
      });
    }
  }

  // Step 4: Assign heat numbers and scheduled times
  // Add buffer slots between sled weight blocks for:
  // - Time to change sled weights
  // - Prevent fast people in new block from catching slow people in previous block
  const BUFFER_SLOTS_BETWEEN_BLOCKS = 2; // 2 empty slots = 20 min buffer at 10 min intervals

  const [baseHours, baseMinutes] = startTimeBase.split(':').map(Number);
  const baseMinutesTotal = baseHours * 60 + baseMinutes;

  let slotIndex = 0;
  let previousBlock: SledBlock | null = null;

  return allHeats.map((h, heatIndex) => {
    // Add buffer when switching between sled weight blocks
    if (previousBlock !== null && h.block !== previousBlock) {
      slotIndex += BUFFER_SLOTS_BETWEEN_BLOCKS;
    }
    previousBlock = h.block;

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
