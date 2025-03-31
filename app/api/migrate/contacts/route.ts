import { NextResponse } from 'next/server';
import { createHubspotClient, getHubspotContacts, getHubspotLists } from '@/app/lib/hubspot';
import { createDataExtension, insertDataExtensionRows, getSFMCToken } from '@/app/lib/sfmc';
import { getIntegrationTokens } from '@/app/supabase/client';
import { mapContactFields, mapContactData } from '@/app/utils/migrationUtils';

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, hubspotToken, sfmcCredentials, limit = 100 } = body;

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

    // Fetch HubSpot contacts
    const contacts = await getHubspotContacts(hubspotClient, limit);
    
    // Fetch HubSpot lists if included in the request
    let lists: any[] = [];
    if (body.includeLists) {
      lists = await getHubspotLists(hubspotClient);
    }

    // Extract properties/fields from the first contact to determine schema
    if (contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contacts found to migrate',
        migrated: 0
      });
    }

    // Create the properties array from the first contact
    const propertyNames = Object.keys(contacts[0].properties);
    const properties = propertyNames.map(name => {
      return {
        name,
        type: typeof contacts[0].properties[name] === 'number' ? 'number' : 'string',
        required: name === 'email'
      };
    });

    // Map properties to SFMC data extension fields
    const fields = mapContactFields(properties);

    // Create data extension in SFMC
    const dataExtensionResponse = await createDataExtension(
      {
        ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
        accessToken: sfmcAccessToken,
      },
      'HubSpot_Contacts',
      fields
    );

    // Map contact data to SFMC format
    const sfmcContactData = mapContactData(contacts);

    // Insert contacts into data extension
    const insertResponse = await insertDataExtensionRows(
      {
        ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
        accessToken: sfmcAccessToken,
      },
      dataExtensionResponse.customerKey || dataExtensionResponse.key,
      sfmcContactData
    );

    // Create data extensions for lists if included
    let listMigrationResults: any[] = [];
    if (body.includeLists && lists.length > 0) {
      listMigrationResults = await Promise.all(
        lists.map(async (list: any) => {
          // Create a data extension for each list
          const listDEResponse = await createDataExtension(
            {
              ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
              accessToken: sfmcAccessToken,
            },
            `HubSpot_List_${list.name.replace(/\s+/g, '_')}`,
            [
              {
                name: 'EmailAddress',
                fieldType: 'EmailAddress',
                isRequired: true,
                isPrimaryKey: true
              },
              {
                name: 'DateAdded',
                fieldType: 'Date',
                isRequired: false
              }
            ]
          );

          // Return list migration info
          return {
            listId: list.listId,
            listName: list.name,
            dataExtensionKey: listDEResponse.customerKey || listDEResponse.key,
            status: 'created'
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${contacts.length} contacts`,
      dataExtension: {
        name: 'HubSpot_Contacts',
        key: dataExtensionResponse.customerKey || dataExtensionResponse.key
      },
      migrated: contacts.length,
      lists: listMigrationResults
    });
  } catch (error) {
    console.error('Error in contacts migration:', error);
    return NextResponse.json(
      { error: 'Failed to migrate contacts' },
      { status: 500 }
    );
  }
} 