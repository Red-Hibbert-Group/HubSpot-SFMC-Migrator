/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Client } from '@hubspot/api-client';
import axios from 'axios';

// Initialize HubSpot client
export const createHubspotClient = (accessToken: string) => {
  return new Client({ accessToken });
};

// HubSpot OAuth URLs
export const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
export const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

// Auth helpers
export const getHubspotAuthUrl = (clientId: string, redirectUri: string) => {
  const scopes = ['contacts', 'content', 'forms', 'automation'];
  
  return `${HUBSPOT_AUTH_URL}?client_id=${clientId}&scope=${scopes.join(' ')}&redirect_uri=${redirectUri}`;
};

export const getHubspotTokens = async (
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
) => {
  const data = new URLSearchParams();
  data.append('grant_type', 'authorization_code');
  data.append('client_id', clientId);
  data.append('client_secret', clientSecret);
  data.append('redirect_uri', redirectUri);
  data.append('code', code);

  try {
    const response = await axios.post(HUBSPOT_TOKEN_URL, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Error getting HubSpot tokens:', error);
    throw error;
  }
};

export const refreshHubspotToken = async (
  refreshToken: string,
  clientId: string,
  clientSecret: string
) => {
  const data = new URLSearchParams();
  data.append('grant_type', 'refresh_token');
  data.append('client_id', clientId);
  data.append('client_secret', clientSecret);
  data.append('refresh_token', refreshToken);

  try {
    const response = await axios.post(HUBSPOT_TOKEN_URL, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Error refreshing HubSpot token:', error);
    throw error;
  }
};

// Data fetching helpers
export const getHubspotContacts = async (client: Client, limit = 100) => {
  try {
    const apiResponse = await client.crm.contacts.basicApi.getPage(limit);
    return apiResponse.results;
  } catch (error) {
    console.error('Error fetching HubSpot contacts:', error);
    throw error;
  }
};

export const getHubspotLists = async (client: Client) => {
  try {
    // Using axios directly as the SDK might not have full support for lists
    const response = await axios.get('https://api.hubapi.com/contacts/v1/lists', {
      headers: {
        // @ts-ignore - Using client accessToken property
        Authorization: `Bearer ${client.accessToken}`
      }
    });
    return response.data.lists;
  } catch (error) {
    console.error('Error fetching HubSpot lists:', error);
    throw error;
  }
};

export const getHubspotTemplates = async (client: Client) => {
  try {
    // First try the v3 endpoint
    try {
      const response = await axios.get('https://api.hubapi.com/cms/v3/design-manager/templates', {
        headers: {
          // @ts-ignore - Using client accessToken property
          Authorization: `Bearer ${client.accessToken}`
        }
      });
      return response.data.results || [];
    } catch (v3Error) {
      console.log('V3 template API failed, trying legacy endpoint');
      
      // Fall back to legacy endpoint (v2)
      try {
        const response = await axios.get('https://api.hubapi.com/content/api/v2/templates', {
          headers: {
            // @ts-ignore - Using client accessToken property
            Authorization: `Bearer ${client.accessToken}`
          }
        });
        return response.data.objects || [];
      } catch (v2Error) {
        console.log('V2 template API also failed, trying marketing email templates');
        
        // Try the email templates endpoint
        const response = await axios.get('https://api.hubapi.com/marketing-emails/v1/templates', {
          headers: {
            // @ts-ignore - Using client accessToken property
            Authorization: `Bearer ${client.accessToken}`
          }
        });
        return response.data || [];
      }
    }
  } catch (error) {
    console.error('Error fetching HubSpot templates:', error);
    // Return empty array instead of throwing to prevent API failure
    return [];
  }
};

// Get marketing emails from HubSpot with proper timestamp handling
export const getHubspotMarketingEmails = async (accessToken: string, limit: number = 100): Promise<any[]> => {
  try {
    console.log('Fetching marketing emails from HubSpot...');
    
    // Calculate dates for filtering
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    
    // Format timestamps to epoch milliseconds (numbers, not strings)
    const startTimestamp = twoYearsAgo.getTime();
    // Don't include endTimestamp - it was causing the API error
    
    // Build URL with just the startTimestamp parameter
    const url = `https://api.hubapi.com/marketing/v3/emails/statistics/list?limit=${limit}&startTimestamp=${startTimestamp}`;
    
    console.log(`Fetching marketing emails from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && Array.isArray(response.data.results)) {
      console.log(`Retrieved ${response.data.results.length} marketing emails from statistics endpoint`);
      return response.data.results;
    } else {
      throw new Error('Unexpected response format from marketing emails API');
    }
  } catch (error: any) {
    console.error('Error fetching HubSpot marketing emails:', error);
    console.error('Response status:', error.response?.status);
    console.error('Response data:', error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data');
    
    console.log('Error fetching from statistics endpoint, trying legacy endpoint:', error.message);
    
    // Try the legacy marketing emails endpoint as fallback
    try {
      console.log('Trying legacy marketing emails API');
      const legacyUrl = `https://api.hubapi.com/marketing-emails/v1/emails`;
      
      const legacyResponse = await axios.get(legacyUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (legacyResponse.data) {
        const responseType = typeof legacyResponse.data;
        const responseKeys = responseType === 'object' ? Object.keys(legacyResponse.data) : [];
        console.log(`Legacy API response structure: Type: ${responseType}, Keys: ${responseKeys.join(', ')}`);
        
        if (Array.isArray(legacyResponse.data.objects)) {
          const emails = legacyResponse.data.objects.slice(0, limit);
          console.log(`Retrieved ${emails.length} marketing emails from legacy API`);
          return emails;
        } else {
          throw new Error('Unexpected response format from legacy marketing emails API');
        }
      } else {
        throw new Error('No data returned from legacy marketing emails API');
      }
    } catch (legacyError: any) {
      console.error('Error fetching from legacy endpoint:', legacyError.message);
      
      // If both methods fail, return an empty array
      return [];
    }
  }
};

// Get details for a specific marketing email
export const getHubspotEmailDetails = async (accessToken: string, emailId: string) => {
  try {
    // First try the standard endpoint without any parameters
    try {
      console.log(`Fetching email details from primary endpoint for ID ${emailId}`);
      const response = await axios.get(`https://api.hubapi.com/marketing-emails/v1/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check if we have emailBody content
      if (response.data && response.data.emailBody) {
        console.log(`Email details successfully retrieved with emailBody content (${response.data.emailBody.length} characters)`);
      } else {
        console.log(`Email details retrieved but no emailBody content found, will try alternative endpoints`);
      }
      
      return response.data;
    } catch (primaryError: any) {
      console.warn(`Error with primary endpoint: ${primaryError.message}, trying with includeContent parameter`);
      
      // Try with includeContent parameter as fallback
      try {
        const response = await axios.get(`https://api.hubapi.com/marketing-emails/v1/emails/${emailId}?includeContent=true`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`Retrieved email details with includeContent parameter`);
        return response.data;
      } catch (contentError: any) {
        console.warn(`Error with includeContent parameter: ${contentError.message}, trying HTML endpoint`);
        
        // Try the dedicated HTML endpoint as last resort
        try {
          const htmlResponse = await axios.get(`https://api.hubapi.com/marketing-emails/v1/emails/${emailId}/html`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Create a minimal details object with the HTML content
          return {
            id: emailId,
            htmlBody: htmlResponse.data,
            name: 'Email ' + emailId,
            // Add minimal fields needed for conversion
            subject: 'Email ' + emailId
          };
        } catch (htmlError: any) {
          console.error(`All email content retrieval methods failed for ID ${emailId}`);
          throw new Error(`Could not retrieve email content through any available method: ${htmlError.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error(`Error fetching details for email ID ${emailId}:`, error.message);
    throw error;
  }
};

export const getHubspotForms = async (client: Client) => {
  try {
    const response = await axios.get('https://api.hubapi.com/forms/v2/forms', {
      headers: {
        // @ts-ignore - Using client accessToken property
        Authorization: `Bearer ${client.accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching HubSpot forms:', error);
    throw error;
  }
};

export const getHubspotWorkflows = async (client: Client) => {
  try {
    const response = await axios.get('https://api.hubapi.com/automation/v3/workflows', {
      headers: {
        // @ts-ignore - Using client accessToken property
        Authorization: `Bearer ${client.accessToken}`
      }
    });
    return response.data.workflows;
  } catch (error) {
    console.error('Error fetching HubSpot workflows:', error);
    throw error;
  }
};

// Get rendered HTML content for a HubSpot marketing email
export const getHubspotRenderedEmailContent = async (accessToken: string, emailId: string): Promise<string> => {
  try {
    console.log(`Fetching rendered content for email ID ${emailId} using direct content approach`);
    
    // Instead of using the preview endpoint that's failing, get content directly from email details
    const detailsUrl = `https://api.hubapi.com/marketing-emails/v1/emails/${emailId}`;
    
    const response = await axios.get(detailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data) {
      // Use different properties depending on what's available
      if (response.data.htmlContent) {
        console.log(`Got HTML content (${response.data.htmlContent.length} chars) from details endpoint`);
        return response.data.htmlContent;
      } else if (response.data.emailBody) {
        console.log(`Got email body content (${response.data.emailBody.length} chars) from details endpoint`);
        return response.data.emailBody;
      } else if (response.data.body) {
        console.log(`Got body content (${response.data.body.length} chars) from details endpoint`);
        return response.data.body;
      } else {
        console.warn(`Email content not found in response for ID ${emailId}`);
        return `<div>Email content not available (ID: ${emailId})</div>`;
      }
    } else {
      console.warn(`No data returned for email ID ${emailId}`);
      return `<div>Email content not available (ID: ${emailId})</div>`;
    }
  } catch (error: any) {
    console.error(`Error fetching rendered email content for ID ${emailId}:`, error.message);
    
    // Try alternative approach
    try {
      console.log(`Trying alternative details endpoint for email ID ${emailId}`);
      
      // Alternative endpoint
      const alternativeUrl = `https://api.hubapi.com/marketing/v3/emails/${emailId}`;
      
      const altResponse = await axios.get(alternativeUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (altResponse.data && altResponse.data.htmlContent) {
        console.log(`Got HTML content from alternative endpoint (${altResponse.data.htmlContent.length} chars)`);
        return altResponse.data.htmlContent;
      } else {
        throw new Error('No HTML content in alternative endpoint response');
      }
    } catch (altError: any) {
      console.error(`Alternative endpoint also failed for ID ${emailId}:`, altError.message);
      throw error; // Throw the original error
    }
  }
};

// Get email content from Editor API
export const getHubspotEmailEditorContent = async (accessToken: string, emailId: string) => {
  try {
    console.log(`Trying to get email content from Editor API for ID ${emailId}`);
    // Use the Editor API endpoint which might have more content details
    const editorUrl = `https://api.hubapi.com/marketing-emails/v1/emails/${emailId}/edit`;
    
    const response = await axios.get(editorUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Editor API response received with keys: ${Object.keys(response.data).join(', ')}`);
    
    // Check for content in various locations within the response
    if (response.data.body && response.data.body.html) {
      console.log(`Found HTML content in body.html field (${response.data.body.html.length} characters)`);
      return response.data.body.html;
    } 
    else if (response.data.body && response.data.body.content) {
      console.log(`Found content in body.content field (${response.data.body.content.length} characters)`);
      return response.data.body.content;
    }
    else if (response.data.metaData && response.data.metaData.htmlBody) {
      console.log(`Found content in metaData.htmlBody field (${response.data.metaData.htmlBody.length} characters)`);
      return response.data.metaData.htmlBody;
    }
    else if (response.data.content) {
      console.log(`Found content in content field (${response.data.content.length} characters)`);
      return response.data.content;
    }
    
    // If we couldn't find content in expected fields, try to extract from the whole response
    const responseStr = JSON.stringify(response.data);
    const htmlMatch = responseStr.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
    if (htmlMatch && htmlMatch[0]) {
      console.log(`Found HTML content in full response (${htmlMatch[0].length} characters)`);
      return htmlMatch[0];
    }
    
    console.log(`Could not find usable content in Editor API response`);
    return '';
  } catch (error: any) {
    console.error(`Error accessing Editor API for email ID ${emailId}:`, error.message);
    return '';
  }
};

// Try to resolve content_attribute placeholders using the default content endpoint
export const resolveHubspotDefaultContent = async (accessToken: string, emailId: string) => {
  try {
    console.log(`Trying to resolve default content for email ID ${emailId}`);
    
    // Try to get default email content from the email defaults endpoint
    const defaultsUrl = `https://api.hubapi.com/marketing-emails/v1/emails/${emailId}/defaults`;
    
    const response = await axios.get(defaultsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Default content response received with keys: ${Object.keys(response.data).join(', ')}`);
    
    // Look for default_email_body property
    if (response.data.default_email_body) {
      console.log(`Found default_email_body content (${response.data.default_email_body.length} characters)`);
      return response.data.default_email_body;
    }
    
    // If not found in expected field, search for it in the full response
    const responseStr = JSON.stringify(response.data);
    if (responseStr.includes('default_email_body')) {
      const match = responseStr.match(/"default_email_body"\s*:\s*"([^"]*)"/);
      if (match && match[1]) {
        const content = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        console.log(`Extracted default_email_body from full response (${content.length} characters)`);
        return content;
      }
    }
    
    console.log(`Could not find default content in response`);
    return '';
  } catch (error: any) {
    console.error(`Error getting default content for email ID ${emailId}:`, error.message);
    return '';
  }
};

// Get email content using the Content API (official documented method)
export const getHubspotEmailContentOfficial = async (accessToken: string, emailId: string) => {
  try {
    console.log(`Fetching email content using official Content API for ID ${emailId}`);
    
    // First get email entity to obtain contentId
    const emailResponse = await axios.get(`https://api.hubapi.com/marketing/v3/emails/${emailId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Check if we have the contentId reference needed for the Content API
    if (!emailResponse.data || !emailResponse.data.contentId) {
      console.warn(`Could not find contentId for email ${emailId}`);
      // Try getting content directly from the email entity
      if (emailResponse.data && emailResponse.data.content) {
        const content = typeof emailResponse.data.content === 'string' 
          ? emailResponse.data.content 
          : JSON.stringify(emailResponse.data.content);
        console.log(`Found content directly in email entity (${content.length} characters)`);
        return content;
      }
      
      throw new Error(`Email ${emailId} does not have contentId reference`);
    }
    
    const contentId = emailResponse.data.contentId;
    console.log(`Found contentId: ${contentId} for email ${emailId}`);
    
    // Now fetch the actual content using the contentId
    const contentResponse = await axios.get(`https://api.hubapi.com/marketing/v3/email-content/${contentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!contentResponse.data) {
      throw new Error(`No content data returned for contentId ${contentId}`);
    }
    
    // The content should be in the htmlContent field
    if (contentResponse.data.htmlContent) {
      console.log(`Successfully retrieved HTML content (${contentResponse.data.htmlContent.length} characters)`);
      return contentResponse.data.htmlContent;
    } 
    
    // Try to find content in other places if htmlContent is not available
    if (contentResponse.data.rawHtmlContent) {
      console.log(`Using rawHtmlContent field (${contentResponse.data.rawHtmlContent.length} characters)`);
      return contentResponse.data.rawHtmlContent;
    }
    
    if (contentResponse.data.bodies && contentResponse.data.bodies.html) {
      console.log(`Using bodies.html field (${contentResponse.data.bodies.html.length} characters)`);
      return contentResponse.data.bodies.html;
    }
    
    console.warn(`Content exists but couldn't find HTML in expected fields`);
    console.log(`Available fields in content: ${Object.keys(contentResponse.data).join(', ')}`);
    
    // Last resort - return the string representation of the entire content object
    return JSON.stringify(contentResponse.data);
  } catch (error: any) {
    console.error(`Error fetching official email content for ID ${emailId}:`, error.message);
    
    // Try alternative documented approach - the single send API
    try {
      console.log(`Trying single send content endpoint for email ${emailId}`);
      const singleSendResponse = await axios.get(`https://api.hubapi.com/marketing/v3/transactional/single-sends/${emailId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (singleSendResponse.data && singleSendResponse.data.emailContent) {
        console.log(`Found content in single send API response`);
        return singleSendResponse.data.emailContent;
      }
    } catch (singleSendError: any) {
      console.warn(`Single send API failed: ${singleSendError.message}`);
    }
    
    throw new Error(`Failed to retrieve email content via official Content API: ${error.message}`);
  }
}; 