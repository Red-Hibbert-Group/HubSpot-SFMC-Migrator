/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getSFMCToken, getSFMCEmailFolders } from '@/app/lib/sfmc';

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { sfmcCredentials } = body;

    if (!sfmcCredentials || !sfmcCredentials.clientId || !sfmcCredentials.clientSecret || !sfmcCredentials.subdomain) {
      return NextResponse.json(
        { error: 'SFMC credentials are required' },
        { status: 400 }
      );
    }

    // Get SFMC token
    const tokenResponse = await getSFMCToken({
      clientId: sfmcCredentials.clientId,
      clientSecret: sfmcCredentials.clientSecret,
      subdomain: sfmcCredentials.subdomain
    });
    
    // Get email folders
    const folders = await getSFMCEmailFolders({
      ...sfmcCredentials,
      accessToken: tokenResponse.accessToken
    });
    
    return NextResponse.json(folders);
  } catch (error: any) {
    console.error('Error getting SFMC email folders:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get SFMC email folders', 
        details: error.response?.data || (error instanceof Error ? error.message : String(error))
      },
      { status: 500 }
    );
  }
} 