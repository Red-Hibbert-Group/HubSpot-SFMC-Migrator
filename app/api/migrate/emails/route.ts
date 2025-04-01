/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getHubspotMarketingEmails, getHubspotEmailDetails } from '@/app/lib/hubspot';
import { createSFMCEmail, getSFMCToken, getSFMCFolders, createSFMCFolder } from '@/app/lib/sfmc';
import { getIntegrationTokens } from '@/app/supabase/client';
import { convertHubspotEmail } from '@/app/utils/migrationUtils';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, hubspotToken, sfmcCredentials, limit = 10, folderId } = body;

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

    // Get or create a folder in SFMC Content Builder
    let contentBuilderFolderId;
    
    // If folderId is provided, use it
    if (folderId) {
      contentBuilderFolderId = folderId;
      console.log(`Using provided folder ID: ${contentBuilderFolderId}`);
    } else {
      try {
        // Get folders from SFMC
        const foldersResponse = await getSFMCFolders({
          ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
          accessToken: sfmcAccessToken,
        });
        
        // Find root content builder folder
        const contentBuilderFolder = foldersResponse.items.find((folder: any) => 
          folder.name === 'Content Builder'
        );
        
        if (!contentBuilderFolder) {
          throw new Error('Content Builder folder not found');
        }
        
        // Find or create a "HubSpot Emails" folder
        const hubspotFolder = foldersResponse.items.find((folder: any) => 
          folder.name === 'HubSpot Emails' && 
          folder.parentId === contentBuilderFolder.id
        );
        
        if (hubspotFolder) {
          contentBuilderFolderId = hubspotFolder.id;
          console.log(`Found existing HubSpot Emails folder with ID: ${contentBuilderFolderId}`);
        } else {
          // Create a new folder
          const newFolder = await createSFMCFolder(
            {
              ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
              accessToken: sfmcAccessToken,
            },
            'HubSpot Emails',
            contentBuilderFolder.id
          );
          
          contentBuilderFolderId = newFolder.id;
          console.log(`Created new HubSpot Emails folder with ID: ${contentBuilderFolderId}`);
        }
      } catch (error) {
        console.error('Error finding/creating SFMC folder:', error);
        return NextResponse.json(
          { error: 'Failed to find or create a folder in SFMC. Please provide a valid folderId.' },
          { status: 400 }
        );
      }
    }

    // Fetch marketing emails from HubSpot
    console.log('Fetching marketing emails from HubSpot...');
    let marketingEmails = [];
    
    try {
      // Fetch the marketing emails with statistics
      try {
        marketingEmails = await getHubspotMarketingEmails(hubspotAccessToken, limit);
        console.log(`Retrieved ${marketingEmails.length} marketing emails from statistics endpoint`);
      } catch (statsError: any) {
        console.warn('Error fetching from statistics endpoint, trying legacy endpoint:', statsError.message);
        
        // Try the legacy marketing emails endpoint instead
        try {
          console.log('Trying legacy marketing emails API');
          const response = await axios.get('https://api.hubapi.com/marketing-emails/v1/emails', {
            headers: {
              'Authorization': `Bearer ${hubspotAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Process the response from legacy API
          marketingEmails = response.data || [];
          console.log(`Retrieved ${marketingEmails.length} marketing emails from legacy API`);
        } catch (legacyError: any) {
          console.error('Legacy email API failed:', legacyError.message);
          
          // Try campaigns API as final fallback
          try {
            console.log('Trying campaigns API as final fallback');
            const campaignsResponse = await axios.get('https://api.hubapi.com/email/public/v1/campaigns', {
              headers: {
                'Authorization': `Bearer ${hubspotAccessToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            // Process campaigns which contain email data
            const campaigns = campaignsResponse.data?.campaigns || campaignsResponse.data || [];
            marketingEmails = campaigns.map((campaign: any) => ({
              id: campaign.id || campaign.campaignId,
              name: campaign.name,
              subject: campaign.subject,
              type: 'EMAIL',
              createdAt: campaign.lastUpdatedTime,
              updatedAt: campaign.lastUpdatedTime,
              state: campaign.isPublished ? 'PUBLISHED' : 'DRAFT',
              // Add any other fields needed
            }));
            
            console.log(`Retrieved ${marketingEmails.length} emails from campaigns API`);
          } catch (campaignsError: any) {
            console.error('All email APIs failed:', campaignsError.message);
            throw new Error('Failed to fetch marketing emails from all available HubSpot APIs');
          }
        }
      }
      
      console.log(`Retrieved a total of ${marketingEmails.length} marketing emails from HubSpot`);
    } catch (error: any) {
      console.error('Error fetching marketing emails from HubSpot:', error);
      
      // Get details about the error
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch marketing emails from HubSpot API. Please check your token and permissions.',
          details: error.response?.data || error.message
        },
        { status: 500 }
      );
    }
    
    // If no emails found
    if (marketingEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No marketing emails found in HubSpot',
        migrated: [],
        emailsCount: 0
      });
    }
    
    // Limit the number of emails to migrate
    const emailsToMigrate = marketingEmails.slice(0, limit);
    
    // Migration results
    const results = [];
    const errors = [];
    
    // Migrate each email
    for (const email of emailsToMigrate) {
      try {
        console.log(`Processing email: ${email.name || 'Unknown'} (ID: ${email.id})`);
        
        // Get detailed email content if available
        let emailDetails = null;
        try {
          emailDetails = await getHubspotEmailDetails(hubspotAccessToken, email.id);
          console.log(`Retrieved detailed content for email ID ${email.id}`);
        } catch (detailsError: any) {
          console.warn(`Could not retrieve detailed content for email ID ${email.id}:`, detailsError.message);
          // Continue with basic info only
        }
        
        // Convert HubSpot email to SFMC format
        const convertedEmail = convertHubspotEmail(email, emailDetails);
        
        // Create email in SFMC
        const result = await createSFMCEmail(
          {
            ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
            accessToken: sfmcAccessToken,
          },
          convertedEmail,
          contentBuilderFolderId
        );
        
        results.push({
          hubspotId: email.id,
          hubspotName: email.name || 'Unnamed Email',
          sfmcId: result.id,
          sfmcCustomerKey: result.customerKey,
          subject: convertedEmail.subject,
          status: 'success'
        });
        
        console.log(`Successfully migrated email: ${email.name || 'Unnamed Email'}`);
      } catch (error) {
        console.error(`Error migrating email ${email.name || 'Unknown'}:`, error);
        errors.push({
          hubspotId: email.id,
          hubspotName: email.name || 'Unknown',
          error: error instanceof Error ? error.message : String(error),
          status: 'error'
        });
      }
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `Migrated ${results.length} emails successfully${errors.length > 0 ? `, with ${errors.length} errors` : ''}`,
      migrated: results,
      errors: errors.length > 0 ? errors : undefined,
      emailsCount: results.length,
      totalAttempted: emailsToMigrate.length
    });
    
  } catch (error) {
    console.error('Error in emails migration:', error);
    return NextResponse.json(
      { error: 'Failed to migrate marketing emails', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 