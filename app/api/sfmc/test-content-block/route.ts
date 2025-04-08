import { NextResponse } from 'next/server';
import { getSFMCToken, testContentBlockById } from '@/app/lib/sfmc';

export async function POST(request: Request) {
  try {
    // Get the content block ID and SFMC credentials from the request
    const requestData = await request.json();
    const { contentBlockId, sfmcCredentials } = requestData;

    if (!contentBlockId) {
      return NextResponse.json(
        { error: 'Content Block ID is required.' },
        { status: 400 }
      );
    }

    if (!sfmcCredentials) {
      return NextResponse.json(
        { error: 'SFMC credentials are required.' },
        { status: 400 }
      );
    }

    // Get a fresh SFMC token
    const tokenResponse = await getSFMCToken(sfmcCredentials);
    const sfmcAccessToken = tokenResponse.accessToken;

    // Test retrieving content block by ID
    const contentBlock = await testContentBlockById(
      {
        ...sfmcCredentials,
        accessToken: sfmcAccessToken,
      },
      Number(contentBlockId)
    );

    return NextResponse.json({
      success: true,
      message: `Successfully retrieved content block: ${contentBlock.name}`,
      contentBlock
    });
  } catch (error: any) {
    console.error('Error testing content block by ID:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to test content block retrieval', 
        details: error.message,
        response: error.response?.data
      },
      { status: 500 }
    );
  }
} 