/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createHubspotClient } from '@/app/lib/hubspot';
import { createJourney, getSFMCToken } from '@/app/lib/sfmc';
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

    // Mock HubSpot workflows (replace with actual HubSpot API call)
    const workflows = [
      { 
        id: '1', 
        name: 'Welcome Sequence', 
        steps: [
          { type: 'delay', duration: 0 },
          { type: 'email', templateId: 'welcome_email_1' },
          { type: 'delay', duration: 2 },
          { type: 'email', templateId: 'welcome_email_2' },
        ] 
      },
      { 
        id: '2', 
        name: 'Lead Nurturing', 
        steps: [
          { type: 'delay', duration: 1 },
          { type: 'email', templateId: 'lead_nurture_1' },
          { type: 'delay', duration: 3 },
          { type: 'email', templateId: 'lead_nurture_2' },
        ] 
      }
    ];
    
    // Migration results
    const results = [];
    
    // Migrate each workflow to an SFMC Journey
    for (const workflow of workflows) {
      // Map HubSpot workflow to SFMC Journey definition
      const journeyDefinition = {
        activities: workflow.steps.map((step, index) => {
          if (step.type === 'delay') {
            return {
              key: `wait_${index}`,
              name: `Wait ${step.duration} ${step.duration === 1 ? 'day' : 'days'}`,
              type: 'WAIT',
              waitDuration: {
                amount: step.duration,
                unit: 'DAYS'
              },
              nextActivities: index < workflow.steps.length - 1 ? [`step_${index + 1}`] : []
            };
          } else if (step.type === 'email') {
            return {
              key: `email_${index}`,
              name: `Send Email ${step.templateId}`,
              type: 'EMAILV2',
              emailId: step.templateId,
              nextActivities: index < workflow.steps.length - 1 ? [`step_${index + 1}`] : []
            };
          }
          return null;
        }).filter(Boolean)
      };
      
      // Create Journey in SFMC
      const result = await createJourney(
        {
          ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
          accessToken: sfmcAccessToken,
        },
        workflow.name,
        journeyDefinition
      );
      
      results.push({
        hubspotId: workflow.id,
        hubspotName: workflow.name,
        sfmcId: result.id,
        sfmcKey: result.key,
        status: 'success'
      });
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${workflows.length} workflows`,
      migrated: results,
      workflowsCount: workflows.length
    });
    
  } catch (error) {
    console.error('Error in workflows migration:', error);
    return NextResponse.json(
      { error: 'Failed to migrate workflows' },
      { status: 500 }
    );
  }
} 