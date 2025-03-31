/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createHubspotClient } from '@/app/lib/hubspot';
import { createEmailTemplate, getSFMCToken } from '@/app/lib/sfmc';
import { getIntegrationTokens } from '@/app/supabase/client';

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, hubspotToken, sfmcCredentials, limit = 10 } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Initialize with either stored token or directly provided token
    let hubspotAccessToken;
    
    // Use directly provided token if available (temporary mode)
    if (hubspotToken) {
      hubspotAccessToken = hubspotToken;
      console.log('Using hubspotToken from request');
    } else {
      // Get integration tokens from Supabase
      try {
        const hubspotTokens = await getIntegrationTokens(userId, 'hubspot');
        
        if (!hubspotTokens) {
          return NextResponse.json(
            { error: 'Missing HubSpot token. Please reconnect to HubSpot.' },
            { status: 400 }
          );
        }
        
        hubspotAccessToken = hubspotTokens.accessToken;
      } catch (error) {
        console.error('Error retrieving HubSpot tokens:', error);
        return NextResponse.json(
          { error: 'Database error retrieving HubSpot tokens.' },
          { status: 500 }
        );
      }
    }
    
    // Get SFMC tokens
    let sfmcAccessToken;
    
    // Use directly provided SFMC credentials if available
    if (sfmcCredentials && sfmcCredentials.clientId && sfmcCredentials.clientSecret && sfmcCredentials.subdomain) {
      console.log('Using direct SFMC credentials from request');
      try {
        // Get a new SFMC token using the provided credentials
        const tokenResponse = await getSFMCToken({
          clientId: sfmcCredentials.clientId,
          clientSecret: sfmcCredentials.clientSecret,
          subdomain: sfmcCredentials.subdomain
        });
        
        sfmcAccessToken = tokenResponse.accessToken;
      } catch (error) {
        console.error('Error getting SFMC token:', error);
        return NextResponse.json(
          { error: 'Failed to authenticate with SFMC using provided credentials.' },
          { status: 400 }
        );
      }
    } else {
      // Try to get tokens from database as fallback
      try {
        const sfmcTokens = await getIntegrationTokens(userId, 'sfmc');
        
        if (!sfmcTokens) {
          return NextResponse.json(
            { error: 'Missing SFMC credentials. Please connect SFMC.' },
            { status: 400 }
          );
        }
        
        sfmcAccessToken = sfmcTokens.accessToken;
      } catch (error) {
        console.error('Error retrieving SFMC tokens:', error);
        return NextResponse.json(
          { error: 'No SFMC credentials provided or found in database.' },
          { status: 400 }
        );
      }
    }

    // Initialize HubSpot client
    const hubspotClient = createHubspotClient(hubspotAccessToken);

    // Mock HubSpot email templates (replace with actual HubSpot API call)
    const templates = [
      { id: '1', name: 'Welcome Email', html: '<h1>Welcome to our service!</h1>' },
      { id: '2', name: 'Newsletter', html: '<h1>Latest Updates</h1>' }
    ];
    
    // Migration results
    const results = [];
    
    // SFMC default folder ID for Content Builder (typically use a dedicated folder)
    const folderId = 12345; // Replace with actual folder ID or create one dynamically
    
    // Migrate each template
    for (const template of templates) {
      // Create template in SFMC
      const result = await createEmailTemplate(
        {
          ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
          accessToken: sfmcAccessToken,
        },
        template.name,
        template.html,
        folderId
      );
      
      results.push({
        hubspotId: template.id,
        hubspotName: template.name,
        sfmcId: result.id,
        sfmcCustomerKey: result.customerKey,
        status: 'success'
      });
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${templates.length} templates`,
      migrated: results,
      templatesCount: templates.length
    });
    
  } catch (error) {
    console.error('Error in templates migration:', error);
    return NextResponse.json(
      { error: 'Failed to migrate email templates' },
      { status: 500 }
    );
  }
} 