/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

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

  // Redirect to our main OAuth endpoint with the code
  const redirectUrl = new URL('/api/auth/hubspot', request.url);
  redirectUrl.searchParams.set('code', code);
  
  console.log('Redirecting from callback to main auth endpoint:', redirectUrl.toString());
  return NextResponse.redirect(redirectUrl);
} 