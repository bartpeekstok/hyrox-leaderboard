import { loadData, setHeats, saveData } from '../../lib/store';
import { generateHeats } from '../../lib/heat-scheduler';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = loadData();
  return Response.json({
    heats: data.heats,
    participants: data.participants,
    startTimeBase: data.startTimeBase,
    heatInterval: data.heatInterval,
  });
}

// Generate heats from current participants
export async function POST(request: Request) {
  const body = await request.json();
  const data = loadData();

  if (body.startTimeBase) data.startTimeBase = body.startTimeBase;
  if (body.heatInterval) data.heatInterval = body.heatInterval;
  saveData(data);

  const heats = generateHeats(
    data.participants,
    data.startTimeBase,
    data.heatInterval
  );

  const updatedData = setHeats(heats);
  return Response.json({
    heats: updatedData.heats,
    participants: updatedData.participants,
  });
}
