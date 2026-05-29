import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ success: true, data: null });
}

export async function PATCH(_request: NextRequest) {
  return NextResponse.json({ success: true, data: { updated: true } });
}
