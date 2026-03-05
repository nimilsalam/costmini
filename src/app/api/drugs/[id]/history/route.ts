import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ message: "Price history feature has been removed" }, { status: 410 });
}
