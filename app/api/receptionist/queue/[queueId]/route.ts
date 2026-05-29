import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(_request: NextRequest, context: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await context.params;
  return NextResponse.json({ success: true, data: { queueId, updated: true } });
}
