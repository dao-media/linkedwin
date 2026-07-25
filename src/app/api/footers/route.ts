import { NextResponse } from "next/server";
import {
  listSavedFooters,
  newFooterId,
  saveSavedFooters,
  type SavedFooter,
} from "@/lib/footers";

export async function GET() {
  const footers = await listSavedFooters();
  return NextResponse.json({ footers });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const footerBody = String(body.body ?? "").trim();
  if (!name || !footerBody) {
    return NextResponse.json(
      { error: "Name and footer text are required" },
      { status: 400 },
    );
  }

  const footers = await listSavedFooters();
  const next: SavedFooter = {
    id: newFooterId(),
    name,
    body: footerBody,
  };
  await saveSavedFooters([next, ...footers]);
  return NextResponse.json({ footer: next, footers: [next, ...footers] });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const name = String(body.name ?? "").trim();
  const footerBody = String(body.body ?? "").trim();
  if (!id || !name || !footerBody) {
    return NextResponse.json(
      { error: "Id, name, and footer text are required" },
      { status: 400 },
    );
  }

  const footers = await listSavedFooters();
  const index = footers.findIndex((f) => f.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "Footer not found" }, { status: 404 });
  }

  const updated = [...footers];
  updated[index] = { id, name, body: footerBody };
  await saveSavedFooters(updated);
  return NextResponse.json({ footer: updated[index], footers: updated });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "Id is required" }, { status: 400 });
  }

  const footers = await listSavedFooters();
  const next = footers.filter((f) => f.id !== id);
  if (next.length === footers.length) {
    return NextResponse.json({ error: "Footer not found" }, { status: 404 });
  }
  await saveSavedFooters(next);
  return NextResponse.json({ ok: true, footers: next });
}
