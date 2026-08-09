import { NextResponse } from "next/server";
import { runMonitoringJob } from "@/lib/monitoring/runDailyJob";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runMonitoringJob();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
