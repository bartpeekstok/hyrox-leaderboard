import { loadData, addParticipant, updateParticipant, deleteParticipant, saveData } from '../../lib/store';
import { Participant } from '../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = loadData();
  return Response.json(data.participants);
}

export async function POST(request: Request) {
  const body = await request.json();

  // Support bulk import
  if (Array.isArray(body)) {
    const data = loadData();
    for (const item of body) {
      const participant: Participant = {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: item.name,
        partnerName: item.partnerName || undefined,
        division: item.division,
        category: item.category,
        estimatedTime: item.estimatedTime,
        status: 'registered',
      };
      data.participants.push(participant);
    }
    saveData(data);
    return Response.json(data.participants, { status: 201 });
  }

  const participant: Participant = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: body.name,
    partnerName: body.partnerName || undefined,
    division: body.division,
    category: body.category,
    estimatedTime: body.estimatedTime,
    status: 'registered',
  };

  const data = addParticipant(participant);
  return Response.json(participant, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, ...updates } = body;
  const data = updateParticipant(id, updates);
  return Response.json(data.participants.find((p) => p.id === id));
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id === 'all') {
    const data = loadData();
    data.participants = [];
    data.heats = [];
    saveData(data);
    return Response.json({ success: true });
  }

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  deleteParticipant(id);
  return Response.json({ success: true });
}
