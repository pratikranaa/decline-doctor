import { NextRequest, NextResponse } from "next/server";
import { diagnose, type DiagnoseInput } from "../../../lib/agent";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: DiagnoseInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = (body.raw ?? "").toString().trim();
  if (!raw) {
    return NextResponse.json({ error: "Provide a `raw` failed-payment response." }, { status: 400 });
  }
  if (raw.length > 4000) {
    return NextResponse.json({ error: "Input too long (max 4000 chars)." }, { status: 400 });
  }

  try {
    const result = await diagnose({
      raw,
      amount: body.amount,
      currency: body.currency,
      method: body.method,
      attemptNumber: body.attemptNumber,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Diagnosis failed." }, { status: 500 });
  }
}
