import { NextRequest, NextResponse } from 'next/server';

export function requireApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.DELIVERY_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'API não configurada (DELIVERY_API_KEY ausente).' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (token !== expected) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  return null;
}
