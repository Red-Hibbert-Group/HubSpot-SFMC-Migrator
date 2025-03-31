import { NextResponse } from 'next/server';
import { getSFMCToken } from '@/app/lib/sfmc';
import { storeIntegrationTokens } from '@/app/supabase/client';

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { clientId, clientSecret, subdomain, userId } = body;

    if (!clientId || !clientSecret || !subdomain || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get SFMC token
    const tokenResponse = await getSFMCToken({
      clientId,
      clientSecret,
      subdomain,
    });

    // Store token in Supabase
    await storeIntegrationTokens(userId, 'sfmc', {
      accessToken: tokenResponse.accessToken,
      expiresAt: tokenResponse.expiresAt,
      clientId,
      clientSecret,
      subdomain,
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to SFMC',
    });
  } catch (error) {
    console.error('Error connecting to SFMC:', error);
    return NextResponse.json(
      { error: 'Failed to connect to SFMC' },
      { status: 500 }
    );
  }
} 