import { NextResponse } from "next/server";
import {
  syncFromGoogleSheet,
  getSettings,
  getParticipants,
  saveHeats,
} from "../../lib/store";
import { generateHeats } from "../../lib/heat-scheduler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Skip on public-only deploy: both Vercel projects share this repo, but
  // the cron only needs to run once.
  if (process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true") {
    return NextResponse.json({ skipped: "public deploy" });
  }

  // Vercel cron sends Authorization: Bearer <CRON_SECRET>. Reject anything else.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const settings = await getSettings();
    if (!settings.sheetUrl) {
      return NextResponse.json(
        { error: "No sheet URL configured" },
        { status: 400 }
      );
    }

    const syncResult = await syncFromGoogleSheet(settings.sheetUrl);

    let heatsRegenerated = false;
    if (syncResult.added > 0) {
      const participants = await getParticipants();
      const newHeats = generateHeats(
        participants,
        settings.startTimeBase,
        settings.heatInterval
      );
      await saveHeats(newHeats);
      heatsRegenerated = true;
    }

    return NextResponse.json({
      success: true,
      added: syncResult.added,
      total: syncResult.total,
      heatsRegenerated,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
