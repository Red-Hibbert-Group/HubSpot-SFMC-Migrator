/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createHubspotClient, getHubspotForms } from '@/app/lib/hubspot';
import { createCloudPage, getSFMCToken, getSFMCFolders, createSFMCFolder, createDataExtension } from '@/app/lib/sfmc';
import { getIntegrationTokens } from '@/app/supabase/client';

// Define interfaces locally instead of importing from a missing module
interface Folder {
  id: number;
  name: string;
  parentId?: number | null;
  [key: string]: any;
}

interface HubSpotFormField {
  name: string;
  label?: string;
  fieldType?: string;
  required?: boolean;
  options?: Array<{value: string; label?: string}>;
  helpText?: string;
  [key: string]: any;
}

interface HubSpotFormFieldGroup {
  fields?: HubSpotFormField[];
  [key: string]: any;
}

interface HubSpotForm {
  guid?: string;
  name?: string;
  formFieldGroups?: HubSpotFormFieldGroup[];
  metaData?: {
    description?: string;
    [key: string]: any;
  };
  redirectUrl?: string;
  [key: string]: any;
}

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

    // Get actual HubSpot forms data
    console.log('Fetching forms from HubSpot...');
    const forms = await getHubspotForms(hubspotClient);
    console.log(`Found ${forms.length} forms in HubSpot`);
    
    if (!forms || forms.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No forms found in HubSpot account',
      }, { status: 400 });
    }

    // Migration results
    const results = [];
    
    // Get or create SFMC folder for CloudPages
    let folderId;
    try {
      console.log('Getting SFMC folders to find/create CloudPages folder');
      const auth = {
        ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
        accessToken: sfmcAccessToken,
      };
      
      // Try to find a Web & Mobile folder first (where CloudPages typically live)
      const allFolders = await getSFMCFolders(auth);
      const webFolder = allFolders.items.find((f: Folder) => 
        f.name.toLowerCase().includes('web') || 
        f.name.toLowerCase().includes('cloud')
      );
      
      if (webFolder) {
        console.log(`Found Web/CloudPages folder: ${webFolder.name} (ID: ${webFolder.id})`);
        folderId = webFolder.id;
      } else {
        // Create a dedicated folder for migrated forms
        console.log('Creating new folder for migrated HubSpot forms');
        const folderResult = await createSFMCFolder(auth, 'Migrated HubSpot Forms');
        folderId = folderResult.id;
        console.log(`Created new folder with ID: ${folderId}`);
      }
    } catch (folderError) {
      console.error('Error setting up SFMC folder:', folderError);
      return NextResponse.json({
        error: 'Failed to set up SFMC folder for CloudPages',
      }, { status: 500 });
    }
    
    // Process only up to the limit
    const formsToMigrate = forms.slice(0, limit);
    
    // Create the required Data Extension for form submissions if it doesn't exist
    try {
      console.log('Creating or confirming HubSpot_Form_Submissions Data Extension');
      await createDataExtension(
        {
          ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
          accessToken: sfmcAccessToken,
        },
        'HubSpot_Form_Submissions',
        [
          { name: 'FormName', fieldType: 'Text', maxLength: 200, isPrimaryKey: false, isRequired: true },
          { name: 'FormId', fieldType: 'Text', maxLength: 100, isPrimaryKey: false, isRequired: true },
          { name: 'SubmissionDate', fieldType: 'Date', isPrimaryKey: false, isRequired: true },
          { name: 'FormData', fieldType: 'Text', maxLength: 4000, isPrimaryKey: false, isRequired: true }
        ]
      );
      console.log('Data Extension setup complete');
    } catch (deError: any) {
      // If there's an error but it says the DE already exists, we can continue
      if (deError.message && deError.message.includes('already exists')) {
        console.log('Data Extension already exists, continuing with migration');
      } else {
        console.error('Error setting up Data Extension:', deError);
        // We can still try to continue even if this fails
      }
    }
    
    // Migrate each form to a CloudPage
    for (const form of formsToMigrate) {
      try {
        console.log(`Processing form: ${form.name} (ID: ${form.guid})`);
        
        // Generate form field HTML
        const formFieldHtml = generateFormFieldsHtml(form);
        
        // Create a CloudPage with the form in SFMC
        const cloudPageContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${escapeHtml(form.name || '')}</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                form { max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #ddd; border-radius: 5px; }
                .form-group { margin-bottom: 20px; }
                label { display: block; margin-bottom: 8px; font-weight: bold; }
                input, select, textarea { width: 100%; padding: 10px; margin-bottom: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
                textarea { min-height: 100px; }
                button { background-color: #0078D4; color: white; border: none; padding: 12px 20px; cursor: pointer; font-size: 16px; border-radius: 4px; }
                button:hover { background-color: #005a9e; }
                .error { color: red; font-size: 14px; }
                .success { color: green; text-align: center; padding: 20px; font-size: 18px; }
                .form-description { margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <form id="sfmcForm" data-form-id="${escapeHtml(form.guid || '')}">
                <h2>${escapeHtml(form.name || '')}</h2>
                <div class="form-description">${escapeHtml(form.metaData?.description || '')}</div>
                
                ${formFieldHtml}
                
                <div class="form-group">
                  <button type="submit">Submit</button>
                </div>
              </form>
              
              <div id="formSuccess" class="success" style="display:none;">
                Thank you for your submission!
                ${form.redirectUrl ? `<p>You will be redirected shortly...</p>` : ''}
              </div>

              <script runat="server">
                Platform.Load("core", "1.1.1");
                
                // Handle form submission
                if(Request.Method == "POST") {
                  try {
                    // Try-catch for Data Extension operations
                    try {
                      // Create Data Extension record
                      var de = DataExtension.Init("HubSpot_Form_Submissions");
                      var data = {
                        FormName: "${escapeHtml(form.name || '')}",
                        FormId: "${escapeHtml(form.guid || '')}",
                        SubmissionDate: Platform.Function.SystemDateToLocalDate(Now()),
                        FormData: Platform.Function.Stringify(Request.GetPostData())
                      };
                      
                      var result = de.Rows.Add(data);
                      Write("<script>document.getElementById('sfmcForm').style.display = 'none'; document.getElementById('formSuccess').style.display = 'block';</script>");
                      
                      ${form.redirectUrl ? `Write("<script>setTimeout(function() { window.location.href = '${escapeHtml(form.redirectUrl)}'; }, 3000);</script>");` : ''}
                    } catch(deError) {
                      // Log error but don't show to user
                      Write("<script>console.error('Data Extension error: ' + '" + deError + "');</script>");
                      // Still show success to user
                      Write("<script>document.getElementById('sfmcForm').style.display = 'none'; document.getElementById('formSuccess').style.display = 'block';</script>");
                    }
                  } catch(e) {
                    Write("<div class='error'>Error processing form: " + Stringify(e) + "</div>");
                  }
                }
              </script>
              
              <script>
                // Client-side form validation
                document.getElementById('sfmcForm').addEventListener('submit', function(e) {
                  var form = this;
                  var requiredFields = form.querySelectorAll('[required]');
                  var valid = true;
                  
                  // Remove any existing error messages
                  var errors = form.querySelectorAll('.error-message');
                  for(var i = 0; i < errors.length; i++) {
                    errors[i].parentNode.removeChild(errors[i]);
                  }
                  
                  // Check each required field
                  for(var i = 0; i < requiredFields.length; i++) {
                    var field = requiredFields[i];
                    if(!field.value.trim()) {
                      valid = false;
                      var errorMsg = document.createElement('div');
                      errorMsg.className = 'error-message';
                      errorMsg.style.color = 'red';
                      errorMsg.textContent = 'This field is required';
                      field.parentNode.insertBefore(errorMsg, field.nextSibling);
                    }
                  }
                  
                  if(!valid) {
                    e.preventDefault();
                  }
                });
              </script>
            </body>
          </html>
        `;
        
        console.log(`Creating CloudPage for form: ${form.name} (ID: ${form.guid})`);
        console.log(`Using folder ID: ${folderId}`);
        
        try {
          // Create the cloud page in SFMC
          const result = await createCloudPage(
            {
              ...{ clientId: sfmcCredentials?.clientId, clientSecret: sfmcCredentials?.clientSecret, subdomain: sfmcCredentials?.subdomain },
              accessToken: sfmcAccessToken,
            },
            form.name,
            cloudPageContent,
            folderId
          );
          
          console.log(`CloudPage creation successful. Result:`, JSON.stringify(result, null, 2));
          
          results.push({
            hubspotId: form.guid,
            hubspotName: form.name,
            sfmcId: result.id,
            sfmcCustomerKey: result.customerKey,
            sfmcUrl: result.views?.html?.url || '',
            status: 'success'
          });
          
          console.log(`Successfully migrated form: ${form.name}`);
        } catch (cloudPageError: any) {
          console.error(`Error creating CloudPage for form ${form.name}:`, cloudPageError);
          if (cloudPageError.response) {
            console.error('Response status:', cloudPageError.response.status);
            console.error('Response data:', JSON.stringify(cloudPageError.response.data, null, 2));
          }
          
          results.push({
            hubspotId: form.guid,
            hubspotName: form.name,
            error: cloudPageError.message || 'Unknown error creating CloudPage',
            status: 'error'
          });
        }
      } catch (formError: any) {
        console.error(`Error migrating form ${form.name}:`, formError);
        results.push({
          hubspotId: form.name || 'Unknown form',
          hubspotName: form.name || 'Unknown form',
          error: formError.message || 'Unknown error processing form',
          status: 'error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Migrated ${results.filter(r => r.status === 'success').length} of ${formsToMigrate.length} forms to SFMC CloudPages`,
      results
    });
    
  } catch (error: any) {
    console.error('Error in /api/migrate/forms:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred',
    }, { status: 500 });
  }
}

// Helper function to generate form field HTML based on HubSpot form fields
function generateFormFieldsHtml(form: HubSpotForm): string {
  if (!form.formFieldGroups || !Array.isArray(form.formFieldGroups)) {
    return '<div class="form-group"><p>No form fields found</p></div>';
  }
  
  let html = '';
  
  for (const group of form.formFieldGroups) {
    if (group.fields && Array.isArray(group.fields)) {
      for (const field of group.fields) {
        html += generateFieldHtml(field);
      }
    }
  }
  
  return html;
}

// Generate HTML for a single form field
function generateFieldHtml(field: HubSpotFormField): string {
  let fieldHtml = '';
  
  // Start form group div
  fieldHtml += `<div class="form-group">\n`;
  
  // Add label
  fieldHtml += `  <label for="${field.name}">${field.label || field.name}${field.required ? ' *' : ''}</label>\n`;
  
  // Generate the appropriate input based on field type
  switch (field.fieldType) {
    case 'textarea':
      fieldHtml += `  <textarea id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}></textarea>\n`;
      break;
      
    case 'select':
      fieldHtml += `  <select id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      fieldHtml += `    <option value="">-- Select --</option>\n`;
      
      if (field.options && Array.isArray(field.options)) {
        for (const option of field.options) {
          fieldHtml += `    <option value="${option.value}">${option.label || option.value}</option>\n`;
        }
      }
      
      fieldHtml += `  </select>\n`;
      break;
      
    case 'checkbox':
      if (field.options && Array.isArray(field.options)) {
        for (const option of field.options) {
          fieldHtml += `  <div class="checkbox-option">\n`;
          fieldHtml += `    <input type="checkbox" id="${field.name}_${option.value}" name="${field.name}" value="${option.value}">\n`;
          fieldHtml += `    <label for="${field.name}_${option.value}">${option.label || option.value}</label>\n`;
          fieldHtml += `  </div>\n`;
        }
      } else {
        fieldHtml += `  <div class="checkbox-option">\n`;
        fieldHtml += `    <input type="checkbox" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
        fieldHtml += `    <label for="${field.name}">${field.label || field.name}</label>\n`;
        fieldHtml += `  </div>\n`;
      }
      break;
      
    case 'radio':
      if (field.options && Array.isArray(field.options)) {
        for (const option of field.options) {
          fieldHtml += `  <div class="radio-option">\n`;
          fieldHtml += `    <input type="radio" id="${field.name}_${option.value}" name="${field.name}" value="${option.value}" ${field.required ? 'required' : ''}>\n`;
          fieldHtml += `    <label for="${field.name}_${option.value}">${option.label || option.value}</label>\n`;
          fieldHtml += `  </div>\n`;
        }
      }
      break;
      
    case 'email':
      fieldHtml += `  <input type="email" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      break;
      
    case 'number':
      fieldHtml += `  <input type="number" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      break;
      
    case 'date':
      fieldHtml += `  <input type="date" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      break;
      
    case 'phone':
      fieldHtml += `  <input type="tel" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      break;
      
    case 'file':
      fieldHtml += `  <input type="file" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      break;
      
    case 'text':
    default:
      fieldHtml += `  <input type="text" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>\n`;
      break;
  }
  
  // Add field description if available
  if (field.helpText) {
    fieldHtml += `  <div class="field-help">${field.helpText}</div>\n`;
  }
  
  // Close form group div
  fieldHtml += `</div>\n`;
  
  return fieldHtml;
}

// Helper function to escape HTML special characters
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
} 