import { Participant, Heat, Category, Division, getCategoryWeightClass, WeightClass } from './types';

/**
 * Heat Scheduling Algorithm for HYROX Race Simulation
 *
 * Key constraints:
 * - 3 sets of equipment per station (max 3 people at any station simultaneously)
 * - Heats of 3 people, starting every N minutes
 * - Must prevent overtaking (fast person from later heat catching slow person from earlier heat)
 * - Minimize equipment weight changes between heats
 *
 * Strategy:
 * 1. Group participants by category (same weight requirements)
 * 2. Within each group, sort by estimated time (fastest first)
 * 3. Create heats of 3 from same category
 * 4. Cluster heats by weight class so equipment doesn't need constant switching
 * 5. Within each weight class cluster, order fastest first (prevents overtaking)
 * 6. Order weight class clusters: men -> mixed -> women (logical weight transition)
 *
 * HYROX Station Equipment Weights:
 * - SkiErg: no weight difference
 * - Sled Push: Pro Men 152kg, Open Men 102kg, Pro Women 102kg, Open Women 72kg
 * - Sled Pull: Pro Men 103kg, Open Men 78kg, Pro Women 78kg, Open Women 53kg
 * - Burpee Broad Jump: no equipment
 * - Rowing: no weight difference
 * - Farmers Carry: Pro Men 2x32kg, Open Men 2x24kg, Pro Women 2x24kg, Open Women 2x16kg
 * - Sandbag Lunges: Pro Men 30kg, Open Men 20kg, Pro Women 20kg, Open Women 10kg
 * - Wall Balls: Pro Men 9kg, Open Men 6kg, Pro Women 6kg, Open Women 4kg
 */

export function generateHeats(
  participants: Participant[],
  startTimeBase: string,
  intervalMinutes: number
): Heat[] {
  if (participants.length === 0) return [];

  // Step 1: Group by division + category (exact weight match)
  const groups = new Map<string, Participant[]>();

  for (const p of participants) {
    const key = `${p.division}_${p.category}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(p);
  }

  // Step 2: Within each group, sort by estimated time (fastest first)
  for (const ps of groups.values()) {
    ps.sort((a, b) => a.estimatedTime - b.estimatedTime);
  }

  // Step 3: Create heats of 3 from each group
  type HeatDraft = {
    participants: Participant[];
    avgEstimatedTime: number;
    division: Division;
    category: Category;
    weightClass: WeightClass;
  };

  const allHeats: HeatDraft[] = [];

  for (const [key, ps] of groups.entries()) {
    const [division, category] = key.split('_') as [Division, Category];
    const weightClass = getCategoryWeightClass(category);

    for (let i = 0; i < ps.length; i += 3) {
      const heatParticipants = ps.slice(i, i + 3);
      const avg =
        heatParticipants.reduce((sum, p) => sum + p.estimatedTime, 0) /
        heatParticipants.length;
      allHeats.push({
        participants: heatParticipants,
        avgEstimatedTime: avg,
        division,
        category,
        weightClass,
      });
    }
  }

  // Step 4: Cluster by weight class to minimize equipment changes
  // Within each cluster, order by estimated time (fastest first = prevents overtaking)
  // Order of clusters: fastest avg across all clusters first, but grouped by weight class

  // Group heats by division+weightClass (exact equipment setup)
  const equipmentGroups = new Map<string, HeatDraft[]>();
  for (const h of allHeats) {
    const key = `${h.division}_${h.weightClass}`;
    if (!equipmentGroups.has(key)) {
      equipmentGroups.set(key, []);
    }
    equipmentGroups.get(key)!.push(h);
  }

  // Within each equipment group, sort fastest first
  for (const heats of equipmentGroups.values()) {
    heats.sort((a, b) => a.avgEstimatedTime - b.avgEstimatedTime);
  }

  // Order equipment groups logically to minimize weight changes:
  // Pro Men -> Open Men -> Duo MM -> Duo MW -> Pro Women -> Open Women -> Duo WW
  const groupOrder = [
    'pro_men',
    'open_men',
    'pro_mixed',   // duo MW pro
    'open_mixed',  // duo MW open
    'pro_women',
    'open_women',
  ];

  const orderedHeats: HeatDraft[] = [];

  // First add in preferred order
  for (const key of groupOrder) {
    const heats = equipmentGroups.get(key);
    if (heats) {
      orderedHeats.push(...heats);
      equipmentGroups.delete(key);
    }
  }

  // Then add any remaining groups we didn't explicitly order
  for (const heats of equipmentGroups.values()) {
    orderedHeats.push(...heats);
  }

  // Step 5: Assign heat numbers and scheduled times
  const [baseHours, baseMinutes] = startTimeBase.split(':').map(Number);
  const baseMinutesTotal = baseHours * 60 + baseMinutes;

  return orderedHeats.map((h, index) => {
    const minutesOffset = index * intervalMinutes;
    const totalMinutes = baseMinutesTotal + minutesOffset;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const scheduledTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    return {
      id: `heat_${index + 1}`,
      heatNumber: index + 1,
      scheduledTime,
      participantIds: h.participants.map((p) => p.id),
      status: 'scheduled' as const,
    };
  });
}
