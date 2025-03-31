/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createHubspotClient } from '@/app/lib/hubspot';
import { createCloudPage, getSFMCToken } from '@/app/lib/sfmc';
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

    // Mock HubSpot forms (replace with actual HubSpot API call)
    const forms = [
      { 
        id: '1', 
        name: 'Contact Form', 
        html: `
          <form>
            <div>
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required>
            </div>
            <div>
              <label for="name">Name</label>
              <input type="text" id="name" name="name" required>
            </div>
            <button type="submit">Submit</button>
          </form>
        ` 
      },
      { 
        id: '2', 
        name: 'Newsletter Signup', 
        html: `
          <form>
            <div>
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required>
            </div>
            <button type="submit">Subscribe</button>
          </form>
        ` 
      }
    ];
    
    // Migration results
    const results = [];
    
    // SFMC default folder ID for CloudPages (typically use a dedicated folder)
    const folderId = 12345; // Replace with actual folder ID or create one dynamically
    
    // Migrate each form to a CloudPage
    for (const form of forms) {
      // Create a CloudPage with the form in SFMC
      const cloudPageContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${form.name}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
              form { max-width: 500px; margin: 0 auto; }
              label { display: block; margin-bottom: 5px; }
              input { width: 100%; padding: 8px; margin-bottom: 15px; box-sizing: border-box; }
              button { background-color: #0078D4; color: white; border: none; padding: 10px 15px; cursor: pointer; }
            </style>
          </head>
          <body>
            <h1>${form.name}</h1>
            ${form.html}
          </body>
        </html>
      `;
      
      const result = await createCloudPage(
        {
          ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
          accessToken: sfmcAccessToken,
        },
        form.name,
        cloudPageContent,
        folderId
      );
      
      results.push({
        hubspotId: form.id,
        hubspotName: form.name,
        sfmcId: result.id,
        sfmcCustomerKey: result.customerKey,
        status: 'success'
      });
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${forms.length} forms`,
      migrated: results,
      formsCount: forms.length
    });
    
  } catch (error) {
    console.error('Error in forms migration:', error);
    return NextResponse.json(
      { error: 'Failed to migrate forms' },
      { status: 500 }
    );
  }
} 