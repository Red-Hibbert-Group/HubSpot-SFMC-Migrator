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

// Fetch marketing emails from HubSpot
export const getHubspotMarketingEmails = async (accessToken: string, limit = 100, after?: string) => {
  try {
    // Set a default start timestamp of 1 year ago (required parameter for the API)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    // Format as ISO string and then take only the date part (YYYY-MM-DD)
    const startTimestamp = oneYearAgo.toISOString().split('T')[0];
    
    // Build URL with required parameters
    let url = `https://api.hubapi.com/marketing/v3/emails/statistics/list?limit=${limit}&startTimestamp=${startTimestamp}`;
    if (after) {
      url += `&after=${after}`;
    }
    
    console.log(`Fetching marketing emails from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const emails = response.data.results || [];
    console.log(`Fetched ${emails.length} marketing emails`);
    
    // If there's pagination info and we need to fetch more
    if (response.data.paging && response.data.paging.next && response.data.paging.next.after) {
      const nextAfter = response.data.paging.next.after;
      console.log(`Found pagination info, fetching next page with after=${nextAfter}`);
      
      // Recursively fetch the next page
      const nextEmails = await getHubspotMarketingEmails(accessToken, limit, nextAfter);
      return [...emails, ...nextEmails];
    }
    
    return emails;
  } catch (error) {
    console.error('Error fetching HubSpot marketing emails:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
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