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
    const response = await axios.get('https://api.hubapi.com/cms/v3/design-manager/templates', {
      headers: {
        Authorization: `Bearer ${client.accessToken}`
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching HubSpot templates:', error);
    throw error;
  }
};

export const getHubspotForms = async (client: Client) => {
  try {
    const response = await axios.get('https://api.hubapi.com/forms/v2/forms', {
      headers: {
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
        Authorization: `Bearer ${client.accessToken}`
      }
    });
    return response.data.workflows;
  } catch (error) {
    console.error('Error fetching HubSpot workflows:', error);
    throw error;
  }
}; 