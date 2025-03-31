import { NextResponse } from 'next/server';
import { getHubspotTokens } from '@/app/lib/hubspot';
import { supabase, storeIntegrationTokens } from '@/app/supabase/client';

export async function GET(request: Request) {
  // Parse the URL to get the code parameter
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return NextResponse.json(
      { error: 'No authorization code provided' },
      { status: 400 }
    );
  }

  try {
    // Exchange the code for access token
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing HubSpot configuration' },
        { status: 500 }
      );
    }

    // Get tokens from HubSpot
    const tokens = await getHubspotTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('Successfully received tokens from HubSpot');

    // Skip Supabase user creation and use temporary mode
    // Create a temporary ID and redirect to dashboard with tokens as query parameters
    const tempId = `temp_${Date.now()}`;
    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('userId', tempId);
    redirectUrl.searchParams.set('hubspotToken', tokens.accessToken);
    
    console.log('Redirecting to dashboard with temporary ID and token');
    return NextResponse.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Error authenticating with HubSpot:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with HubSpot' },
      { status: 500 }
    );
  }
} 