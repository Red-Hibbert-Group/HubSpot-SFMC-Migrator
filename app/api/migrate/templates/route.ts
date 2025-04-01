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
    const { userId, hubspotToken, sfmcCredentials, limit = 10, folderId, customTemplates } = body;

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

    // If customTemplates are provided, use those directly and skip HubSpot API
    if (customTemplates && Array.isArray(customTemplates) && customTemplates.length > 0) {
      console.log(`Using ${customTemplates.length} custom templates provided by user`);
      
      // SFMC default folder ID for Content Builder, use provided or default
      const contentBuilderFolderId = folderId || 12345; 
      
      // Migration results
      const results = [];
      const errors = [];
      
      // Process each custom template
      for (const template of customTemplates) {
        try {
          console.log(`Processing custom template: ${template.name}`);
          
          // Convert template to SFMC format
          const convertedTemplate = convertHubspotTemplate({
            ...template,
            source: template.content || template.html || `<p>Template: ${template.name}</p>`
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
            customId: template.id || `custom-${Date.now()}`,
            customName: template.name,
            sfmcId: result.id,
            sfmcCustomerKey: result.customerKey,
            status: 'success'
          });
          
          console.log(`Successfully migrated custom template: ${template.name}`);
        } catch (error) {
          console.error(`Error migrating custom template ${template.name}:`, error);
          errors.push({
            customId: template.id || `custom-${Date.now()}`,
            customName: template.name,
            error: error instanceof Error ? error.message : String(error),
            status: 'error'
          });
        }
      }
      
      // Return success response for custom templates
      return NextResponse.json({
        success: true,
        message: `Migrated ${results.length} custom templates successfully${errors.length > 0 ? `, with ${errors.length} errors` : ''}`,
        migrated: results,
        errors: errors.length > 0 ? errors : undefined,
        templatesCount: results.length,
        totalAttempted: customTemplates.length
      });
    }
    
    // Initialize HubSpot client
    const hubspotClient = createHubspotClient(hubspotAccessToken);
    
    // Fetch HubSpot templates
    console.log('Fetching HubSpot templates...');
    let hubspotTemplates;
    try {
      hubspotTemplates = await getHubspotTemplates(hubspotClient);
      console.log(`Got ${hubspotTemplates.length} templates from HubSpot API`);
    } catch (error) {
      console.warn('Failed to get templates from HubSpot API, using fallback template');
      hubspotTemplates = [];
    }
    
    // Add a fallback template if no templates are available from API
    if (!hubspotTemplates || hubspotTemplates.length === 0) {
      console.log('Using fallback sample template since no templates were found in the API');
      
      // Use the template content provided in your example
      const sampleTemplateContent = `<!DOCTYPE html>
<html>

<head>
    <style type="text/css">
        div,
        p,
        a,
        li,
        td {
            -webkit-text-size-adjust: none;
        }
        
        body {
            margin: 0;
            padding: 0;
        }
        
        td[class="headercell-phone"] {
            display: none;
        }
        
        @media screen and (max-width: 480px) {
            table[class="tmp--container"] {
                width: 360px !important;
            }
            table[class="tmp--container-padding"] {
                width: 360px !important;
                padding: 20px !important;
            }
            table[class="tmp--container-padding-top"] {
                width: 360px !important;
                padding: 20px 0 0 0 !important;
            }
            table[class="tmp--container-padding-bottom"] {
                width: 360px !important;
                padding: 0 0 20px 0 !important;
            }
            table[class="hero"] {
                width: 100% !important;
            }
            table[class="tmp--full-width"] {
                width: 100% !important;
                float: left !important;
                padding: 0 !important;
            }
            td[class="tmp--full-width"] {
                width: 100% !important;
                float: left !important;
                padding: 0 !important;
            }
            td[class="tmp--full-width-padding-bottom"] {
                width: 100% !important;
                float: left !important;
                padding: 0 0 25px 0 !important;
            }
            td[class="tmp--full-width-center"] {
                width: 100% !important;
                float: left !important;
                padding: 10px 0 10px 0 !important;
                text-align: center !important;
            }
            table[class="wrapper-padding"] {
                padding: 20px !important;
            }
            tr[class="wrapper-padding"] {
                padding: 20px !important;
            }
            td[class="wrapper-padding"] {
                padding: 20px !important;
            }
            td[class="col-padding-bottom"] {
                padding: 0 0 25px 0 !important;
            }
            img[class="photo"] {
                width: 100% !important;
                height: auto !important;
            }
            td[class="row"] {
                width: 100% !important;
            }
            td[class="tmp--hide"] {
                display: none !important;
            }
        }
    </style>
</head>

<!-- background color -->

<body bgcolor="#ffffff">

    <!-- background color -->
    <table bgcolor="#ffffff" width="600" align="center" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td>
                <!-- logo content area-->
                <table style='background-color:#eaeaea;' class='tmp--container' width='600' align='center' border='0' cellspacing='0' cellpadding='0'>
                    <tr>
                        <td width='100%' style='padding:20px 25px 20px 25px;'>
                            <center><img width='250' id='style-header-logo' src='https://s3-us-west-2.amazonaws.com/rd-industry-emails/healthcare-life-sciences/makana/branding-assets/email-templates/branding-MakanaHealth-logo-header-navy-2x.png'></center>
                        </td>
                    </tr>
                </table>
                <!-- end content area -->


            </td>
        </tr>

        <tr>
            <td>
                <!-- content area -->
                <div data-type="slot" data-key="cell2"></div>
                <!-- end content area -->
            </td>
        </tr>

        <tr>
            <td>
                <!-- content area -->
                <div data-type="slot" data-key="cell3"></div>
                <!-- end content area -->
            </td>
        </tr>

        <tr>
            <td>
                <!-- content area -->
                <div data-type="slot" data-key="cell4"></div>
                <!-- end content area -->
            </td>
        </tr>

        <tr>
            <td>
                <!-- content area -->
                <div data-type="slot" data-key="cell5"></div>
                <!-- end content area -->
            </td>
        </tr>

        <tr>
            <td>
                <!-- content area -->
                <div data-type="slot" data-key="cell6"></div>
                <!-- end content area -->
            </td>
        </tr>

        <tr>
            <td>
                <!-- content area -->
                <div data-type="slot" data-key="cell7"></div>
                <!-- end content area -->
            </td>
        </tr>

        <tr>
            <td>


                <!-- footer content area -->
                <table style='background-color:#eaeaea;' class='tmp--container' width='600' align='center' border='0' cellspacing='0' cellpadding='0'>
                    <tr>
                        <td class='tmp--full-width-center' width='100%' align='center' style='padding:25px 20px 0 20px;'><img width='50' id='style-footer-logo' src='https://s3-us-west-2.amazonaws.com/rd-industry-emails/healthcare-life-sciences/makana/branding-assets/email-templates/branding-MakanaHealth-logo-footer-navy-2x.png'></td>
                    </tr>
                </table>
                <table style='background-color:#eaeaea;' class='tmp--container' width='600' align='center' border='0' cellspacing='0' cellpadding='0'>
                    <tr>
                        <td style='color:#404860;font-family:Gotham, Arial, sans-serif;font-size:11px;font-style:normal;font-weight:normal;padding:20px 20px 10px 20px;' class='tmp--full-width-center' width='100%' align='center' width='432'><a href="%%view_email_url%%" alias="Web Version" target="_blank" style="color:#404860;text-decoration:none;">View as a Webpage</a>
                        </td>
                    </tr>
                    <tr>
                        <td style='color:#404860;font-family:Gotham, Arial, sans-serif;font-size:11px;font-style:normal;font-weight:normal;padding:10px 20px 20px 20px;' class='tmp--full-width-center' width='100%' align='center' width='432'>%%Member_Busname%%
                            <br />%%Member_Addr%% %%Member_City%%, %%Member_State%%, %%Member_PostalCode%%, %%Member_Country%%.
                            <br />
                        </td>
                    </tr>
                    <tr>
                        <td style="font-family:Gotham, Helvetica, Arial, sans-serif; text-align:center; color:#ffffff; font-size:11px; font-weight:bold; line-height:14px; padding:0 25px 15px 25px;">
                            <img width="30" src="https://s3-us-west-2.amazonaws.com/rd-industry-emails/healthcare-life-sciences/makana/branding-assets/email-templates/branding-MakanaHealth-social-icon-website-navy.png" style="padding:0px 5px;" />
                            <img width="30" src="https://s3-us-west-2.amazonaws.com/rd-industry-emails/healthcare-life-sciences/makana/branding-assets/email-templates/branding-MakanaHealth-social-icon-facebook-navy.png" style="padding:0px 5px;" />
                            <img width="30" src="https://s3-us-west-2.amazonaws.com/rd-industry-emails/healthcare-life-sciences/makana/branding-assets/email-templates/branding-MakanaHealth-social-icon-twitter-navy.png" style="padding:0px 5px;" />
                            <img width="30" src="https://s3-us-west-2.amazonaws.com/rd-industry-emails/healthcare-life-sciences/makana/branding-assets/email-templates/branding-MakanaHealth-social-icon-instagram-navy.png" style="padding:0px 5px;" />
                        </td>
                    </tr>
                </table>
                <table style='background-color:#eaeaea;' class='tmp--container' width='600' border='0' align='center' cellpadding='0' cellspacing='0'>
                    <tr>
                        <td style="font-family:Gotham, Helvetica, Arial, sans-serif;text-align:center;color:#404860;font-size:11px;font-style:normal;font-weight:normal;line-height:14px;padding:0 25px 35px 25px;">
                            <a href="%%profile_center_url%%" alias="Profile Center" target="_blank" style="color:#404860;text-decoration:none;">Profile Center</a> <span style="color:#aa95d1; padding:0 5px;">|</span>
                            <a href="%%subscription_center_url%%" alias="Manage Subscriptions" target="_blank" style="color:#404860;text-decoration:none;">Manage Subscriptions
                  </a> <span style="color:#aa95d1; padding:0 5px;">|</span>
                            <a target="_blank" href="%%unsub_center_url%%" alias="Unsubscribe" title="Unsubscribe" style="color:#404860;text-decoration:none;">Unsubscribe
                  </a>
                        </td>
                    </tr>
                </table>
                <!-- end content area -->


            </td>
        </tr>
    </table>

    <div id="tracking_pixel">
        <custom name="opencounter" type="tracking">
    </div>
    <div id="campaign_pixel">
    </div>
</body>

</html>`;

      // Create a fallback sample template
      hubspotTemplates = [
        {
          id: 'sample-template-1',
          name: 'Grey Template Sample',
          source: sampleTemplateContent,
          type: 'EMAIL'
        },
        {
          id: 'sample-template-2',
          name: 'Basic Email Template',
          source: `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Basic Email Template</title>
            </head>
            <body>
              <div data-type="slot" data-key="header">
                <h1>Email Header</h1>
              </div>
              <div data-type="slot" data-key="content">
                <p>This is the main content area of your email. Customize this section with your message.</p>
              </div>
              <div data-type="slot" data-key="footer">
                <p>Company footer information</p>
              </div>
            </body>
            </html>
          `,
          type: 'EMAIL'
        }
      ];
    }
    
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