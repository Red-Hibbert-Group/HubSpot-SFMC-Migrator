/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createHubspotClient, getHubspotTemplates } from '@/app/lib/hubspot';
import { createEmailTemplate, getSFMCToken } from '@/app/lib/sfmc';
import { getIntegrationTokens } from '@/app/supabase/client';
import { convertHubspotTemplate } from '@/app/utils/migrationUtils';
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

    // Initialize HubSpot client
    const hubspotClient = createHubspotClient(hubspotAccessToken);
    
    // Fetch HubSpot templates
    console.log('Fetching HubSpot templates...');
    const hubspotTemplates = await getHubspotTemplates(hubspotClient);
    
    // Filter email templates if needed
    const emailTemplates = hubspotTemplates.filter((template: any) => 
      // Include templates that are likely to be email templates
      template.type === 'EMAIL' || 
      template.categoryId === 'EMAIL' || 
      (template.labels && template.labels.includes('EMAIL'))
    );
    
    // Limit the number of templates to migrate
    const templateToMigrate = emailTemplates.slice(0, limit);
    
    // Log count of templates
    console.log(`Found ${hubspotTemplates.length} total templates, ${emailTemplates.length} email templates, migrating ${templateToMigrate.length}`);
    
    // If no templates found
    if (templateToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No email templates found to migrate',
        migrated: [],
        templatesCount: 0
      });
    }
    
    // SFMC default folder ID for Content Builder, use provided or default
    const contentBuilderFolderId = folderId || 12345; 
    
    // Migration results
    const results = [];
    const errors = [];
    
    // Migrate each template
    for (const template of templateToMigrate) {
      try {
        console.log(`Processing template: ${template.name} (ID: ${template.id})`);
        
        // Fetch the template content if not included
        let templateContent = template.source || template.content;
        
        if (!templateContent && template.id) {
          try {
            // Try to fetch template content from HubSpot
            const templateDetails = await axios.get(
              `https://api.hubapi.com/cms/v3/design-manager/templates/${template.id}`, 
              {
                headers: {
                  'Authorization': `Bearer ${hubspotAccessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            templateContent = templateDetails.data.source;
          } catch (error) {
            console.error(`Error fetching template content for ${template.name}:`, error);
            templateContent = `<p>Failed to fetch template content for ${template.name}</p>`;
          }
        }
        
        // Convert template to SFMC format
        const convertedTemplate = convertHubspotTemplate({
          ...template,
          source: templateContent || `<p>Template: ${template.name}</p>`
        });
        
        // Create template in SFMC
        const result = await createEmailTemplate(
          {
            ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
            accessToken: sfmcAccessToken,
          },
          template.name,
          convertedTemplate.content,
          contentBuilderFolderId,
          {
            channels: convertedTemplate.channels,
            slots: convertedTemplate.slots,
            assetType: { name: 'template', id: 4 }
          }
        );
        
        results.push({
          hubspotId: template.id,
          hubspotName: template.name,
          sfmcId: result.id,
          sfmcCustomerKey: result.customerKey,
          status: 'success'
        });
        
        console.log(`Successfully migrated template: ${template.name}`);
      } catch (error) {
        console.error(`Error migrating template ${template.name}:`, error);
        errors.push({
          hubspotId: template.id,
          hubspotName: template.name,
          error: error instanceof Error ? error.message : String(error),
          status: 'error'
        });
      }
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `Migrated ${results.length} templates successfully${errors.length > 0 ? `, with ${errors.length} errors` : ''}`,
      migrated: results,
      errors: errors.length > 0 ? errors : undefined,
      templatesCount: results.length,
      totalAttempted: templateToMigrate.length
    });
    
  } catch (error) {
    console.error('Error in templates migration:', error);
    return NextResponse.json(
      { error: 'Failed to migrate email templates', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 