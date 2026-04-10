import { supabase } from './supabase';
import { Participant, Heat } from './types';

// ==================== PARTICIPANTS ====================

export async function getParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('hyrox_participants')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(dbToParticipant);
}

export async function addParticipant(p: Omit<Participant, 'id' | 'status'>): Promise<Participant> {
  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const row = {
    id,
    name: p.name,
    partner_name: p.partnerName || null,
    division: p.division,
    category: p.category,
    estimated_time: p.estimatedTime,
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
  items: Omit<Participant, 'id' | 'status'>[]
): Promise<void> {
  const rows = items.map((p) => ({
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${Math.random().toString(36).slice(2, 4)}`,
    name: p.name,
    partner_name: p.partnerName || null,
    division: p.division,
    category: p.category,
    estimated_time: p.estimatedTime,
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

  // Update heat
  const { error: e1 } = await supabase
    .from('hyrox_heats')
    .update({ status: 'racing', start_time: now })
    .eq('id', heatId);
  if (e1) throw e1;

  // Update participants in this heat
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
  // Get participant to calculate total time
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

  // Check if all participants in heat are finished
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

// ==================== SETTINGS ====================

export async function getSettings() {
  const { data, error } = await supabase
    .from('hyrox_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return { startTimeBase: '09:00', heatInterval: 10 };
  }

  return {
    startTimeBase: data.start_time_base,
    heatInterval: data.heat_interval,
  };
}

export async function updateSettings(startTimeBase: string, heatInterval: number) {
  await supabase
    .from('hyrox_settings')
    .update({ start_time_base: startTimeBase, heat_interval: heatInterval })
    .eq('id', 1);
}

// ==================== HELPERS ====================

function dbToParticipant(row: Record<string, unknown>): Participant {
  return {
    id: row.id as string,
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
