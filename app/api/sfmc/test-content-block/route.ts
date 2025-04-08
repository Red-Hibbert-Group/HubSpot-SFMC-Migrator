import { NextResponse } from 'next/server';
import { getSFMCToken } from '@/app/lib/sfmc';
import axios from 'axios';

// Define types for response structure
interface TestResults {
  emailStudioSearch: any;
  contentBuilderSearch: any;
  allAssets: any[];
  folderMap: Record<string, {
    folderName: string;
    emails: Array<{
      id: string;
      name: string;
      createdDate: string;
    }>;
  }>;
}

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { sfmcCredentials } = body;

    if (!sfmcCredentials || !sfmcCredentials.clientId || !sfmcCredentials.clientSecret || !sfmcCredentials.subdomain) {
      return NextResponse.json(
        { error: 'SFMC credentials are required' },
        { status: 400 }
      );
    }

    // Get SFMC token
    const tokenResponse = await getSFMCToken({
      clientId: sfmcCredentials.clientId,
      clientSecret: sfmcCredentials.clientSecret,
      subdomain: sfmcCredentials.subdomain
    });
    
    // Create a test API call to help find folders
    const results: TestResults = {
      emailStudioSearch: null,
      contentBuilderSearch: null,
      allAssets: [],
      folderMap: {}
    };
    
    try {
      // Attempt to search for a specific email in Content Builder
      const searchResponse = await axios.get(
        `https://${sfmcCredentials.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets/query?$filter=name%20like%20%27%25HubSpot%25%27`,
        {
          headers: {
            'Authorization': `Bearer ${tokenResponse.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      results.contentBuilderSearch = searchResponse.data;
    } catch (searchError) {
      results.contentBuilderSearch = { error: 'Failed to search Content Builder' };
    }
    
    // Try to get all Email folders with a different approach
    try {
      const folderResponse = await axios.post(
        `https://${sfmcCredentials.subdomain}.soap.marketingcloudapis.com/Service.asmx`,
        `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <soapenv:Header>
            <fueloauth>${tokenResponse.accessToken}</fueloauth>
          </soapenv:Header>
          <soapenv:Body>
            <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
              <RetrieveRequest>
                <ObjectType>DataFolder</ObjectType>
                <Properties>ID</Properties>
                <Properties>CustomerKey</Properties>
                <Properties>Name</Properties>
                <Properties>ParentFolder.ID</Properties>
                <Properties>ContentType</Properties>
              </RetrieveRequest>
            </RetrieveRequestMsg>
          </soapenv:Body>
        </soapenv:Envelope>`,
        {
          headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': 'Retrieve'
          }
        }
      );
      
      results.emailStudioSearch = folderResponse.data;
    } catch (folderError) {
      results.emailStudioSearch = { error: 'Failed to retrieve folders' };
    }
    
    // Get a list of emails to help troubleshoot
    try {
      const emailsResponse = await axios.get(
        `https://${sfmcCredentials.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets?$filter=assetType.name%20eq%20%27htmlemail%27`,
        {
          headers: {
            'Authorization': `Bearer ${tokenResponse.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      results.allAssets = emailsResponse.data.items || [];
      
      // Create a map of folder IDs to make it easier to locate emails
      const folderMap: Record<string, any> = {};
      
      if (Array.isArray(results.allAssets)) {
        results.allAssets.forEach((asset: any) => {
          if (asset && asset.category && asset.category.id) {
            const categoryId = asset.category.id.toString();
            
            if (!folderMap[categoryId]) {
              folderMap[categoryId] = {
                folderName: asset.category.name || 'Unknown',
                emails: []
              };
            }
            
            folderMap[categoryId].emails.push({
              id: asset.id,
              name: asset.name,
              createdDate: asset.createdDate
            });
          }
        });
      }
      
      results.folderMap = folderMap;
    } catch (assetsError) {
      console.error('Error fetching assets:', assetsError);
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in test-content-block endpoint:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to execute test API call',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 