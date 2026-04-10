import { loadData, importData } from '../../lib/store';

export const dynamic = 'force-dynamic';

// Export all data as JSON
export async function GET() {
  const data = loadData();
  return Response.json(data);
}

// Import data from JSON
export async function POST(request: Request) {
  const body = await request.json();
  importData(body);
  return Response.json({ success: true, participants: body.participants?.length || 0 });
}
