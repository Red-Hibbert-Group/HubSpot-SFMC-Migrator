/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { 
  getHubspotMarketingEmails, 
  getHubspotEmailDetails, 
  getHubspotRenderedEmailContent,
  getHubspotEmailEditorContent,
  resolveHubspotDefaultContent,
  getHubspotEmailContentOfficial
} from '@/app/lib/hubspot';
import { 
  createSFMCTemplateEmail,
  createSFMCTemplateSoapEmail, 
  createSFMCEnhancedEmail,
  getSFMCToken, 
  getSFMCFolders, 
  createSFMCFolder, 
  getSFMCEmailFolders,
  isEmailStudioFolder,
  createSFMCClassicEmailInContentFolder
} from '@/app/lib/sfmc';
import { getIntegrationTokens } from '@/app/supabase/client';
import { convertHubspotEmail } from '@/app/utils/migrationUtils';
import axios from 'axios';

// Helper function to safely get nested properties from an object
const getNestedProperty = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
};

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

    // Modify where contentBuilderFolderId is initialized (around line 130)
    let contentBuilderFolderId = 0;
    // Default to a known visible Email Studio folder if possible - this helps emails be found in the UI
    const defaultVisibleFolderId = 14030; // Set this to a known folder ID in your account
    let skipContentBuilderSearch = false;
    let isEmailStudioFolderUsed = false;

    // If folderId is provided, use it
    if (folderId) {
      contentBuilderFolderId = folderId;
      console.log(`Using provided folder ID: ${contentBuilderFolderId}`);
      
      // If folder ID is 0, use a visible default instead
      if (contentBuilderFolderId === 0) {
        console.log(`Provided folder ID is 0 (default/root). Using a visible folder (${defaultVisibleFolderId}) instead`);
        contentBuilderFolderId = defaultVisibleFolderId;
      }
      
      // Check if the provided folder is an Email Studio folder
      try {
        isEmailStudioFolderUsed = await isEmailStudioFolder({
          ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
          accessToken: sfmcAccessToken,
        }, contentBuilderFolderId);
        
        if (isEmailStudioFolderUsed) {
          console.log(`Confirmed folder ID ${contentBuilderFolderId} is an Email Studio folder. Good choice for emails!`);
        } else {
          console.warn(`Folder ID ${contentBuilderFolderId} is a Content Builder folder, not an Email Studio folder. This may cause issues with SOAP API.`);
        }
      } catch (folderCheckError) {
        console.warn('Could not verify folder type:', folderCheckError);
      }
    } else {
      try {
        // First try to get Email Studio folders - these are more appropriate for emails
        console.log('Fetching Email Studio folders first...');
        try {
          const emailFolders = await getSFMCEmailFolders({
            ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
            accessToken: sfmcAccessToken,
          });
          
          console.log(`Found ${emailFolders.length} Email Studio folders`);
          
          // Find a suitable folder for HubSpot emails
          const suitableEmailFolder = emailFolders.find((folder: any) => 
            folder.name.toLowerCase().includes('hubspot') || 
            folder.name.toLowerCase().includes('imported') ||
            folder.name === 'My Emails' ||
            folder.name.toLowerCase().includes('email')
          );
          
          if (suitableEmailFolder) {
            contentBuilderFolderId = suitableEmailFolder.id;
            isEmailStudioFolderUsed = true;
            skipContentBuilderSearch = true; // Skip Content Builder folder search
            console.log(`Using Email Studio folder "${suitableEmailFolder.name}" with ID: ${contentBuilderFolderId}`);
          } else if (emailFolders.length > 0) {
            // Use the first available Email Studio folder
            contentBuilderFolderId = emailFolders[0].id;
            isEmailStudioFolderUsed = true;
            skipContentBuilderSearch = true;
            console.log(`Using first available Email Studio folder "${emailFolders[0].name}" with ID: ${contentBuilderFolderId}`);
          } else {
            console.log('No Email Studio folders found, continuing to check Content Builder folders');
          }
        } catch (emailFolderError) {
          console.warn('Error fetching Email Studio folders:', emailFolderError);
          console.log('Falling back to Content Builder folders');
        }
        
        // Only continue with Content Builder folders if we didn't find an Email Studio folder
        if (!skipContentBuilderSearch) {
          const foldersResponse = await getSFMCFolders({
            ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
            accessToken: sfmcAccessToken,
          });
          
          console.log(`Found ${foldersResponse.items.length} folders in SFMC`);
          
          // Find root content builder folder
          const contentBuilderFolder = foldersResponse.items.find((folder: any) => 
            folder.name === 'Content Builder'
          );
          
          if (!contentBuilderFolder) {
            console.log('Content Builder folder not found, using hardcoded default of 13172');
            // Fallback to common default Content Builder ID
            const contentBuilderId = 13172;
            
            // Try to find the HubSpot Emails folder directly
            const hubspotFolder = foldersResponse.items.find((folder: any) => 
              folder.name.toLowerCase() === 'hubspot emails' && 
              folder.parentId === contentBuilderId
            );
            
            if (hubspotFolder) {
              contentBuilderFolderId = hubspotFolder.id;
              console.log(`Found existing HubSpot Emails folder with ID: ${contentBuilderFolderId}`);
            } else {
              // Fall back to using the root Content Builder folder
              contentBuilderFolderId = contentBuilderId;
              console.log(`Using root Content Builder folder with ID: ${contentBuilderFolderId}`);
            }
          } else {
            // Normal path - using found Content Builder folder
            const contentBuilderId = contentBuilderFolder.id;
            console.log(`Found Content Builder folder with ID: ${contentBuilderId}`);
            
            // Find HubSpot Emails folder (case insensitive search)
            const hubspotFolder = foldersResponse.items.find((folder: any) => 
              folder.name.toLowerCase() === 'hubspot emails' && 
              folder.parentId === contentBuilderId
            );
            
            if (hubspotFolder) {
              contentBuilderFolderId = hubspotFolder.id;
              console.log(`Found existing HubSpot Emails folder with ID: ${contentBuilderFolderId}`);
            } else {
              try {
                // Create a new folder - wrap this in its own try/catch to handle existing folder error
                const newFolder = await createSFMCFolder(
                  {
                    ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
                    accessToken: sfmcAccessToken,
                  },
                  'HubSpot Emails',
                  contentBuilderId
                );
                
                contentBuilderFolderId = newFolder.id;
                console.log(`Created new HubSpot Emails folder with ID: ${contentBuilderFolderId}`);
              } catch (folderError: any) {
                console.warn(`Folder creation error: ${folderError.message}`);
                
                // Check if it's a "folder already exists" error
                if (folderError.response?.data?.message?.includes('Category already exists')) {
                  // If it's because folder already exists, search again
                  console.log('Folder already exists, searching again with all folders');
                  
                  // Look through all folders for any HubSpot Emails folder
                  const existingFolder = foldersResponse.items.find((folder: any) =>
                    folder.name.toLowerCase() === 'hubspot emails'
                  );
                  
                  if (existingFolder) {
                    contentBuilderFolderId = existingFolder.id;
                    console.log(`Found existing HubSpot Emails folder with ID: ${contentBuilderFolderId}`);
                  } else {
                    // Last resort, use the Content Builder root folder
                    contentBuilderFolderId = contentBuilderId;
                    console.log(`Using Content Builder root folder with ID: ${contentBuilderId}`);
                  }
                } else {
                  // For any other error, use Content Builder folder
                  contentBuilderFolderId = contentBuilderId;
                  console.log(`Using Content Builder root folder with ID: ${contentBuilderId} due to error`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error finding/creating SFMC folder:', error);
        return NextResponse.json(
          { 
            error: 'Failed to find or create a folder in SFMC. Please provide a valid folderId.',
            details: `We recommend using an Email Studio folder ID for better compatibility with the SOAP API. Content Builder folders may cause issues.`,
            possibleFolderIds: 'Please check your SFMC instance for valid Email Studio folder IDs.'
          },
          { status: 400 }
        );
      }
    }

    // Add a warning to the logs if not using an Email Studio folder
    if (!isEmailStudioFolderUsed) {
      console.warn('⚠️ WARNING: Using a Content Builder folder for emails may cause issues with the SOAP API. For best results, use an Email Studio folder.');
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
          
          console.log('Legacy API response structure:', 
            `Type: ${typeof response.data}, ` +
            `Keys: ${typeof response.data === 'object' ? Object.keys(response.data).join(', ') : 'N/A'}`
          );
          
          // Process the response from legacy API - ensure it's an array
          if (Array.isArray(response.data)) {
            marketingEmails = response.data;
          } else if (response.data && Array.isArray(response.data.objects)) {
            marketingEmails = response.data.objects;
          } else if (response.data && typeof response.data === 'object') {
            // If it's an object with any array property, try to use that
            const possibleArrayProps = Object.keys(response.data).filter(key => 
              Array.isArray(response.data[key]) && response.data[key].length > 0
            );
            
            if (possibleArrayProps.length > 0) {
              // Use the first array property found
              marketingEmails = response.data[possibleArrayProps[0]];
            } else {
              // Last resort - create an array with this single object if it has an id
              marketingEmails = response.data.id ? [response.data] : [];
            }
          } else {
            // Fallback to empty array if we can't find anything usable
            marketingEmails = [];
          }
          
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
            let campaigns = [];
            
            if (campaignsResponse.data && Array.isArray(campaignsResponse.data.campaigns)) {
              campaigns = campaignsResponse.data.campaigns;
            } else if (campaignsResponse.data && Array.isArray(campaignsResponse.data)) {
              campaigns = campaignsResponse.data;
            } else if (campaignsResponse.data && typeof campaignsResponse.data === 'object') {
              // Look for any array property
              const possibleArrayProps = Object.keys(campaignsResponse.data).filter(key => 
                Array.isArray(campaignsResponse.data[key]) && campaignsResponse.data[key].length > 0
              );
              
              if (possibleArrayProps.length > 0) {
                campaigns = campaignsResponse.data[possibleArrayProps[0]];
              } else {
                // Create single-item array if it has an id
                campaigns = campaignsResponse.data.id ? [campaignsResponse.data] : [];
              }
            } else {
              campaigns = [];
            }
            
            // Map the campaigns to a consistent format
            marketingEmails = campaigns.map((campaign: any) => ({
              id: campaign.id || campaign.campaignId || `campaign-${Date.now()}`,
              name: campaign.name || campaign.subject || 'Unnamed Campaign',
              subject: campaign.subject || campaign.name || 'No Subject',
              type: 'EMAIL',
              createdAt: campaign.lastUpdatedTime || campaign.createdAt || new Date().toISOString(),
              updatedAt: campaign.lastUpdatedTime || campaign.updatedAt || new Date().toISOString(),
              state: campaign.isPublished ? 'PUBLISHED' : 'DRAFT',
              // Add any other fields needed
            }));
            
            console.log(`Retrieved ${marketingEmails.length} emails from campaigns API`);
          } catch (campaignsError: any) {
            console.error('All email APIs failed:', campaignsError.message);
            
            // Last-ditch attempt: Try marketing-emails/v1/emails with the includeContent=true parameter
            try {
              console.log('Trying final fallback: v1/emails with includeContent parameter');
              const detailedResponse = await axios.get('https://api.hubapi.com/marketing-emails/v1/emails?includeContent=true', {
                headers: {
                  'Authorization': `Bearer ${hubspotAccessToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              console.log('Detailed emails API response structure:', 
                `Type: ${typeof detailedResponse.data}, ` +
                `Keys: ${typeof detailedResponse.data === 'object' ? Object.keys(detailedResponse.data).join(', ') : 'N/A'}`
              );
              
              // Process detailed response
              if (Array.isArray(detailedResponse.data)) {
                marketingEmails = detailedResponse.data;
              } else if (detailedResponse.data && Array.isArray(detailedResponse.data.objects)) {
                marketingEmails = detailedResponse.data.objects;
              } else {
                // If still not successful, give up
                throw new Error('Could not retrieve emails from any HubSpot API');
              }
              
              console.log(`Retrieved ${marketingEmails.length} emails from detailed emails API`);
            } catch (finalError: any) {
              console.error('All HubSpot email API attempts failed. Final error:', finalError.message);
              throw new Error('Failed to fetch marketing emails from all available HubSpot APIs');
            }
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
    if (!marketingEmails || marketingEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No marketing emails found in HubSpot',
        migrated: [],
        emailsCount: 0
      });
    }
    
    // Ensure marketingEmails is an array before using slice
    if (!Array.isArray(marketingEmails)) {
      console.warn('marketingEmails is not an array, converting to empty array');
      marketingEmails = [];
    }
    
    // Limit the number of emails to migrate
    const emailsToMigrate = marketingEmails.slice(0, limit);
    
    // Migration results
    const results = [];
    const errors = [];
    
    // Migrate each email
    for (const email of emailsToMigrate) {
      try {
        console.log(`Processing email: ${email.name} (ID: ${email.id})`);
        
        // Get email details from HubSpot
        const emailDetails = await getHubspotEmailDetails(hubspotAccessToken, email.id);
        
        if (!emailDetails) {
          errors.push({
            hubspotId: email.id,
            hubspotName: email.name || 'Unknown',
            error: 'Failed to get email details',
            status: 'error'
          });
          continue;
        }
        
        // Get rendered email content from HubSpot
        const renderedContent = await getHubspotRenderedEmailContent(hubspotAccessToken, email.id);
        
        // Get editor content from HubSpot (contains module content)
        let editorContent: any = null;
        try {
          editorContent = await getHubspotEmailEditorContent(hubspotAccessToken, email.id);
        } catch (editorErr) {
          console.log(`Could not get editor content for email ${email.id}: ${editorErr}`);
        }
        
        // Resolve default content for modules
        let moduleContent: Record<string, string> = {};
        
        // If we have editor content, extract module content
        if (editorContent && editorContent.modules) {
          // Properly resolve module content
          Object.entries(editorContent.modules).forEach(([moduleId, moduleData]: [string, any]) => {
            if (moduleData && moduleData.content) {
              moduleContent[moduleId] = typeof moduleData.content === 'string' 
                ? moduleData.content 
                : JSON.stringify(moduleData.content);
            }
          });
        }
        
        // Convert HubSpot email to SFMC format
        const convertedEmail = convertHubspotEmail(email, emailDetails);
        
        let result;
        
        // Choose the appropriate method based on folder type
        if (isEmailStudioFolderUsed) {
          // For Email Studio folders, use SOAP API for template-based emails (recommended approach)
          console.log(`Creating template-based email "${email.name}" via SOAP API (Email Studio folder)`);
          result = await createSFMCTemplateSoapEmail(
            {
              ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain, soapUsername: sfmcCredentials?.username, soapPassword: sfmcCredentials?.password },
              accessToken: sfmcAccessToken,
            },
            {
              name: email.name,
              subject: email.subject || `${email.name} (No Subject)`,
              content: convertedEmail.content,
              moduleContent: moduleContent,
              fromName: getNestedProperty(emailDetails, 'fromName') || 'Default Sender',
              fromEmail: getNestedProperty(emailDetails, 'fromEmail') || 'default@example.com',
            },
            contentBuilderFolderId
          );
          console.log(`Successfully created template-based email "${email.name}" in SFMC with ID: ${result.id} and template ID: ${result.templateId}`);
        } else {
          // For Content Builder folders, try to find a suitable Email Studio folder instead
          try {
            console.log(`Content Builder folder detected (ID: ${contentBuilderFolderId}). Using Content Builder with proper template structure.`);
            
            // Instead of trying to find Email Studio folders (which are failing with 404), 
            // use Content Builder folder but ensure we use the template-based approach
            try {
              console.log(`Creating template-based email "${email.name}" via SOAP API (using Content Builder folder)`);
              result = await createSFMCTemplateSoapEmail(
                {
                  ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
                  accessToken: sfmcAccessToken,
                },
                {
                  name: email.name,
                  subject: email.subject || `${email.name} (No Subject)`,
                  content: convertedEmail.content,
                  moduleContent: moduleContent,
                  fromName: getNestedProperty(emailDetails, 'fromName') || 'Default Sender',
                  fromEmail: getNestedProperty(emailDetails, 'fromEmail') || 'default@example.com',
                },
                contentBuilderFolderId
              );
              
              console.log(`Successfully created template-based email "${email.name}" in Content Builder using SOAP API with ID: ${result.id}`);
            } catch (soapError) {
              console.warn(`SOAP API template creation failed: ${soapError}`);
              
              // Fallback to classic email creation
              try {
                console.log(`Creating classic email "${email.name}" in Content Builder folder (with proper structure)`);
                result = await createSFMCClassicEmailInContentFolder(
                  {
                    ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
                    accessToken: sfmcAccessToken,
                    rest: {
                      accessToken: sfmcAccessToken,
                      baseUri: `https://${sfmcCredentials?.subdomain}.rest.marketingcloudapis.com/`
                    }
                  },
                  {
                    name: email.name,
                    subject: email.subject || `${email.name} (No Subject)`,
                    content: convertedEmail.content,
                    plainTextContent: email.name || "Text version",
                    fromName: getNestedProperty(emailDetails, 'fromName') || 'Default Sender',
                    fromEmail: getNestedProperty(emailDetails, 'fromEmail') || 'default@example.com',
                  },
                  contentBuilderFolderId.toString()
                );
                console.log(`Successfully created classic email "${email.name}" in Content Builder with ID: ${result.id}`);
              } catch (classicError) {
                console.warn(`Failed to create classic email, falling back to enhanced content builder: ${classicError}`);
                
                // Last fallback
                console.log(`Final fallback to enhanced Content Builder approach for "${email.name}"`);
                result = await createSFMCEnhancedEmail(
                  {
                    ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
                    accessToken: sfmcAccessToken,
                  },
                  {
                    name: email.name,
                    subject: email.subject || `${email.name} (No Subject)`,
                    content: convertedEmail.content,
                    moduleContent: moduleContent,
                    fromName: getNestedProperty(emailDetails, 'fromName') || 'Default Sender',
                    fromEmail: getNestedProperty(emailDetails, 'fromEmail') || 'default@example.com',
                  },
                  contentBuilderFolderId.toString()
                );
                console.log(`Successfully created enhanced Content Builder email "${email.name}" as final fallback with ID: ${result.id}`);
              }
            }
          } catch (emailFolderError) {
            console.warn(`Could not find Email Studio folder, falling back to classic email in Content Builder: ${emailFolderError}`);
            
            // Only as last resort, create classic email in Content Builder
            try {
              console.log(`Creating classic email "${email.name}" in Content Builder folder (with proper structure)`);
              result = await createSFMCClassicEmailInContentFolder(
                {
                  ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
                  accessToken: sfmcAccessToken,
                  rest: {
                    accessToken: sfmcAccessToken,
                    baseUri: `https://${sfmcCredentials?.subdomain}.rest.marketingcloudapis.com/`
                  }
                },
                {
                  name: email.name,
                  subject: email.subject || `${email.name} (No Subject)`,
                  content: convertedEmail.content,
                  plainTextContent: email.name || "Text version",
                  fromName: getNestedProperty(emailDetails, 'fromName') || 'Default Sender',
                  fromEmail: getNestedProperty(emailDetails, 'fromEmail') || 'default@example.com',
                },
                contentBuilderFolderId.toString()
              );
              console.log(`Successfully created classic email "${email.name}" in Content Builder with ID: ${result.id}`);
            } catch (classicError) {
              console.warn(`Failed to create classic email, falling back to enhanced content builder: ${classicError}`);
              
              // Last fallback
              console.log(`Final fallback to enhanced Content Builder approach for "${email.name}"`);
              result = await createSFMCEnhancedEmail(
                {
                  ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
                  accessToken: sfmcAccessToken,
                },
                {
                  name: email.name,
                  subject: email.subject || `${email.name} (No Subject)`,
                  content: convertedEmail.content,
                  moduleContent: moduleContent,
                  fromName: getNestedProperty(emailDetails, 'fromName') || 'Default Sender',
                  fromEmail: getNestedProperty(emailDetails, 'fromEmail') || 'default@example.com',
                },
                contentBuilderFolderId.toString()
              );
              console.log(`Successfully created enhanced Content Builder email "${email.name}" as final fallback with ID: ${result.id}`);
            }
          }
        }
        
        results.push({
          id: email.id,
          name: email.name,
          success: true,
          sfmcId: result.id,
          templateId: result.templateId
        });
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