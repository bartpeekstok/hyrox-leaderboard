import { supabase } from './supabase';
import { Participant, Heat } from './types';

// ==================== PARTICIPANTS ====================

export async function getParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('hyrox_participants')
    .select('*')
    .order('start_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(dbToParticipant);
}

export async function getNextStartNumber(): Promise<number> {
  const { data } = await supabase
    .from('hyrox_participants')
    .select('start_number')
    .order('start_number', { ascending: false })
    .limit(1);

  if (data && data.length > 0 && data[0].start_number) {
    return data[0].start_number + 1;
  }
  return 1;
}

export async function addParticipant(
  p: Omit<Participant, 'id' | 'status' | 'startNumber'> & { startNumber?: number }
): Promise<Participant> {
  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startNumber = p.startNumber || (await getNextStartNumber());

  const row = {
    id,
    start_number: startNumber,
    name: p.name,
    partner_name: p.partnerName || null,
    division: p.division,
    category: p.category,
    estimated_time: p.estimatedTime,
    email: p.email || null,
    phone: p.phone || null,
    status: 'registered',
  };

  const { data, error } = await supabase
    .from('hyrox_participants')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return dbToParticipant(data);
}

export async function addParticipantsBulk(
  items: (Omit<Participant, 'id' | 'status' | 'startNumber'> & { startNumber?: number })[]
): Promise<void> {
  let nextNum = await getNextStartNumber();

  const rows = items.map((p) => ({
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${Math.random().toString(36).slice(2, 4)}`,
    start_number: p.startNumber || nextNum++,
    name: p.name,
    partner_name: p.partnerName || null,
    division: p.division,
    category: p.category,
    estimated_time: p.estimatedTime,
    email: p.email || null,
    phone: p.phone || null,
    status: 'registered',
  }));

  const { error } = await supabase.from('hyrox_participants').insert(rows);
  if (error) throw error;
}

export async function updateParticipant(
  id: string,
  updates: Partial<Participant>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.partnerName !== undefined) row.partner_name = updates.partnerName;
  if (updates.division !== undefined) row.division = updates.division;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.estimatedTime !== undefined) row.estimated_time = updates.estimatedTime;
  if (updates.heatId !== undefined) row.heat_id = updates.heatId;
  if (updates.startTime !== undefined) row.start_time = updates.startTime;
  if (updates.finishTime !== undefined) row.finish_time = updates.finishTime;
  if (updates.totalTime !== undefined) row.total_time = updates.totalTime;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.startNumber !== undefined) row.start_number = updates.startNumber;

  const { error } = await supabase.from('hyrox_participants').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteParticipant(id: string): Promise<void> {
  const { error } = await supabase.from('hyrox_participants').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllParticipants(): Promise<void> {
  const { error: e1 } = await supabase.from('hyrox_participants').delete().neq('id', '');
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('hyrox_heats').delete().neq('id', '');
  if (e2) throw e2;
}

// Find participant by start number
export async function getParticipantByNumber(num: number): Promise<Participant | null> {
  const { data, error } = await supabase
    .from('hyrox_participants')
    .select('*')
    .eq('start_number', num)
    .single();

  if (error || !data) return null;
  return dbToParticipant(data);
}

// Finish participant by start number
export async function finishByNumber(num: number): Promise<Participant | null> {
  const p = await getParticipantByNumber(num);
  if (!p || p.status !== 'racing') return null;

  await finishParticipant(p.id);
  return p;
}

// ==================== HEATS ====================

export async function getHeats(): Promise<Heat[]> {
  const { data, error } = await supabase
    .from('hyrox_heats')
    .select('*')
    .order('heat_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(dbToHeat);
}

export async function saveHeats(heats: Heat[]): Promise<void> {
  // Delete old heats
  await supabase.from('hyrox_heats').delete().neq('id', '');

  if (heats.length === 0) return;

  const rows = heats.map((h) => ({
    id: h.id,
    heat_number: h.heatNumber,
    scheduled_time: h.scheduledTime,
    participant_ids: h.participantIds,
    status: h.status,
    start_time: h.startTime || null,
  }));

  const { error } = await supabase.from('hyrox_heats').insert(rows);
  if (error) throw error;

  // Update participant heat assignments
  for (const heat of heats) {
    for (const pid of heat.participantIds) {
      await supabase
        .from('hyrox_participants')
        .update({ heat_id: heat.id })
        .eq('id', pid);
    }
  }
}

export async function startHeat(heatId: string): Promise<void> {
  const now = Date.now();

  const { error: e1 } = await supabase
    .from('hyrox_heats')
    .update({ status: 'racing', start_time: now })
    .eq('id', heatId);
  if (e1) throw e1;

  const { data: heat } = await supabase
    .from('hyrox_heats')
    .select('participant_ids')
    .eq('id', heatId)
    .single();

  if (heat) {
    for (const pid of heat.participant_ids) {
      await supabase
        .from('hyrox_participants')
        .update({ status: 'racing', start_time: now })
        .eq('id', pid);
    }
  }
}

export async function finishParticipant(participantId: string): Promise<void> {
  const { data: p } = await supabase
    .from('hyrox_participants')
    .select('*')
    .eq('id', participantId)
    .single();

  if (!p || !p.start_time) throw new Error('Participant not found or not started');

  const now = Date.now();
  const totalTime = now - p.start_time;

  await supabase
    .from('hyrox_participants')
    .update({
      status: 'finished',
      finish_time: now,
      total_time: totalTime,
    })
    .eq('id', participantId);

  if (p.heat_id) {
    const { data: heat } = await supabase
      .from('hyrox_heats')
      .select('participant_ids')
      .eq('id', p.heat_id)
      .single();

    if (heat) {
      const { data: heatParticipants } = await supabase
        .from('hyrox_participants')
        .select('status')
        .in('id', heat.participant_ids);

      const allFinished = heatParticipants?.every((hp) => hp.status === 'finished');
      if (allFinished) {
        await supabase
          .from('hyrox_heats')
          .update({ status: 'finished' })
          .eq('id', p.heat_id);
      }
    }
  }
}

// ==================== GOOGLE SHEETS SYNC ====================

export async function syncFromGoogleSheet(sheetUrl: string): Promise<{
  added: number;
  existing: number;
  total: number;
}> {
  // Extract sheet ID from URL
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Ongeldige Google Sheets URL');
  const sheetId = match[1];

  // Fetch as CSV - most reliable method, works with "anyone with link" sharing
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error('Kan sheet niet laden. Staat de sheet op "Iedereen met de link"?');
  }
  const text = await res.text();

  // Parse CSV
  const lines = text.split('\n').map((line) => parseCSVLine(line));
  if (lines.length < 2) throw new Error('Sheet is leeg');

  // First row is headers
  const headers = lines[0].map((h) => h.toLowerCase().trim());
  const dataRows = lines.slice(1);

  // Find column indices from headers
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h.includes('ind') || h.includes('duo') || h === 'a') colMap.category = i;
    if (h.includes('divisie')) colMap.division = i;
    if (h.includes('naam')) colMap.name = i;
    if (h.includes('telefoon')) colMap.phone = i;
    if (h.includes('e-mail') || h.includes('email')) colMap.email = i;
    if (h.includes('geschatte') || h.includes('eindtijd')) colMap.estimatedTime = i;
  });

  // Fallback to position if headers don't match
  if (colMap.category === undefined) colMap.category = 0;
  if (colMap.division === undefined) colMap.division = 1;
  if (colMap.name === undefined) colMap.name = 2;
  if (colMap.phone === undefined) colMap.phone = 3;
  if (colMap.email === undefined) colMap.email = 4;
  if (colMap.estimatedTime === undefined) colMap.estimatedTime = 5;

  // Get existing participants to avoid duplicates
  const existing = await getParticipants();
  const existingKeys = new Set(
    existing.map((p) => p.name.toLowerCase().trim())
  );

  const { parseEstimatedTime, mapSheetCategory, mapSheetDivision } = await import('./types');

  const newParticipants: (Omit<Participant, 'id' | 'status' | 'startNumber'> & { startNumber?: number })[] = [];

  for (const row of dataRows) {
    const getVal = (col: number): string => (row[col] || '').trim();

    const name = getVal(colMap.name);
    if (!name) continue;

    if (existingKeys.has(name.toLowerCase().trim())) continue;

    newParticipants.push({
      name,
      division: mapSheetDivision(getVal(colMap.division)),
      category: mapSheetCategory(getVal(colMap.category)),
      estimatedTime: parseEstimatedTime(getVal(colMap.estimatedTime)),
      email: getVal(colMap.email) || undefined,
      phone: getVal(colMap.phone) || undefined,
    });
  }

  if (newParticipants.length > 0) {
    await addParticipantsBulk(newParticipants);
  }

  return {
    added: newParticipants.length,
    existing: existing.length,
    total: existing.length + newParticipants.length,
  };
}

// Parse a CSV line handling quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ==================== SETTINGS ====================

export async function getSettings() {
  const { data, error } = await supabase
    .from('hyrox_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return { startTimeBase: '09:00', heatInterval: 10, sheetUrl: '' };
  }

  return {
    startTimeBase: data.start_time_base,
    heatInterval: data.heat_interval,
    sheetUrl: data.sheet_url || '',
  };
}

export async function updateSettings(startTimeBase: string, heatInterval: number, sheetUrl?: string) {
  const updates: Record<string, unknown> = {
    start_time_base: startTimeBase,
    heat_interval: heatInterval,
  };
  if (sheetUrl !== undefined) updates.sheet_url = sheetUrl;

  await supabase
    .from('hyrox_settings')
    .update(updates)
    .eq('id', 1);
}

// ==================== HELPERS ====================

function dbToParticipant(row: Record<string, unknown>): Participant {
  return {
    id: row.id as string,
    startNumber: row.start_number as number,
    name: row.name as string,
    partnerName: (row.partner_name as string) || undefined,
    division: row.division as Participant['division'],
    category: row.category as Participant['category'],
    estimatedTime: row.estimated_time as number,
    heatId: (row.heat_id as string) || undefined,
    startTime: (row.start_time as number) || undefined,
    finishTime: (row.finish_time as number) || undefined,
    totalTime: (row.total_time as number) || undefined,
    status: row.status as Participant['status'],
    email: (row.email as string) || undefined,
    phone: (row.phone as string) || undefined,
  };
}

function dbToHeat(row: Record<string, unknown>): Heat {
  return {
    id: row.id as string,
    heatNumber: row.heat_number as number,
    scheduledTime: row.scheduled_time as string,
    participantIds: row.participant_ids as string[],
    status: row.status as Heat['status'],
    startTime: (row.start_time as number) || undefined,
  };
}
