import { loadData, startHeat, finishParticipant } from '../../lib/store';

export const dynamic = 'force-dynamic';

// Get full race state
export async function GET() {
  const data = loadData();
  return Response.json(data);
}

// Race actions: start heat or finish participant
export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === 'start_heat') {
    const data = startHeat(body.heatId);
    return Response.json(data);
  }

  if (body.action === 'finish_participant') {
    const data = finishParticipant(body.participantId);
    return Response.json(data);
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
