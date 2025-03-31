/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */

import axios from 'axios';

// SFMC Auth
export interface SFMCAuth {
  clientId: string;
  clientSecret: string;
  subdomain: string;
  accessToken?: string;
  expiresAt?: number;
}

// SFMC token endpoint
export const getSFMCTokenUrl = (subdomain: string) => 
  `https://${subdomain}.auth.marketingcloudapis.com/v2/token`;

// Get SFMC access token
export const getSFMCToken = async (auth: SFMCAuth) => {
  try {
    const response = await axios.post(
      getSFMCTokenUrl(auth.subdomain),
      {
        grant_type: 'client_credentials',
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
    };
  } catch (error) {
    console.error('Error getting SFMC token:', error);
    throw error;
  }
};

// SOAP API endpoint
export const getSoapEndpoint = (subdomain: string) => 
  `https://${subdomain}.soap.marketingcloudapis.com/Service.asmx`;

// Helper function to escape XML content
const escapeXml = (unsafe: string): string => {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Create a SOAP envelope for SFMC
const createSoapEnvelope = (action: string, content: string, endpoint: string, token: string) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <s:Header>
        <a:Action s:mustUnderstand="1">${action}</a:Action>
        <a:To s:mustUnderstand="1">${endpoint}</a:To>
        <fueloauth xmlns="http://exacttarget.com">${token}</fueloauth>
    </s:Header>
    <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        ${content}
    </s:Body>
</s:Envelope>`;
};

// SFMC Data Extension functions using SOAP API
export const createDataExtension = async (
  auth: SFMCAuth & { accessToken: string },
  name: string,
  fields: Array<{ name: string; fieldType?: string; maxLength?: number; isPrimaryKey?: boolean; isRequired?: boolean; type?: string; }>
) => {
  try {
    const uniqueSuffix = Date.now().toString();
    const safeDataExtensionName = name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    const customerKey = `${safeDataExtensionName}_${uniqueSuffix}`;
    
    // Ensure at least one primary key field exists (preferably EmailAddress)
    let hasPrimaryKey = fields.some(field => field.isPrimaryKey);
    let hasEmailField = false;
    
    // Build field elements
    const fieldElements = fields.map(field => {
      const fieldName = field.name;
      const fieldType = field.fieldType || field.type || 'Text';
      
      // Track if we have an email field to use as sendable
      if (fieldName.toLowerCase() === 'emailaddress' || fieldName.toLowerCase() === 'email') {
        hasEmailField = true;
        
        // If no primary key was specified, make EmailAddress the primary key
        if (!hasPrimaryKey) {
          field.isPrimaryKey = true;
          hasPrimaryKey = true;
        }
        
        // Add a max length for Email fields, especially if primary key
        if (!field.maxLength) {
          field.maxLength = 254; // Standard max length for email addresses
        }
      }
      
      // Add MaxLength for any Text field used as primary key (SFMC requirement)
      if (field.isPrimaryKey && (fieldType.toLowerCase() === 'text' || fieldType.toLowerCase() === 'emailaddress') && !field.maxLength) {
        field.maxLength = fieldType.toLowerCase() === 'emailaddress' ? 254 : 100;
      }
      
      const maxLengthAttr = field.maxLength ? `<MaxLength>${field.maxLength}</MaxLength>` : '';
      const isPrimaryKeyAttr = field.isPrimaryKey ? `<IsPrimaryKey>true</IsPrimaryKey>` : '';
      const isRequiredAttr = field.isRequired || field.isPrimaryKey ? `<IsRequired>true</IsRequired>` : '';
      
      return `
        <Field>
            <CustomerKey>${escapeXml(fieldName.replace(/\s+/g, '_'))}_Key</CustomerKey>
            <Name>${escapeXml(fieldName)}</Name>
            <FieldType>${escapeXml(fieldType)}</FieldType>
            ${maxLengthAttr}
            ${isPrimaryKeyAttr}
            ${isRequiredAttr}
        </Field>`;
    }).join('');

    // Determine which field to use as the sendable field
    const sendableField = fields.find(f => 
      f.name.toLowerCase() === 'emailaddress' || 
      f.name.toLowerCase() === 'email' ||
      f.isPrimaryKey
    );
    
    if (!sendableField) {
      throw new Error('No suitable field found for SendableCustomObjectField. Data Extension needs either an EmailAddress field or a primary key field.');
    }

    // Create the SOAP request content
    const requestContent = `
        <CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
            <Options />
            <Objects xsi:type="DataExtension">
                <CustomerKey>${escapeXml(customerKey)}</CustomerKey>
                <Name>${escapeXml(name)}</Name>
                <IsSendable>true</IsSendable>
                <SendableDataExtensionField>
                    <Name>${escapeXml(sendableField.name)}</Name>
                    <FieldType>${sendableField.fieldType || sendableField.type || 'Text'}</FieldType>
                </SendableDataExtensionField>
                <SendableSubscriberField>
                    <Name>Subscriber Key</Name>
                    <Value></Value>
                </SendableSubscriberField>
                <Fields>
                    ${fieldElements}
                </Fields>
            </Objects>
        </CreateRequest>`;

    const endpoint = getSoapEndpoint(auth.subdomain);
    // Create the full SOAP envelope
    const soapEnvelope = createSoapEnvelope('Create', requestContent, endpoint, auth.accessToken);

    console.log('SOAP Request for Data Extension Creation:', soapEnvelope);

    // Make the SOAP API call
    const response = await axios.post(
      endpoint,
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml',
          'SOAPAction': 'Create'
        },
      }
    );

    console.log('SFMC SOAP Response for Data Extension Creation:', response.data);

    // Check for errors in the response
    const responseText = response.data.toString();
    if (responseText.includes('<StatusCode>Error</StatusCode>')) {
      const errorMatch = responseText.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);
      const statusMessageMatch = responseText.match(/<StatusMessage>(.*?)<\/StatusMessage>/);
      const errorMessage = errorMatch ? errorMatch[1] : (statusMessageMatch ? statusMessageMatch[1] : 'Unknown error creating data extension');
      throw new Error(`SFMC Error: ${errorMessage}`);
    }

    // Extract the data extension key from the response
    const customerKeyMatch = responseText.match(/<CustomerKey>(.*?)<\/CustomerKey>/);
    const returnedCustomerKey = customerKeyMatch ? customerKeyMatch[1] : customerKey;

    console.log('Created Data Extension with Key:', returnedCustomerKey);

    return {
      success: true,
      key: returnedCustomerKey,
      customerKey: returnedCustomerKey,
      name: name,
      soap_response: responseText
    };
  } catch (error: any) {
    console.error('Error creating SFMC Data Extension with SOAP:', error);
    if (error.response) {
      console.error('SOAP Error Response:', error.response.data);
      console.error('SOAP Error Status:', error.response.status);
    }
    throw error;
  }
};

// Insert data into a Data Extension using SOAP API
export const insertDataExtensionRows = async (
  auth: SFMCAuth & { accessToken: string },
  dataExtensionKey: string,
  rows: Array<Record<string, any>>
) => {
  try {
    if (!rows || rows.length === 0) {
      console.warn('No rows to insert');
      return { success: true, rowsInserted: 0 };
    }

    console.log(`Inserting ${rows.length} rows into Data Extension with Key: ${dataExtensionKey}`);
    
    // Ensure we have EmailAddress field for all rows if they have email
    rows = rows.map(row => {
      const updatedRow = { ...row };
      
      // If row has email but no EmailAddress, add it
      if (row.email && !row.EmailAddress) {
        updatedRow.EmailAddress = row.email;
      }
      
      // If the row has hs_object_id, use it as a unique identifier
      if (row.hs_object_id && !updatedRow.HubSpotID) {
        updatedRow.HubSpotID = row.hs_object_id;
      }
      
      return updatedRow;
    });
    
    // Use a smaller batch size for more reliable processing
    const batchSize = 1; // Process one record at a time for maximum reliability
    const batches = [];
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batchRows = rows.slice(i, i + batchSize);
      
      // Build XML for each batch following the exact format that works in Postman
      let objectsXml = '';
      
      batchRows.forEach(row => {
        let propertiesXml = '';
        
        Object.entries(row).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          const safeValue = typeof value === 'string' ? escapeXml(value) : escapeXml(String(value));
          
          propertiesXml += `
                    <Property>
                        <Name>${escapeXml(key)}</Name>
                        <Value>${safeValue}</Value>
                    </Property>`;
        });
        
        objectsXml += `
            <Objects xsi:type="ns1:DataExtensionObject" xmlns:ns1="http://exacttarget.com/wsdl/partnerAPI">
                <PartnerKey xsi:nil="true" />
                <ObjectID xsi:nil="true" />
                <CustomerKey>${escapeXml(dataExtensionKey)}</CustomerKey>
                <Properties>
                    ${propertiesXml}
                </Properties>
            </Objects>`;
      });
      
      // Format full SOAP envelope exactly like the working Postman example
      const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <s:Header>
        <a:Action s:mustUnderstand="1">Create</a:Action>
        <a:To s:mustUnderstand="1">${getSoapEndpoint(auth.subdomain)}</a:To>
        <fueloauth xmlns="http://exacttarget.com">${auth.accessToken}</fueloauth>
    </s:Header>
    <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
            <Options />
            ${objectsXml}
        </CreateRequest>
    </s:Body>
</s:Envelope>`;
      
      batches.push({ 
        soapEnvelope,
        endpoint: getSoapEndpoint(auth.subdomain),
        rowCount: batchRows.length
      });
    }

    // Process each batch
    const results = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i+1} of ${batches.length} (${batch.rowCount} rows)`);
      
      if (i === 0) {
        // Log the first batch request for debugging
        console.log('Sample SOAP Request for Data Insertion:', batch.soapEnvelope);
      }
      
      try {
        // Make the SOAP API call
        const response = await axios.post(
          batch.endpoint,
          batch.soapEnvelope,
          {
            headers: {
              'Content-Type': 'text/xml',
              'SOAPAction': 'Create'
            },
          }
        );
        
        // Check for errors
        const responseText = response.data.toString();
        if (i === 0) {
          console.log('Sample SOAP Response for Data Insertion:', responseText);
        }
        
        const hasError = responseText.includes('<StatusCode>Error</StatusCode>');
        
        if (hasError) {
          const errorMatch = responseText.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);
          const statusMessageMatch = responseText.match(/<StatusMessage>(.*?)<\/StatusMessage>/);
          const errorMessage = errorMatch ? errorMatch[1] : (statusMessageMatch ? statusMessageMatch[1] : 'Unknown error inserting data');
          const errorCode = responseText.match(/<ErrorCode>(\d+)<\/ErrorCode>/)?.[1] || 'Unknown';
          
          console.error(`SFMC Error in batch ${i+1}: ${errorMessage} (Code: ${errorCode})`);
          console.error('Full response:', responseText);
        } else {
          console.log(`Successfully inserted batch ${i+1}`);
        }
        
        results.push({
          success: !hasError,
          rowsInserted: hasError ? 0 : batch.rowCount,
          batch: i + 1
        });
      } catch (error: any) {
        console.error(`Error processing batch ${i+1}:`, error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        results.push({
          success: false,
          rowsInserted: 0,
          batch: i + 1,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).reduce((sum, r) => sum + r.rowsInserted, 0);
    
    if (successCount === 0 && results.length > 0) {
      console.warn('None of the data was inserted successfully. Check log for detailed errors.');
    }

    return {
      success: results.some(r => r.success),
      rowsInserted: successCount,
      batchResults: results
    };
  } catch (error: any) {
    console.error('Error inserting data into SFMC Data Extension with SOAP:', error);
    if (error.response) {
      console.error('SOAP Error Response:', error.response.data);
      console.error('SOAP Error Status:', error.response.status);
    }
    throw error;
  }
};

// Create a template in SFMC Content Builder
export const createEmailTemplate = async (
  auth: SFMCAuth & { accessToken: string },
  name: string,
  content: string,
  folderId: number
) => {
  try {
    const response = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      {
        name,
        content,
        assetType: {
          name: 'htmlemail',
          id: 208
        },
        category: {
          id: folderId
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating SFMC Email Template:', error);
    throw error;
  }
};

// Create a CloudPage in SFMC
export const createCloudPage = async (
  auth: SFMCAuth & { accessToken: string },
  name: string,
  content: string,
  folderId: number
) => {
  try {
    const response = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      {
        name,
        content,
        assetType: {
          name: 'webpage',
          id: 205
        },
        category: {
          id: folderId
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating SFMC CloudPage:', error);
    throw error;
  }
};

// Create a Journey in SFMC
export const createJourney = async (
  auth: SFMCAuth & { accessToken: string },
  name: string,
  journeyDefinition: Record<string, any>
) => {
  try {
    const response = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/interaction/v1/interactions`,
      {
        name,
        key: `journey_${Date.now()}`,
        description: `Migrated from HubSpot workflow`,
        workflowApiVersion: 1.0,
        ...journeyDefinition
      },
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating SFMC Journey:', error);
    throw error;
  }
}; 