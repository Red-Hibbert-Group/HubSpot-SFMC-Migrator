/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

// This is a test endpoint to see if the callback works
export async function GET(request: Request) {
  console.log('Debug Callback Route Called:', request.url);
  
  // Parse the URL and log query parameters
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  
  console.log('Callback parameters:', JSON.stringify(params, null, 2));
  
  // Redirect to our main page if needed
  const redirectUrl = new URL('/dashboard', request.url);
  
  return NextResponse.json({
    message: 'Debug callback route received a request',
    params,
    url: request.url
  });
} 