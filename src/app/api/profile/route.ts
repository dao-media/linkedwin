import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile";

export async function GET() {
  return NextResponse.json(await getProfile());
}
