import { NextRequest, NextResponse } from "next/server";
import { runBatch } from "../../../lib/batch";
import type { DiagnoseInput } from "../../../lib/agent";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { declines?: DiagnoseInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const declines = body.declines;
  if (!Array.isArray(declines) || declines.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty `declines` array." }, { status: 400 });
  }
  if (declines.length > 200) {
    return NextResponse.json({ error: "Batch too large (max 200)." }, { status: 400 });
  }

  const cleaned = declines
    .filter((d) => d && typeof d.raw === "string" && d.raw.trim())
    .map((d) => ({
      raw: String(d.raw).slice(0, 2000),
      amount: Number(d.amount) || 0,
      currency: d.currency ? String(d.currency).slice(0, 8) : undefined,
      method: d.method ? String(d.method).slice(0, 24) : undefined,
      attemptNumber: d.attemptNumber,
    }));

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "No valid declines (each needs a `raw` string)." }, { status: 400 });
  }

  return NextResponse.json(runBatch(cleaned));
}
