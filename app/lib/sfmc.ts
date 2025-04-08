/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */

import axios from 'axios';
import { v4 as uuidv4 } from "uuid";

// Define interface for SFMC Folder structure
export interface SFMCFolder {
  id: number;
  name: string;
  parentId: number | null;
  contentType: string;
}

// Convert HubSpot module JSON to HTML
function convertHubSpotModuleToHTML(moduleJson: string): string {
  try {
    // Add debugging info
    console.log(`Converting HubSpot module with length ${moduleJson.length} characters`);
    console.log(`Module preview: ${moduleJson.substring(0, 100)}...`);
    
    // Extract JSON if embedded in text
    let jsonData: any;
    
    // If it's already a string that looks like JSON
    if (typeof moduleJson === 'string') {
      // Try to extract just the JSON part by finding the opening and closing braces
      const jsonStartIndex = moduleJson.indexOf('{');
      const jsonEndIndex = moduleJson.lastIndexOf('}') + 1;
      
      if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
        const jsonStr = moduleJson.substring(jsonStartIndex, jsonEndIndex);
        try {
          jsonData = JSON.parse(jsonStr);
          console.log(`Successfully parsed JSON module data`);
        } catch (parseError) {
          console.warn(`Failed to parse JSON module from substring: ${parseError}`);
          // Try to parse with a more aggressive approach - look for valid JSON
          try {
            // Find the outermost valid JSON object
            let bracketCount = 0;
            let startIdx = -1;
            
            for (let i = 0; i < moduleJson.length; i++) {
              if (moduleJson[i] === '{') {
                if (bracketCount === 0) startIdx = i;
                bracketCount++;
              } else if (moduleJson[i] === '}') {
                bracketCount--;
                if (bracketCount === 0 && startIdx !== -1) {
                  // We found a complete JSON object
                  try {
                    const candidateJson = moduleJson.substring(startIdx, i + 1);
                    jsonData = JSON.parse(candidateJson);
                    console.log(`Found valid JSON at position ${startIdx}-${i}`);
                    break;
                  } catch (e) {
                    // Not valid JSON, continue searching
                    startIdx = -1;
                  }
                }
              }
            }
          } catch (innerError) {
            console.warn(`Advanced JSON parsing also failed: ${innerError}`);
          }
        }
      } else {
        // If it doesn't look like JSON with braces, check if it's already HTML content
        if (moduleJson.trim().startsWith('<') && moduleJson.includes('</')) {
          console.log(`Module appears to be HTML already, returning as-is`);
          return moduleJson; // It's already HTML
        }
        
        try {
          // Try to parse the entire string as a last resort
          jsonData = JSON.parse(moduleJson);
        } catch (finalParseError) {
          console.warn(`Failed to parse entire string as JSON: ${finalParseError}`);
          // If we can't parse as JSON and it doesn't look like HTML, wrap it in a div
          if (!moduleJson.includes('<')) {
            return `<div>${moduleJson}</div>`;
          }
          return moduleJson;
        }
      }
    } else {
      // It might already be a parsed object
      jsonData = moduleJson;
    }
    
    // If we couldn't parse the JSON, return the original content
    if (!jsonData) {
      console.warn('Could not parse module JSON, returning original');
      return moduleJson;
    }
    
    // Log the JSON structure for debugging
    console.log(`Module type identified: ${jsonData.type || jsonData.path || 'unknown'}`);
    
    // Convert the HubSpot module JSON to HTML based on module type
    let renderedHTML = '';
    
    // Handle image module
    if ((jsonData.path && jsonData.path.includes('image')) || jsonData.type === 'image') {
      // Extract image properties more robustly
      const imgSrc = jsonData.img?.src || jsonData.src || '';
      const imgAlt = jsonData.img?.alt || jsonData.alt || '';
      const imgHeight = jsonData.img?.height || jsonData.height || '';
      const imgWidth = jsonData.img?.width || jsonData.width || '';
      
      // Build image tag with proper attributes
      const imgTag = imgSrc ? 
        `<img src="${imgSrc}" alt="${imgAlt}" 
          ${imgHeight ? `height="${imgHeight}"` : ''} 
          ${imgWidth ? `width="${imgWidth}"` : ''} 
          style="border: 0; display: block; ${jsonData.style?.alignment ? `margin: 0 auto;` : ''}" />` : 
        '';
      
      // Extract padding from various possible sources
      const paddingTop = jsonData.hs_wrapper_css?.['padding-top'] || jsonData.style?.['padding-top'] || jsonData.padding_top || '0px';
      const paddingRight = jsonData.hs_wrapper_css?.['padding-right'] || jsonData.style?.['padding-right'] || jsonData.padding_right || '0px';
      const paddingBottom = jsonData.hs_wrapper_css?.['padding-bottom'] || jsonData.style?.['padding-bottom'] || jsonData.padding_bottom || '0px';
      const paddingLeft = jsonData.hs_wrapper_css?.['padding-left'] || jsonData.style?.['padding-left'] || jsonData.padding_left || '0px';
      
      const wrapperStyle = `padding: ${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft};`;
      const alignment = jsonData.style?.alignment || jsonData.alignment || 'left';
      
      renderedHTML = `<div style="${wrapperStyle} text-align: ${alignment};">${imgTag}</div>`;
    }
    // Handle button module
    else if ((jsonData.path && jsonData.path.includes('button')) || jsonData.type === 'button') {
      const buttonText = jsonData.text || jsonData.buttonText || jsonData.button_text || 'Button';
      const buttonUrl = jsonData.url || jsonData.link || jsonData.href || '#';
      const buttonBackground = jsonData.background_color || jsonData.backgroundColor || jsonData.bgColor || '#00a38d';
      const buttonTextColor = jsonData.font_color || jsonData.fontColor || jsonData.color || '#ffffff';
      const buttonBorderRadius = jsonData.corner_radius || jsonData.cornerRadius || jsonData.borderRadius || 4;
      
      // Extract additional button properties if available
      const buttonWidth = jsonData.width || 'auto';
      const buttonFontSize = jsonData.fontSize || jsonData.font_size || '16px';
      const buttonFontFamily = jsonData.fontFamily || jsonData.font_family || 'Arial, sans-serif';
      
      const buttonStyle = `
        display: inline-block;
        background-color: ${buttonBackground};
        color: ${buttonTextColor};
        padding: 10px 20px;
        text-decoration: none;
        font-weight: bold;
        border-radius: ${buttonBorderRadius}px;
        text-align: center;
        font-family: ${buttonFontFamily};
        font-size: ${buttonFontSize};
        ${jsonData.make_full_width || jsonData.fullWidth ? 'width: 100%;' : buttonWidth !== 'auto' ? `width: ${buttonWidth}px;` : ''}
      `;
      
      // Extract padding from various possible sources
      const paddingTop = jsonData.hs_wrapper_css?.['padding-top'] || jsonData.style?.['padding-top'] || jsonData.padding_top || '10px';
      const paddingRight = jsonData.hs_wrapper_css?.['padding-right'] || jsonData.style?.['padding-right'] || jsonData.padding_right || '0px';
      const paddingBottom = jsonData.hs_wrapper_css?.['padding-bottom'] || jsonData.style?.['padding-bottom'] || jsonData.padding_bottom || '10px';
      const paddingLeft = jsonData.hs_wrapper_css?.['padding-left'] || jsonData.style?.['padding-left'] || jsonData.padding_left || '0px';
      
      const wrapperStyle = `padding: ${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft};`;
      const alignment = jsonData.alignment || jsonData.style?.alignment || 'center';
      
      renderedHTML = `
        <div style="${wrapperStyle} text-align: ${alignment};">
          <a href="${buttonUrl}" style="${buttonStyle}">${buttonText}</a>
        </div>
      `;
    }
    // Handle rich text module
    else if ((jsonData.path && (jsonData.path.includes('rich_text') || jsonData.path.includes('text'))) || 
             jsonData.type === 'text' || jsonData.html || jsonData.text || jsonData.content) {
      // Extract content from various possible sources
      const text = jsonData.html || jsonData.text || jsonData.content || '';
      
      // Extract padding from various possible sources
      const paddingTop = jsonData.hs_wrapper_css?.['padding-top'] || jsonData.style?.['padding-top'] || jsonData.padding_top || '0px';
      const paddingRight = jsonData.hs_wrapper_css?.['padding-right'] || jsonData.style?.['padding-right'] || jsonData.padding_right || '0px';
      const paddingBottom = jsonData.hs_wrapper_css?.['padding-bottom'] || jsonData.style?.['padding-bottom'] || jsonData.padding_bottom || '0px';
      const paddingLeft = jsonData.hs_wrapper_css?.['padding-left'] || jsonData.style?.['padding-left'] || jsonData.padding_left || '0px';
      
      const wrapperStyle = `padding: ${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft};`;
      
      // Ensure text has proper HTML structure
      let formattedText = text;
      if (typeof formattedText === 'string' && !formattedText.trim().startsWith('<')) {
        formattedText = `<p>${formattedText}</p>`;
      }
      
      renderedHTML = `<div style="${wrapperStyle}">${formattedText}</div>`;
    }
    // Handle divider module
    else if ((jsonData.path && jsonData.path.includes('divider')) || jsonData.type === 'divider') {
      const dividerColor = jsonData.color?.color || jsonData.lineColor || jsonData.divider_color || '#CCCCCC';
      const dividerHeight = jsonData.height || jsonData.thickness || 1;
      
      // Extended properties
      const width = jsonData.width || jsonData.divider_width || '100%';
      const lineType = jsonData.line_type || jsonData.lineType || 'solid';
      
      const dividerStyle = `
        border: none;
        height: ${dividerHeight}px;
        width: ${width};
        background-color: ${dividerColor};
        ${lineType === 'dashed' ? 'border-top: 1px dashed ' + dividerColor + ';' : ''}
        ${lineType === 'dotted' ? 'border-top: 1px dotted ' + dividerColor + ';' : ''}
      `;
      
      // Extract padding from various possible sources
      const paddingTop = jsonData.hs_wrapper_css?.['padding-top'] || jsonData.style?.['padding-top'] || jsonData.padding_top || '10px';
      const paddingRight = jsonData.hs_wrapper_css?.['padding-right'] || jsonData.style?.['padding-right'] || jsonData.padding_right || '0px';
      const paddingBottom = jsonData.hs_wrapper_css?.['padding-bottom'] || jsonData.style?.['padding-bottom'] || jsonData.padding_bottom || '10px';
      const paddingLeft = jsonData.hs_wrapper_css?.['padding-left'] || jsonData.style?.['padding-left'] || jsonData.padding_left || '0px';
      
      const wrapperStyle = `padding: ${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft};`;
      const alignment = jsonData.alignment || jsonData.style?.alignment || 'center';
      
      renderedHTML = `<div style="${wrapperStyle}; text-align: ${alignment};"><hr style="${dividerStyle}" /></div>`;
    }
    // Handle spacer module
    else if ((jsonData.path && jsonData.path.includes('spacer')) || jsonData.type === 'spacer') {
      const height = jsonData.height || jsonData.spacing || '20px';
      renderedHTML = `<div style="height: ${height}px; line-height: ${height}px; font-size: 0;">&nbsp;</div>`;
    }
    // Handle social follow module
    else if ((jsonData.path && (jsonData.path.includes('follow') || jsonData.path.includes('social'))) || 
             jsonData.type === 'social' || jsonData.social) {
      const socialItems = jsonData.social || jsonData.networks || jsonData.items || [];
      
      // Generate social icons
      const socialIcons = Array.isArray(socialItems) ? socialItems.map((social: any) => {
        const network = social.network || social.type || 'facebook';
        const url = social.url || social.link || '#';
        const iconSize = social.size || social.iconSize || 24;
        
        // Determine icon URL based on network
        let iconUrl = '';
        switch(network.toLowerCase()) {
          case 'facebook':
            iconUrl = 'https://static.hsappstatic.net/EmailTemplateAssets/ex/social/facebook.png';
            break;
          case 'twitter':
          case 'x':
            iconUrl = 'https://static.hsappstatic.net/EmailTemplateAssets/ex/social/twitter.png';
            break;
          case 'linkedin':
            iconUrl = 'https://static.hsappstatic.net/EmailTemplateAssets/ex/social/linkedin.png';
            break;
          case 'instagram':
            iconUrl = 'https://static.hsappstatic.net/EmailTemplateAssets/ex/social/instagram.png';
            break;
          case 'youtube':
            iconUrl = 'https://static.hsappstatic.net/EmailTemplateAssets/ex/social/youtube.png';
            break;
          default:
            iconUrl = 'https://static.hsappstatic.net/EmailTemplateAssets/ex/social/link.png';
        }
        
        return `<a href="${url}" style="text-decoration: none; margin: 0 5px;"><img src="${iconUrl}" alt="${network}" width="${iconSize}" height="${iconSize}" style="border: 0;"></a>`;
      }).join('') : '';
      
      // Extract padding from various possible sources
      const paddingTop = jsonData.hs_wrapper_css?.['padding-top'] || jsonData.style?.['padding-top'] || jsonData.padding_top || '10px';
      const paddingRight = jsonData.hs_wrapper_css?.['padding-right'] || jsonData.style?.['padding-right'] || jsonData.padding_right || '0px';
      const paddingBottom = jsonData.hs_wrapper_css?.['padding-bottom'] || jsonData.style?.['padding-bottom'] || jsonData.padding_bottom || '10px';
      const paddingLeft = jsonData.hs_wrapper_css?.['padding-left'] || jsonData.style?.['padding-left'] || jsonData.padding_left || '0px';
      
      const wrapperStyle = `padding: ${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft};`;
      const alignment = jsonData.alignment || 'center';
      
      renderedHTML = `<div style="${wrapperStyle} text-align: ${alignment};">${socialIcons}</div>`;
    }
    // Handle footer module with SFMC unsubscribe tag
    else if ((jsonData.path && jsonData.path.includes('footer')) || jsonData.type === 'footer') {
      // Extract padding from various possible sources
      const paddingTop = jsonData.hs_wrapper_css?.['padding-top'] || jsonData.style?.['padding-top'] || jsonData.padding_top || '10px';
      const paddingRight = jsonData.hs_wrapper_css?.['padding-right'] || jsonData.style?.['padding-right'] || jsonData.padding_right || '0px';
      const paddingBottom = jsonData.hs_wrapper_css?.['padding-bottom'] || jsonData.style?.['padding-bottom'] || jsonData.padding_bottom || '10px';
      const paddingLeft = jsonData.hs_wrapper_css?.['padding-left'] || jsonData.style?.['padding-left'] || jsonData.padding_left || '0px';
      
      const wrapperStyle = `padding: ${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft};`;
      
      // Get text color from font if available
      const textColor = jsonData.font?.color || jsonData.styles?.color || jsonData.color || '#888888';
      const fontSize = jsonData.font?.size?.value 
                      ? `${jsonData.font.size.value}px` 
                      : (jsonData.fontSize || jsonData.font_size || '12px');
      const fontFamily = jsonData.font?.font || jsonData.fontFamily || jsonData.font_family || 'Arial, sans-serif';
      
      // Check if link should be underlined based on styles
      const underlineStyle = jsonData.styles?.underline || jsonData.underline ? 'text-decoration: underline;' : '';
      const linkColor = jsonData.link_font?.color || jsonData.linkColor || textColor;
      
      // Extract company name from various possible sources
      const companyName = jsonData.company_name || jsonData.companyName || jsonData.company || 'Your Company';
      
      // Convert HubSpot unsubscribe to SFMC
      const unsubText = jsonData.unsubscribe_text || jsonData.unsubscribeText || 'Unsubscribe';
      
      // Build footer with standard unsubscribe tag and address (if available)
      const addressBlock = jsonData.address ? 
        `<p>${jsonData.address}</p>` : '';
      
      renderedHTML = `
        <div style="${wrapperStyle} text-align: ${jsonData.align || 'center'}; color: ${textColor}; font-size: ${fontSize}; font-family: ${fontFamily};">
          <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          ${addressBlock}
          <p>
            <a href="%%unsub_center_url%%" style="color: ${linkColor}; ${underlineStyle}">
              ${unsubText}
            </a>
          </p>
        </div>
      `;
    }
    // Handle headings more specifically
    else if (jsonData.text && typeof jsonData.text === 'string' && 
             ((!jsonData.path && !jsonData.type) || jsonData.type === 'heading' ||
             (jsonData.text.toUpperCase() === jsonData.text && jsonData.text.length < 100))) {
      // Extract heading level
      const headingLevel = jsonData.level || jsonData.headingLevel || 2;
      
      // Extract other properties
      const color = jsonData.color || jsonData.textColor || '#333333';
      const alignment = jsonData.alignment || jsonData.textAlign || 'center';
      const fontFamily = jsonData.fontFamily || jsonData.font_family || 'Arial, sans-serif';
      const fontSize = jsonData.fontSize || jsonData.font_size || (headingLevel === 1 ? '28px' : '22px');
      
      // Create heading
      renderedHTML = `<h${headingLevel} style="text-align: ${alignment}; color: ${color}; font-family: ${fontFamily}; font-size: ${fontSize}; margin: 15px 0;">${jsonData.text}</h${headingLevel}>`;
    }
    // Special case for HubSpot's default email content
    else if (jsonData.widgets && Array.isArray(jsonData.widgets)) {
      // It's a full email template with widgets
      const widgetsHTML = jsonData.widgets.map((widget: any) => {
        if (typeof widget === 'string') {
          return `<div class="hubspot-module-placeholder" data-module-id="${widget}"></div>`;
        } else if (widget.body) {
          return widget.body;
        } else {
          return convertHubSpotModuleToHTML(JSON.stringify(widget));
        }
      }).join('\n');
      
      renderedHTML = `<div class="hubspot-email-container">${widgetsHTML}</div>`;
    }
    // Default fallback for unknown modules
    else {
      console.log(`Using fallback rendering for unknown module type`);
      
      // Try to extract any useful content
      const content = jsonData.content || jsonData.html || jsonData.text || '';
      const title = jsonData.title || jsonData.name || 'Module Content';
      
      // Check if there's an image to include
      const hasImage = jsonData.img || jsonData.image || jsonData.src;
      const imageHTML = hasImage ? 
        `<img src="${jsonData.img?.src || jsonData.image?.src || jsonData.src}" alt="${jsonData.img?.alt || jsonData.image?.alt || title}" style="max-width: 100%;" />` : '';
      
      // Create a generic representation based on available properties
      renderedHTML = `<div style="padding: 10px; border: 1px solid #eee;">
        <h3>${title}</h3>
        ${imageHTML}
        ${content ? `<div>${content}</div>` : ''}
      </div>`;
    }
    
    console.log(`Successfully rendered module to HTML (${renderedHTML.length} characters)`);
    return renderedHTML;
  } catch (error) {
    console.warn('Error converting HubSpot module to HTML:', error);
    // Return original content if conversion fails - if it's already HTML-like, return as is
    if (typeof moduleJson === 'string' && moduleJson.includes('<') && moduleJson.includes('>')) {
      return moduleJson;
    }
    // Otherwise wrap it in a div
    return `<div>${typeof moduleJson === 'string' ? moduleJson : 'Module conversion failed'}</div>`;
  }
}

// SFMC Auth
export interface SFMCAuth {
  clientId: string;
  clientSecret: string;
  subdomain: string;
  accessToken?: string;
  expiresAt?: number;
  soapUsername?: string;
  soapPassword?: string;
  rest?: {
    accessToken: string;
    baseUri: string;
  };
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
    
    // Handle specific case of duplicate data extension
    if (responseText.includes('<StatusCode>Error</StatusCode>') && 
        (responseText.includes('already exists') || responseText.includes('310007'))) {
      
      console.log(`Data extension "${name}" already exists. Creating with unique name: ${customerKey}`);
      
      // If this is a duplicate name error, we can use the unique key we generated
      // but we need to change the name as well to be unique
      const uniqueName = `${name}_${uniqueSuffix}`;
      
      // Create modified SOAP content with unique name and key
      const modifiedRequestContent = `
        <CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
            <Options />
            <Objects xsi:type="DataExtension">
                <CustomerKey>${escapeXml(customerKey)}</CustomerKey>
                <Name>${escapeXml(uniqueName)}</Name>
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
        
      // Create modified SOAP envelope
      const modifiedSoapEnvelope = createSoapEnvelope('Create', modifiedRequestContent, endpoint, auth.accessToken);
      
      console.log('Retrying with unique Data Extension name and key:', uniqueName, customerKey);
      
      // Try again with the modified request
      const retryResponse = await axios.post(
        endpoint,
        modifiedSoapEnvelope,
        {
          headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': 'Create'
          },
        }
      );
      
      const retryResponseText = retryResponse.data.toString();
      console.log('SFMC SOAP Retry Response for Data Extension Creation:', retryResponseText);
      
      // Check if the retry succeeded
      if (retryResponseText.includes('<StatusCode>Error</StatusCode>')) {
        const errorMatch = retryResponseText.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);
        const statusMessageMatch = retryResponseText.match(/<StatusMessage>(.*?)<\/StatusMessage>/);
        const errorMessage = errorMatch ? errorMatch[1] : (statusMessageMatch ? statusMessageMatch[1] : 'Unknown error creating data extension');
        throw new Error(`SFMC Error: ${errorMessage}`);
      }
      
      // Extract the data extension key from the response
      const customerKeyMatch = retryResponseText.match(/<CustomerKey>(.*?)<\/CustomerKey>/);
      const returnedCustomerKey = customerKeyMatch ? customerKeyMatch[1] : customerKey;
      
      console.log('Created Data Extension with unique name and Key:', uniqueName, returnedCustomerKey);
      
      return {
        success: true,
        key: returnedCustomerKey,
        customerKey: returnedCustomerKey,
        name: uniqueName,
        soap_response: retryResponseText
      };
    } else if (responseText.includes('<StatusCode>Error</StatusCode>')) {
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
  folderId: number,
  options: {
    channels?: { email?: boolean; web?: boolean };
    slots?: Record<string, any>;
    assetType?: { name?: string; id?: number };
  } = {}
) => {
  try {
    // Set default values
    const channels = options.channels || { email: true, web: false };
    const slots = options.slots || {};
    const assetType = options.assetType || { name: 'htmlemail', id: 208 };
    
    // If assetType is "template", use id 4
    if (assetType.name === 'template') {
      assetType.id = 4;
    }
    
    const requestBody: Record<string, any> = {
      name,
      content,
      assetType,
      category: {
        id: folderId
      }
    };
    
    // Add channels if provided
    if (channels) {
      requestBody.channels = channels;
    }
    
    // Add slots if provided
    if (Object.keys(slots).length > 0) {
      requestBody.slots = slots;
    }
    
    console.log('Creating SFMC template with request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('SFMC template creation response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.error('Error creating SFMC Email Template:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// Create a content block in SFMC Content Builder
export const createSFMCContentBlock = async (
  auth: SFMCAuth & { accessToken: string },
  name: string,
  content: string,
  folderId: number,
  blockType: string = 'htmlblock' // Default to HTML block
) => {
  try {
    // Ensure content is not empty or just whitespace
    if (!content || content.trim() === '') {
      console.warn(`Content for ${name} is empty, adding placeholder content`);
      content = `<div style="padding: 10px; border: 1px dashed #ccc; text-align: center;">
        <p>Placeholder content for ${name}</p>
      </div>`;
    }

    // For HTML blocks, ensure the content has some basic structure
    if (blockType === 'htmlblock' && !content.includes('<')) {
      console.log(`Content for ${name} doesn't appear to be HTML, wrapping in div`);
      content = `<div>${content}</div>`;
    }
    
    // Ensure folderId is a number and log it
    const numericFolderId = Number(folderId);
    console.log(`Creating content block "${name}" in folder ID: ${numericFolderId} (Original: ${folderId})`);
    
    if (isNaN(numericFolderId)) {
      console.warn(`Invalid folder ID ${folderId}, defaulting to Content Builder root`);
    }
    
    // Map block type to SFMC asset type
    const assetTypeMap: Record<string, {name: string, id: number}> = {
      'htmlblock': { name: 'htmlblock', id: 197 },
      'textblock': { name: 'textblock', id: 196 },
      'imageblock': { name: 'imageblock', id: 198 },
      'buttonblock': { name: 'buttonblock', id: 199 },
      'freeformblock': { name: 'freeformblock', id: 200 }
    };
    
    // Use default if type not found
    const assetType = assetTypeMap[blockType] || assetTypeMap['htmlblock'];
    
    const requestBody: Record<string, any> = {
      name,
      assetType,
      content,
      category: {
        id: numericFolderId || 0
      }
    };
    
    // For image blocks, use different structure
    if (blockType === 'imageblock' && content.includes('src=')) {
      // Extract image URL
      const srcMatch = content.match(/src=['"]([^'"]+)['"]/);
      const imageUrl = srcMatch ? srcMatch[1] : '';
      
      if (imageUrl) {
        requestBody.fileProperties = {
          fileName: name,
          url: imageUrl
        };
        
        // Handle alt text
        const altMatch = content.match(/alt=['"]([^'"]+)['"]/);
        if (altMatch) {
          requestBody.file = {
            altText: altMatch[1]
          };
        }
      }
    }
    
    // Create SFMC content block
    console.log(`Creating SFMC content block: ${name} (${blockType})`);
    
    const response = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`SFMC content block creation response:`, response.data);
    
    // Ensure the response always has an id field
    if (!response.data.id && response.data.objectID) {
      response.data.id = response.data.objectID;
    }
    
    return response.data;
  } catch (error: any) {
    console.error(`Error creating SFMC Content Block (${blockType}):`, error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// Create a full email in SFMC Content Builder with modular content blocks
export const createSFMCEmail = async (
  auth: SFMCAuth & { accessToken: string },
  email: {
    name: string;
    subject: string;
    content: string;
    fromName?: string;
    fromEmail?: string;
    status?: string;
    slots?: Record<string, any>;
    channels?: { email?: boolean; web?: boolean };
    moduleContent?: Record<string, string>;
  },
  folderId: number
) => {
  try {
    // Set default values
    const channels = email.channels || { email: true, web: false };
    
    // Create a unique suffix for the main email
    const emailSuffix = Date.now().toString().substring(9, 13);
    const uniqueEmailName = `${email.name}_${emailSuffix}`;
    
    // Clean the content before processing to handle HubSpot specific data
    const processedContent = cleanContentForSFMC(email.content);
    console.log(`Cleaned email content for "${email.name}"`);
    
    // Process module content if available
    const cleanedModuleContent: Record<string, string> = {};
    if (email.moduleContent) {
      Object.entries(email.moduleContent).forEach(([key, content]) => {
        cleanedModuleContent[key] = cleanContentForSFMC(content);
      });
      console.log(`Cleaned ${Object.keys(cleanedModuleContent).length} module content items`);
    }
    
    // Extract modules from the content and create AMPscript-based template
    const { contentBlocks, templateHtml, contentBlockFolderId } = await extractAndCreateContentBlocks(
      auth, 
      processedContent, 
      email.name, 
      folderId, // Pass the same folder ID for content blocks
      cleanedModuleContent
    );
    
    console.log(`Created ${contentBlocks.length} content blocks for email template in folder ${contentBlockFolderId || folderId}`);
    
    // Create the request body using the AMPscript-based template
    const requestBody: Record<string, any> = {
      name: uniqueEmailName,
      assetType: { name: 'htmlemail', id: 208 }, // HTML Email type
      category: {
        id: folderId
      },
      views: {
        html: {
          content: templateHtml
        },
        text: {
          content: email.name
        }
      },
      data: {
        email: {
          subject: email.subject
        }
      }
    };
    
    // Add sender information if provided
    if (email.fromName || email.fromEmail) {
      if (!requestBody.data) requestBody.data = {};
      if (!requestBody.data.email) requestBody.data.email = {};
      
      requestBody.data.email.emailFromName = email.fromName || '';
      requestBody.data.email.emailFromEmail = email.fromEmail || '';
    }
    
    // Add channels if provided
    if (channels) {
      requestBody.channels = channels;
    }
    
    console.log(`Creating SFMC email "${uniqueEmailName}" with ${contentBlocks.length} AMPscript content blocks`);
    
    try {
      const response = await axios.post(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('SFMC email creation response:', JSON.stringify(response.data, null, 2));
      
      // Return the response with additional info about content blocks
      return {
        ...response.data,
        contentBlocksInfo: {
          count: contentBlocks.length,
          folderId: contentBlockFolderId,
          blocks: contentBlocks.map(block => ({
            id: block.numericId || parseInt(block.customerKey?.split('-')[0], 16) || null,
            name: block.name,
            type: block.type
          }))
        }
      };
    } catch (error: any) {
      console.error('Error creating SFMC Email with AMPscript content blocks:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Error details:', JSON.stringify(error.response.data, null, 2));
        
        // Fall back to simpler approach as last resort
        console.log('Trying simplified fallback approach for email creation');
        
        // Create a simpler email that directly includes all content
        const simpleBody: Record<string, any> = {
          name: uniqueEmailName,
          assetType: { name: 'htmlemail', id: 208 },
          category: { id: folderId },
          views: {
            html: {
              content: `<!DOCTYPE html><html><head><title>${email.name}</title></head><body>${email.content}</body></html>`
            },
            text: {
              content: email.name
            }
          },
          data: {
            email: {
              subject: email.subject
            }
          }
        };
        
        // Add sender information
        if (email.fromName || email.fromEmail) {
          simpleBody.data.email.emailFromName = email.fromName || '';
          simpleBody.data.email.emailFromEmail = email.fromEmail || '';
        }
        
        const finalResponse = await axios.post(
          `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
          simpleBody,
          {
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        console.log('Simple email creation success:', JSON.stringify(finalResponse.data, null, 2));
        
        // Return with basic content block info
        return {
          ...finalResponse.data,
          contentBlocksInfo: {
            count: 0,
            folderId: contentBlockFolderId,
            blocks: []
          }
        };
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error in createSFMCEmail:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Last resort fallback
    try {
      console.log('Using simple HTML email as final fallback');
      const basicHtml = `<!DOCTYPE html><html><head><title>${email.name}</title></head><body>${email.content}</body></html>`;
      
      const simpleResponse = await axios.post(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
        {
          name: `${email.name}_fallback_${Date.now().toString().substring(9, 13)}`,
          assetType: { name: 'htmlemail', id: 208 },
          category: { id: folderId },
          views: {
            html: {
              content: basicHtml
            },
            text: {
              content: email.name
            }
          },
          data: {
            email: {
              subject: email.subject,
              emailFromName: email.fromName || '',
              emailFromEmail: email.fromEmail || ''
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return {
        ...simpleResponse.data,
        contentBlocksInfo: {
          count: 0,
          folderId: folderId,
          blocks: []
        }
      };
    } catch (finalError: any) {
      console.error('All fallback attempts failed:', finalError.message);
      throw finalError;
    }
  }
};

// Extract modules from HubSpot content and create SFMC content blocks
async function extractAndCreateContentBlocks(
  auth: SFMCAuth & { accessToken: string },
  content: string,
  emailName: string,
  folderId: number,
  moduleContent?: Record<string, string>
): Promise<{
  contentBlocks: Array<{
    id: string;
    name: string;
    customerKey: string;
    numericId: number;
    type: string;
    slotName: string;
  }>;
  templateHtml: string;
  contentBlockFolderId: number;
}> {
  // Create a dedicated folder for the content blocks
  let contentBlockFolderId = folderId; // Default to parent folder if folder creation fails
  const safeEmailName = emailName.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
  const contentBlockFolderName = `${safeEmailName}_ContentBlocks_${Date.now().toString().substring(9, 13)}`;
  
  try {
    // Convert folderId to a number to ensure it's valid
    const numericFolderId = Number(folderId);
    console.log(`Using folder ID for content blocks: ${numericFolderId} (Original: ${folderId})`);
    
    if (isNaN(numericFolderId)) {
      console.warn(`Invalid parent folder ID: ${folderId}, using default folder instead`);
      contentBlockFolderId = folderId; // Keep using the provided value as is
    } else {
      // First, determine if we should create a subfolder or just use the provided folder directly
      const createSubfolder = process.env.CREATE_CONTENT_BLOCK_SUBFOLDERS === 'true';
      
      if (createSubfolder) {
        console.log(`Creating dedicated subfolder for content blocks: ${contentBlockFolderName}`);
        try {
          // Create the content block subfolder directly under the specified folder
          const newFolder = await createSFMCFolder(auth, contentBlockFolderName, numericFolderId);
          if (newFolder && newFolder.id) {
            contentBlockFolderId = newFolder.id;
            console.log(`Successfully created content blocks subfolder: ${contentBlockFolderName} (ID: ${contentBlockFolderId})`);
          } else {
            console.warn(`Folder creation returned no ID, falling back to parent folder: ${numericFolderId}`);
            contentBlockFolderId = numericFolderId;
          }
        } catch (folderError) {
          console.warn(`Could not create subfolder, using specified folder directly: ${numericFolderId}`, folderError);
          contentBlockFolderId = numericFolderId;
        }
      } else {
        console.log(`Using specified folder directly (ID: ${numericFolderId}) without creating subfolders`);
        contentBlockFolderId = numericFolderId;
      }
    }
    
    console.log(`Final content block folder ID: ${contentBlockFolderId}`);
  } catch (folderError) {
    console.warn(`Could not process folder for content blocks, using original folder: ${folderId}`, folderError);
    contentBlockFolderId = folderId;
  }
  
  // Extract modules from the content
  const modules: Array<{
    id: string;
    content: string;
    type: string;
    fullMatch: string;
  }> = [];
  
  // Regular expressions to find different types of modules
  const moduleRegexps = [
    // Match div elements with class="module" or id starting with "module-"
    {
      pattern: /<div[^>]*(?:class="[^"]*module[^"]*"|id="module-[^"]*"|data-module-id="[^"]*")[^>]*>([\s\S]*?)<\/div>/gi,
      type: 'htmlblock'
    },
    // Match img tags
    {
      pattern: /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      type: 'imageblock'
    },
    // Match button/anchor elements that look like buttons
    {
      pattern: /<a[^>]*(?:class="[^"]*(?:btn|button)[^"]*"|style="[^"]*(?:background-color|border-radius)[^"]*")[^>]*>([\s\S]*?)<\/a>/gi,
      type: 'buttonblock'
    },
    // Match any HubSpot-specific modules by data attributes
    {
      pattern: /<[^>]+data-hs-module[^>]*>([\s\S]*?)<\/[^>]+>/gi,
      type: 'htmlblock'
    },
    // Match common HubSpot section patterns
    {
      pattern: /<section[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
      type: 'htmlblock'
    },
    // Match any HubSpot JSON data that might be in the content
    {
      pattern: /\{(?:[^{}]|"(?:\\.|[^"\\])*"|\{(?:[^{}]|"(?:\\.|[^"\\])*")*\})*\}/gi,
      type: 'htmlblock'
    },
    // Match common email sections like header/footer
    {
      pattern: /<(header|footer)[^>]*>([\s\S]*?)<\/(header|footer)>/gi,
      type: 'htmlblock'
    }
  ];
  
  // Create a copy of content that we'll modify
  let processedContent = content;
  
  // Extract modules of different types
  for (const moduleRegexp of moduleRegexps) {
    let match;
    
    // Reset regexp's lastIndex to ensure we start from the beginning
    moduleRegexp.pattern.lastIndex = 0;
    
    while ((match = moduleRegexp.pattern.exec(content)) !== null) {
      const fullMatch = match[0];
      const moduleContent = match[1] || fullMatch;
      
      // Extract the ID or generate one
      const idMatch = fullMatch.match(/id=["']([^"']*?)["']/);
      const id = idMatch ? idMatch[1] : `module-${modules.length}`;
      
      // Also look for module-id attribute
      const moduleIdMatch = fullMatch.match(/data-module-id=["']([^"']*?)["']/);
      const moduleId = moduleIdMatch ? moduleIdMatch[1] : id;
      
      // Determine module type
      let moduleType = moduleRegexp.type;
      
      // Refine type based on content
      if (moduleType === 'htmlblock') {
        // Check if this is actually an image block
        if (fullMatch.includes('<img') && !fullMatch.includes('<p')) {
          moduleType = 'imageblock';
        }
        // Check if this is a text-only block
        else if (!fullMatch.includes('<') || 
                (fullMatch.match(/<[^>]+>/g) && fullMatch.match(/<[^>]+>/g)!.length <= 2)) {
          moduleType = 'textblock';
        }
      }
      
      modules.push({
        id,
        content: moduleContent,
        type: moduleType,
        fullMatch
      });
      
      // Replace the module in the content with an AMPscript placeholder instead of slots
      // We'll use a temporary marker that we'll replace with actual AMPscript later
      processedContent = processedContent.replace(
        fullMatch,
        `<div class="ampscript-placeholder" data-module-id="${id}"></div>`
      );
    }
  }
  
  // If no modules were found, create a single HTML module with all content
  if (modules.length === 0) {
    console.log('No modules detected with standard patterns, creating a full content block');
    const id = 'full-content';
    
    // Add additional module detection for HubSpot content by looking for common structures
    const hubspotSections = content.match(/<div[^>]*class="hse-section[^>]*>([\s\S]*?)<\/div>/gi);
    
    if (hubspotSections && hubspotSections.length > 0) {
      console.log(`Found ${hubspotSections.length} HubSpot section divs, creating individual modules`);
      
      // Create a module for each section
      hubspotSections.forEach((section, index) => {
        modules.push({
          id: `hs-section-${index}`,
          content: section,
          type: 'htmlblock',
          fullMatch: section
        });
        
        // Replace this section with a placeholder
        processedContent = processedContent.replace(
          section,
          `<div class="ampscript-placeholder" data-module-id="hs-section-${index}"></div>`
        );
      });
    } else {
      // Look for potential raw JSON in the content as a last resort
      const jsonPattern = /\{(?:"path"|"module_id"|"css_class"|"schema_version")[^}]+\}/g;
      const jsonMatches = content.match(jsonPattern);
      
      if (jsonMatches && jsonMatches.length > 0) {
        console.log(`Found ${jsonMatches.length} raw JSON objects in content, creating modules for each`);
        
        // Create a module for each JSON object
        jsonMatches.forEach((jsonObj, index) => {
          modules.push({
            id: `json-module-${index}`,
            content: jsonObj,
            type: 'htmlblock',
            fullMatch: jsonObj
          });
          
          // Replace this JSON with a placeholder
          processedContent = processedContent.replace(
            jsonObj,
            `<div class="ampscript-placeholder" data-module-id="json-module-${index}"></div>`
          );
        });
      } else {
        // If we still couldn't find modules, just use the whole thing
        modules.push({
          id,
          content,
          type: 'htmlblock',
          fullMatch: content
        });
      
        processedContent = `<div class="ampscript-placeholder" data-module-id="${id}"></div>`;
      }
    }
  }
  
  // Create content blocks in SFMC - now in the dedicated folder
  const createdBlocks = [];
  
  for (const module of modules) {
    try {
      // Set up names for content blocks
      const blockName = `${emailName.substring(0, 30)}_${module.id.substring(0, 20)}_${new Date().getTime().toString().substring(0, 4)}`;
      const slotName = `slot_${module.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // Check if we have actual content from HubSpot for this module
      let actualContent = module.content;
      
      // Try to find better content from the moduleContent mapping
      if (moduleContent) {
        // Check for direct match
        if (moduleContent[module.id]) {
          console.log(`Found direct module content match for ${module.id}`);
          actualContent = moduleContent[module.id];
        } 
        // Try matching module ID
        else {
          const moduleIdMatch = module.fullMatch.match(/data-module-id=["']([^"']*?)["']/);
          if (moduleIdMatch && moduleContent[moduleIdMatch[1]]) {
            console.log(`Found module content match for ID ${moduleIdMatch[1]}`);
            actualContent = moduleContent[moduleIdMatch[1]];
          }
          // Try matching by numeric pattern (e.g., module-1-2-3)
          else {
            const numericMatch = module.id.match(/\d+-\d+-\d+$/);
            if (numericMatch) {
              // Try different module ID formats
              const possibleIds = [
                `module-${numericMatch[0]}`,
                `module_${numericMatch[0]}`,
                `module_${numericMatch[0].replace(/-/g, '_')}`
              ];
              
              for (const possibleId of possibleIds) {
                if (moduleContent[possibleId]) {
                  console.log(`Found module content match for pattern ${possibleId}`);
                  actualContent = moduleContent[possibleId];
                  break;
                }
              }
            }
          }
        }
      }
      
      // If content still has "Module ID:" placeholder, try one more approach
      if (actualContent.includes('Module ID:')) {
        console.log(`Still have placeholder for ${module.id}, trying additional methods`);
        
        // Extract moduleId from the placeholder text
        const placeholderMatch = actualContent.match(/Module ID: (.*?)<\/div>/);
        if (placeholderMatch && moduleContent && moduleContent[placeholderMatch[1]]) {
          console.log(`Found content from placeholder text ${placeholderMatch[1]}`);
          actualContent = moduleContent[placeholderMatch[1]];
        }
      }
      
      // Process content that might be in JSON format
      try {
        // Check if content seems to be JSON
        if (typeof actualContent === 'string') {
          // More comprehensive check for HubSpot module JSON format
          // Look for patterns like "path":"@hubspot/email_footer" or schema_version
          if ((actualContent.includes('path') && 
              (actualContent.includes('@hubspot') || actualContent.includes('schema_version'))) || 
              (actualContent.includes('module_id') && actualContent.includes('css_class'))) {
            
            console.log(`Detected HubSpot module configuration for ${module.id}, converting to HTML`);
            
            // Try to extract complete JSON object if it's embedded in other content
            // This handles cases where JSON is part of a larger string
            const jsonStartIndex = actualContent.indexOf('{');
            const jsonEndIndex = actualContent.lastIndexOf('}') + 1;
            
            if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
              const jsonPart = actualContent.substring(jsonStartIndex, jsonEndIndex);
              try {
                // First try direct conversion
                let convertedHTML = convertHubSpotModuleToHTML(jsonPart);
                
                // If conversion returned the same JSON, it likely failed
                if (convertedHTML === jsonPart || convertedHTML.includes('"path":"@hubspot')) {
                  console.log(`First conversion attempt failed, trying with modified JSON`);
                  
                  // Try to fix incomplete JSON by ensuring it has required fields for conversion
                  let jsonObj = JSON.parse(jsonPart);
                  
                  // Add missing fields that might help with rendering
                  if (!jsonObj.module_id && jsonObj.path) {
                    jsonObj.module_id = jsonObj.path.replace('@hubspot/', '');
                  }
                  
                  // Special handling for email footer
                  if (jsonObj.path && jsonObj.path.includes('email_footer')) {
                    convertedHTML = `
                      <div style="text-align: center; color: #888888; font-size: 12px; padding: 10px;">
                        <p>© ${new Date().getFullYear()} Company Name. All rights reserved.</p>
                        <p><a href="%%unsub_center_url%%" 
                              style="color: #888888; ${jsonObj.styles?.underline ? 'text-decoration: underline;' : ''}">
                          Unsubscribe
                        </a></p>
                      </div>
                    `;
                  } else {
                    // Try the conversion again with the enhanced object
                    convertedHTML = convertHubSpotModuleToHTML(JSON.stringify(jsonObj));
                  }
                }
                
                actualContent = convertedHTML;
              } catch (innerError) {
                console.warn(`Error parsing embedded JSON for module ${module.id}:`, innerError);
                
                // Fallback for JSON that can't be parsed - create a simple representation
                if (jsonPart.includes('email_footer')) {
                  actualContent = `
                    <div style="text-align: center; color: #888888; font-size: 12px; padding: 10px;">
                      <p>© ${new Date().getFullYear()} Company Name. All rights reserved.</p>
                      <p><a href="%%unsub_center_url%%" 
                            style="color: #888888; text-decoration: underline;">
                        Unsubscribe
                      </a></p>
                    </div>
                  `;
                }
              }
            }
          }
          // Check for regular JSON with common keys
          else if (actualContent.trim().startsWith('{') && 
              (actualContent.includes('"html"') || actualContent.includes('"value"') || 
               actualContent.includes('"content"'))) {
            console.log(`Content for module ${module.id} appears to be regular JSON, parsing`);
            
            try {
              // Parse the JSON
              const jsonData = JSON.parse(actualContent);
              
              // Extract HTML content based on known JSON structures
              if (jsonData.html) {
                actualContent = jsonData.html;
              } else if (jsonData.value) {
                actualContent = jsonData.value;
              } else if (jsonData.content && typeof jsonData.content === 'string') {
                actualContent = jsonData.content;
              } else if (jsonData.content && jsonData.content.html) {
                actualContent = jsonData.content.html;
              } else if (jsonData.text) {
                actualContent = jsonData.text;
              } else {
                actualContent = `<div>Unable to extract content from JSON</div>`;
              }
            } catch (jsonError) {
              console.warn(`Failed to parse JSON for module ${module.id}: ${jsonError}`);
            }
          }
        }
      } catch (jsonError) {
        console.warn(`JSON processing error for module ${module.id}: ${jsonError}`);
      }
      
      // Clean and prepare content for SFMC compatibility 
      actualContent = cleanContentForSFMC(actualContent);
      
      // Create the content block with the best content we have - now in the dedicated folder
      let block;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1} to create content block ${blockName}`);
          
          block = await createSFMCContentBlock(
        auth,
        blockName,
        actualContent,
            contentBlockFolderId,
        module.type
      );
          
          // If we get here, creation was successful
          break;
        } catch (blockError: any) {
          console.error(`Error creating content block (attempt ${retryCount + 1}):`, blockError.message);
          
          if (retryCount === maxRetries) {
            // Last attempt failed, throw error to outer catch
            throw blockError;
          }
          
          // Try to sanitize content further before retry
          console.log(`Sanitizing content for retry attempt ${retryCount + 2}`);
          
          // Remove potentially problematic elements
          actualContent = actualContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')  // Remove scripts
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')  // Remove iframes
            .replace(/style="[^"]*"/gi, '')  // Remove inline styles which can be problematic
            .replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
          
          // If after sanitization content is nearly empty, create basic fallback
          if (actualContent.replace(/<[^>]*>/g, '').trim().length < 10) {
            actualContent = `<div style="padding:10px;border:1px dashed #ccc">
              <p>Content for: ${module.id}</p>
            </div>`;
          }
          
          retryCount++;
          
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!block) {
        throw new Error(`Failed to create content block after ${maxRetries + 1} attempts`);
      }
      
      // Ensure we have a valid ID - if not, use alternative fields or generate one
      const blockId = block.id || block.objectID || parseInt(block.customerKey?.split('-')[0], 16) || Date.now();
      
      // Try to extract the numeric ID from the response - crucial for ContentBlockById to work
      let numericId: number;
      
      // First try direct ID from response
      if (typeof block.id === 'number') {
        numericId = block.id;
      } 
      // Next check if it's a string that contains a number
      else if (typeof block.id === 'string' && !isNaN(parseInt(block.id, 10))) {
        numericId = parseInt(block.id, 10);
      }
      // Try objectID which is sometimes used
      else if (typeof block.objectID === 'number') {
        numericId = block.objectID;
      }
      // Parse from customer key as last resort
      else if (block.customerKey && typeof block.customerKey === 'string') {
        // Try different parsing approaches - SFMC sometimes uses the first part of the hex customerKey
        const hexId = block.customerKey.split('-')[0];
        if (hexId) {
          numericId = parseInt(hexId, 16);
        } else {
          // Fallback to just parsing any number in the customerKey
          const matches = block.customerKey.match(/\d+/);
          if (matches && matches[0]) {
            numericId = parseInt(matches[0], 10);
          } else {
            // Ultimate fallback
            numericId = Date.now();
          }
        }
      } else {
        // Last resort
        numericId = Date.now();
      }
      
      // Verify we have a valid numeric ID
      if (isNaN(numericId)) {
        console.warn(`Invalid numeric ID for block ${block.name}, using fallback`);
        numericId = Date.now();
      }
      
      console.log(`Content block ID mapping: ID=${block.id}, objectID=${block.objectID}, customerKey=${block.customerKey}, numericId=${numericId}`);
      
      createdBlocks.push({
        id: module.id,
        name: blockName,
        customerKey: block.customerKey,
        numericId: numericId,
        type: module.type,
        slotName
      });
      
      console.log(`Successfully created content block ${blockName} of type ${module.type} with ID ${blockId} in folder ${contentBlockFolderId}`);
    } catch (error) {
      console.error(`Error creating content block for module ${module.id}:`, error);
    }
  }
  
  // Now replace all placeholders with proper AMPscript ContentBlockById functions
  for (const block of createdBlocks) {
    const placeholder = `<div class="ampscript-placeholder" data-module-id="${block.id}"></div>`;
    
    // Ensure we have a valid numeric ID for AMPscript
    const contentBlockId = block.numericId || 0;
    
    console.log(`Using content block ID ${contentBlockId} for module ${block.id}`);
    
    // Generate simple AMPscript to reference content blocks
    const ampscriptBlock = `%%=ContentBlockById(${contentBlockId})=%%`;
    
    processedContent = processedContent.replace(placeholder, ampscriptBlock);
  }
  
  // Don't add global AMPscript - use the content directly
  processedContent = `${processedContent}`;
  
  // Create template HTML with AMPscript for content blocks
  const templateHtml = `%%[
/* Template for ${emailName} */
/* Created ${new Date().toISOString()} */
]%%

<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${emailName}</title>
  <style type="text/css">
    /* Base styles for email compatibility */
    body { margin: 0; padding: 0; min-width: 100%; width: 100% !important; height: 100% !important; }
    body, table, td, div, p, a { -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 1.5; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; border-spacing: 0; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    /* Basic layout */
    .content-block { margin-bottom: 10px; }
  </style>
</head>
<body>
  %%[/* Content blocks start */]%%
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
    <tr>
      <td align="center" valign="top" style="padding: 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
          <tr>
            <td align="left" valign="top">
              ${processedContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  %%[/* Content blocks end */]%%
</body>
</html>
  `;
  
  return {
    contentBlocks: createdBlocks,
    templateHtml,
    contentBlockFolderId
  };
}

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

// Get SFMC folders
export const getSFMCFolders = async (
  auth: SFMCAuth & { accessToken: string }
) => {
  try {
    // First try getting all top-level folders
    const response = await axios.get(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/categories`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    let folders = response.data.items || [];
    console.log(`Retrieved ${folders.length} top-level folders`);
    
    // Now fetch subfolders for each top-level folder
    const allFolders = [...folders];
    
    // Process each parent folder to get its children
    for (const folder of folders) {
      try {
        const subFoldersResponse = await axios.get(
          `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/categories?$filter=parentId%20eq%20${folder.id}`,
          {
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (subFoldersResponse.data.items && subFoldersResponse.data.items.length > 0) {
          console.log(`Found ${subFoldersResponse.data.items.length} subfolders in ${folder.name}`);
          allFolders.push(...subFoldersResponse.data.items);
          
          // Process another level of subfolders if needed
          for (const subFolder of subFoldersResponse.data.items) {
            try {
              const deepSubFoldersResponse = await axios.get(
                `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/categories?$filter=parentId%20eq%20${subFolder.id}`,
                {
                  headers: {
                    'Authorization': `Bearer ${auth.accessToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              
              if (deepSubFoldersResponse.data.items && deepSubFoldersResponse.data.items.length > 0) {
                console.log(`Found ${deepSubFoldersResponse.data.items.length} deep subfolders in ${subFolder.name}`);
                allFolders.push(...deepSubFoldersResponse.data.items);
              }
            } catch (deepError) {
              console.warn(`Error fetching deep subfolders for ${subFolder.name}:`, deepError);
            }
          }
        }
      } catch (subFolderError) {
        console.warn(`Error fetching subfolders for ${folder.name}:`, subFolderError);
      }
    }
    
    // Also try the alternative endpoint that sometimes returns more folders
    try {
      const alternateResponse = await axios.get(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/folders?$pagesize=500`,
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (alternateResponse.data.items) {
        // Filter to content builder folders only and deduplicate
        const contentBuilderFolders = alternateResponse.data.items.filter(
          (folder: any) => folder.contentType === 'asset' || folder.contentType === 'asset_library'
        );
        
        // Deduplicate by ID
        const existingIds = new Set(allFolders.map((f: any) => f.id));
        const newFolders = contentBuilderFolders.filter((f: any) => !existingIds.has(f.id));
        
        if (newFolders.length > 0) {
          console.log(`Found ${newFolders.length} additional folders from alternate endpoint`);
          allFolders.push(...newFolders);
        }
      }
    } catch (alternateError) {
      console.warn('Error fetching from alternate folders endpoint:', alternateError);
    }
    
    console.log(`Total SFMC folders found: ${allFolders.length}`);
    
    return {
      items: allFolders,
      count: allFolders.length,
      page: 1,
      pageSize: allFolders.length,
      totalCount: allFolders.length
    };
  } catch (error: any) {
    console.error('Error getting SFMC folders:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// Create a folder in SFMC Content Builder
export const createSFMCFolder = async (
  auth: SFMCAuth & { accessToken: string },
  name: string,
  parentId: number = 0
) => {
  try {
    const response = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/categories`,
      {
        name,
        parentId
      },
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('SFMC folder created:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.error('Error creating SFMC folder:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// Test function to confirm content block can be retrieved by ID
export const testContentBlockById = async (
  auth: SFMCAuth & { accessToken: string },
  contentBlockId: number
) => {
  try {
    console.log(`Testing retrieval of content block by ID: ${contentBlockId}`);
    
    // Get the content block details
    const response = await axios.get(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets/${contentBlockId}`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`Successfully retrieved content block ${contentBlockId}:`, response.data.name);
    return response.data;
  } catch (error: any) {
    console.error(`Error retrieving content block by ID ${contentBlockId}:`, error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// Get or create a content block folder by name
export const getOrCreateContentBlockFolder = async (
  auth: SFMCAuth & { accessToken: string },
  folderName: string,
  parentId: number = 0
): Promise<number> => {
  try {
    // First check if the folder already exists
    const foldersResponse = await getSFMCFolders(auth);
    const folders = foldersResponse.items || [];
    
    // Look for a folder with this name under the parent
    const existingFolder = folders.find(folder => 
      folder.name === folderName && folder.parentId === parentId
    );
    
    if (existingFolder) {
      console.log(`Found existing content block folder: ${folderName} (ID: ${existingFolder.id})`);
      return existingFolder.id;
    }
    
    // If folder doesn't exist, create it
    console.log(`Creating new content block folder: ${folderName} under parent ${parentId}`);
    const newFolder = await createSFMCFolder(auth, folderName, parentId);
    const folderId = newFolder.id || newFolder.categoryId;
    
    if (!folderId) {
      throw new Error(`Failed to get ID from folder creation response for ${folderName}`);
    }
    
    console.log(`Created content block folder: ${folderName} (ID: ${folderId})`);
    return folderId;
  } catch (error: any) {
    console.error(`Error getting/creating content block folder "${folderName}":`, error);
    throw error;
  }
};

// Get Email Studio/Marketing Email folders
export const getSFMCEmailFolders = async (auth: SFMCAuth & { accessToken: string }): Promise<SFMCFolder[]> => {
  let folders: SFMCFolder[] = [];

  try {
    // First try the messaging/v1 API for email folders
    console.log('Fetching email folders with messaging/v1 endpoint...');
    const response = await axios.get(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/messaging/v1/email/definitions/folders`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (response.data && Array.isArray(response.data.items)) {
      folders = response.data.items.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        contentType: 'email',
      }));
      console.log(`Successfully retrieved ${folders.length} email folders from messaging/v1 API`);
      return folders;
    } else {
      console.warn('Unexpected format from messaging/v1 email folders endpoint, trying alternate endpoint');
    }
  } catch (error) {
    console.error('Error fetching email folders with messaging/v1 endpoint:', error);
  }

  try {
    // Try alternate folder endpoint
    console.log('Fetching from alternate folders endpoint...');
    const response = await axios.get(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/categories?$filter=contentType eq 'email'`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (response.data && Array.isArray(response.data.items)) {
      folders = response.data.items.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        contentType: 'email',
      }));
      console.log(`Successfully retrieved ${folders.length} email folders from asset/v1 API`);
      return folders;
    } else {
      console.warn('Unexpected format from asset/v1 content categories endpoint, trying legacy API');
    }
  } catch (error) {
    console.error('Error fetching from alternate folders endpoint:', error);
  }

  try {
    // Try the legacy email definitions endpoint
    console.log('Trying legacy email definitions endpoint...');
    const response = await axios.get(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/email/v1/email-definitions/folders`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (response.data && Array.isArray(response.data.items)) {
      folders = response.data.items.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        contentType: 'email',
      }));
      console.log(`Successfully retrieved ${folders.length} email folders from legacy email definitions API`);
      return folders;
    } else {
      console.warn('Unexpected format from legacy email definitions endpoint, trying final fallback');
    }
  } catch (error) {
    console.error('Error fetching email definitions:', error);
  }

  try {
    // Final attempt - email studio folder API
    console.log('Trying email studio folder API as final attempt...');
    const response = await axios.get(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/email/v1/studios/folders`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      }
    );

    if (response.data && Array.isArray(response.data.items)) {
      folders = response.data.items.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        contentType: 'email',
      }));
      console.log(`Successfully retrieved ${folders.length} email folders from email studio API`);
      return folders;
    }
  } catch (error) {
    console.error('Error fetching email folders with legacy API:', error);
  }

  // If all APIs fail, create a default set of folders
  console.warn('Could not retrieve any email folders from API. Using default folder.');
  
  // Add a root folder as a fallback
  folders = [
    {
      id: 0,
      name: 'Email Studio',
      parentId: null,
      contentType: 'email',
    }
  ];
  
  return folders;
};

// Clean and prepare HubSpot content for SFMC compatibility
function cleanContentForSFMC(content: string): string {
  // Skip if not a string
  if (typeof content !== 'string') {
    return content;
  }
  
  // Initialize cleaned content
  let cleanedContent = content;
  
  // First check if this is raw JSON content that should be converted
  if (content.includes('module_id') && (content.includes('path') || content.includes('schema_version'))) {
    // Use our module converter
    cleanedContent = convertHubSpotModuleToHTML(content);
  }
  
  // Convert common HubSpot macros to SFMC equivalents
  cleanedContent = cleanedContent
    // Replace HubSpot personalization tokens
    .replace(/\{\{contact\.first_name\}\}/g, '%%=v(@firstName)=%%')
    .replace(/\{\{contact\.last_name\}\}/g, '%%=v(@lastName)=%%')
    .replace(/\{\{contact\.email\}\}/g, '%%=v(@email)=%%')
    
    // Replace any remaining HubSpot macro syntax
    .replace(/\{\{[^}]+\}\}/g, '') // Remove any unprocessed HubSpot macros
    
    // Clean up HubSpot conditional logic
    .replace(/\{%\s*if\s*[^%]+%\}/g, '') // Remove HubSpot if statements
    .replace(/\{%\s*endif\s*%\}/g, '')    // Remove HubSpot endif statements
    .replace(/\{%\s*else\s*%\}/g, '')     // Remove HubSpot else statements
    
    // Fix potential issues with inline styles
    .replace(/style="([^"]*)"/g, (match, styles) => {
      // Fix common style issues (color: # without a value)
      const fixedStyles = styles
        .replace(/color:\s*#(?!\w)/g, 'color: #000')
        .replace(/background-color:\s*#(?!\w)/g, 'background-color: #FFF');
      return `style="${fixedStyles}"`;
    })
    
    // Fix link targets (SFMC sometimes has issues with _blank)
    .replace(/target="_blank"/g, 'target="_blank" rel="noopener"')
    
    // Fix common encoding issues
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    
    // Clean up whitespace and newlines in a way that preserves proper structure
    .replace(/>\s+</g, '><')             // Remove whitespace between tags
    .replace(/\n\s*\n/g, '\n')           // Remove consecutive empty lines
    .replace(/\r\n?/g, '\n');            // Normalize line endings
  
  // Handle SFMC-specific requirements
  cleanedContent = cleanedContent
    // Ensure all img tags have width/height attributes for better email client support
    .replace(/<img([^>]*)>/g, (match, attributes) => {
      if (!attributes.includes('width=') && !attributes.includes('height=')) {
        return match.replace('<img', '<img width="100%" height="auto"');
      }
      return match;
    });
  
  return cleanedContent;
}

// Create a template-based email in SFMC (without content blocks)
export const createSFMCTemplateEmail = async (
  auth: SFMCAuth & { accessToken: string },
  email: {
    name: string;
    subject: string;
    content: string;
    fromName?: string;
    fromEmail?: string;
    status?: string;
    moduleContent?: Record<string, string>;
  },
  templateId: number | null,
  folderId: number
) => {
  try {
    console.log(`Creating template-based email "${email.name}" in folder ID: ${folderId}`);
    
    // Process HubSpot content to make it SFMC compatible
    let processedContent = email.content;
    
    // If moduleContent exists, inject it directly into the template
    if (email.moduleContent && Object.keys(email.moduleContent).length > 0) {
      console.log(`Processing ${Object.keys(email.moduleContent).length} module content items`);
      
      // Replace module placeholders with actual content
      Object.entries(email.moduleContent).forEach(([moduleId, moduleContent]) => {
        // Convert module content from HubSpot format to HTML if needed
        if (typeof moduleContent === 'string' && 
            (moduleContent.includes('module_id') || 
             moduleContent.includes('"path"') || 
             moduleContent.includes('schema_version'))) {
          console.log(`Converting HubSpot module ${moduleId} to HTML`);
          moduleContent = convertHubSpotModuleToHTML(moduleContent);
        }
        
        // Replace the placeholder with the module content
        const placeholder = `<div class="hubspot-module" data-module-id="${moduleId}"></div>`;
        processedContent = processedContent.replace(placeholder, moduleContent);
      });
    }

    // First create the email as a content builder asset
    const assetRequestBody = {
      name: email.name,
      assetType: {
        name: "htmlemail",
        id: 208
      },
      content: processedContent,
      views: {
        html: {
          content: processedContent
        }
      },
      category: {
        id: folderId
      }
    };
    
    console.log(`Creating SFMC email asset with request body: ${JSON.stringify({...assetRequestBody, content: "[content truncated]"})}`);
    
    const assetResponse = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      assetRequestBody,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`SFMC content asset creation response:`, assetResponse.data);
    
    // Now create the actual email definition that uses this asset
    const emailDefinitionRequestBody: {
      name: string;
      description: string;
      customerKey: string;
      subject: string;
      categoryId: number;
      content: {
        customerKey: string;
        email?: string;
        name?: string;
      }
    } = {
      name: email.name,
      description: `Created from HubSpot email migration: ${email.name}`,
      customerKey: `HubSpot_${Date.now()}`,
      subject: email.subject,
      categoryId: folderId,
      content: {
        customerKey: assetResponse.data.customerKey
      }
    };
    
    // Add from information if provided
    if (email.fromName || email.fromEmail) {
      emailDefinitionRequestBody.content.email = email.fromEmail || 'default@example.com';
      emailDefinitionRequestBody.content.name = email.fromName || 'Default Name';
    }
    
    console.log(`Creating email definition with request body:`, emailDefinitionRequestBody);
    
    // Use the legacy email endpoint which is more reliable
    const emailDefinitionResponse = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/legacy/v1/beta/email/definitions`,
      emailDefinitionRequestBody,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`SFMC email definition creation response:`, emailDefinitionResponse.data);
    
    return {
      ...emailDefinitionResponse.data,
      assetId: assetResponse.data.id,
      customerKey: assetResponse.data.customerKey,
      htmlContent: "[content truncated for log]"
    };
  } catch (error: any) {
    console.error('Error creating SFMC template-based email:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Try an alternative approach if the first one fails
    try {
      console.log("First approach failed. Trying alternative approach with classic email creation...");
      
      // Create a simpler email directly in SFMC
      const alternativeRequestBody = {
        name: email.name,
        contentType: "application/vnd.etmc.email.HTMLContent",
        content: email.content,
        subject: email.subject,
        folderId: folderId,
        options: {
          generateTextFrom: "HTML"
        }
      };
      
      // Try the standard email endpoints
      const alternativeResponse = await axios.post(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/hub/v1/emails`,
        alternativeRequestBody,
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log(`Alternative email creation successful:`, alternativeResponse.data);
      return alternativeResponse.data;
    } catch (altError: any) {
      console.error('Alternative approach also failed:', altError);
      if (altError.response) {
        console.error('Alt response status:', altError.response.status);
        console.error('Alt response data:', JSON.stringify(altError.response.data, null, 2));
      }
      
      throw error; // Throw the original error
    }
  }
};

// Check if a folder ID belongs to Email Studio
export const isEmailStudioFolder = async (
  auth: SFMCAuth & { accessToken: string },
  folderId: number
): Promise<boolean> => {
  if (!folderId || folderId === 0) {
    // Default folder is considered an Email Studio folder
    return true;
  }
  
  try {
    // Try to fetch Email Studio folders
    const emailFolders = await getSFMCEmailFolders(auth);
    
    // Check if the folder ID exists in the Email Studio folders
    const isEmailFolder = emailFolders.some(folder => folder.id === folderId);
    
    if (isEmailFolder) {
      console.log(`Confirmed folder ID ${folderId} is an Email Studio folder`);
      return true;
    }
    
    // If not found in Email Studio folders, check if it's in Content Builder
    const contentBuilderFolders = await getSFMCFolders(auth);
    const isContentBuilderFolder = contentBuilderFolders.items?.some(folder => folder.id === folderId);
    
    if (isContentBuilderFolder) {
      console.log(`Folder ID ${folderId} is a Content Builder folder, not an Email Studio folder`);
      return false;
    }
    
    console.log(`Folder ID ${folderId} was not found in either Email Studio or Content Builder`);
    return false;
  } catch (error) {
    console.error('Error checking if folder is an Email Studio folder:', error);
    // If we can't determine the folder type, assume it's not an Email Studio folder
    return false;
  }
};

// Create a template-based email using SOAP API with better folder handling
export const createSFMCTemplateSoapEmail = async (
  auth: SFMCAuth & { accessToken: string },
  email: {
    name: string;
    subject: string;
    content: string;
    fromName?: string;
    fromEmail?: string;
    templateId?: string;
    moduleContent?: Record<string, string>;
  },
  folderId: number
) => {
  try {
    console.log(`Creating template-based email via SOAP API: "${email.name}" in folder ID: ${folderId}`);
    
    // Validate folder ID and use default if needed
    let folderIdToUse = folderId;
    if (!folderIdToUse || isNaN(Number(folderIdToUse))) {
      console.warn(`Invalid folder ID: ${folderId}. Using default folder.`);
      // Instead of 0, use a known visible folder ID
      folderIdToUse = 14030; // Set this to a known folder ID in your account
      console.log(`Using known visible folder ID: ${folderIdToUse} instead of the default/root folder (0)`);
    } else {
      folderIdToUse = Number(folderIdToUse);
      
      // If folder ID is 0, replace with a known visible folder
      if (folderIdToUse === 0) {
        const knownVisibleFolderId = 14030; // Set this to a known folder ID in your account
        console.log(`Folder ID is 0 (default/root). Using a known visible folder (${knownVisibleFolderId}) instead`);
        folderIdToUse = knownVisibleFolderId;
      }
    }
    
    // Check if the folder is an Email Studio folder
    const isEmailFolder = await isEmailStudioFolder(auth, folderIdToUse);
    
    if (!isEmailFolder) {
      console.warn(`Folder ID ${folderIdToUse} is not an Email Studio folder. SOAP API requires Email Studio folders.`);
      
      // Try to get a default Email Studio folder
      try {
        const emailFolders = await getSFMCEmailFolders(auth);
        if (emailFolders && emailFolders.length > 0) {
          // Try to find a suitable Email Studio folder
          const suitableFolder = emailFolders.find(
            folder => 
              folder.name.toLowerCase().includes('email') || 
              folder.name.toLowerCase().includes('my emails') ||
              folder.name.toLowerCase().includes('hubspot')
          );
          
          if (suitableFolder) {
            folderIdToUse = suitableFolder.id;
            console.log(`Found suitable Email Studio folder: ${suitableFolder.name} (ID: ${folderIdToUse})`);
          } else {
            folderIdToUse = emailFolders[0].id;
            console.log(`Using first available Email Studio folder: ${emailFolders[0].name} (ID: ${folderIdToUse})`);
          }
        }
      } catch (folderError) {
        console.error('Error finding alternative Email Studio folder:', folderError);
      }
    } else {
      console.log(`Confirmed folder ID ${folderIdToUse} is a valid Email Studio folder.`);
    }
    
    // Process HubSpot content to make it SFMC compatible
    let processedContent = email.content;
    
    // Ensure content is not empty
    if (!processedContent || processedContent.trim() === '') {
      console.warn(`Email content is empty for "${email.name}". Using placeholder content.`);
      processedContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #333;">${email.name}</h1>
        <p>This is a placeholder for migrated email content.</p>
      </div>`;
    }
    
    // Process module content if provided
    if (email.moduleContent && Object.keys(email.moduleContent).length > 0) {
      Object.entries(email.moduleContent).forEach(([moduleId, moduleContent]) => {
        if (typeof moduleContent === 'string' && 
            (moduleContent.includes('module_id') || 
             moduleContent.includes('"path"') || 
             moduleContent.includes('schema_version'))) {
          moduleContent = convertHubSpotModuleToHTML(moduleContent);
        }
        
        const placeholder = `<div class="hubspot-module" data-module-id="${moduleId}"></div>`;
        processedContent = processedContent.replace(placeholder, moduleContent);
      });
    }
    
    // Step 1: Create the email template if templateId is not provided
    let templateId = email.templateId;
    
    if (!templateId) {
      try {
        console.log(`Creating SFMC email template via SOAP API...`);
        
        const templateName = `${email.name}_Template`;
        
        const emailXml = `
          <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
            <soapenv:Header>
              <fueloauth xmlns="http://exacttarget.com">${auth.accessToken}</fueloauth>
            </soapenv:Header>
            <soapenv:Body>
              <CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
                <Objects xsi:type="Email">
                  <Name>${escapeXml(templateName)}</Name>
                  <Subject>${escapeXml(email.subject || "")}</Subject>
                  <CategoryID>${folderIdToUse}</CategoryID>
                  <HTMLBody><![CDATA[${processedContent}]]></HTMLBody>
                  <TextBody>${escapeXml(email.name || "Text version")}</TextBody>
                  <IsActive>true</IsActive>
                  <IsHTMLPaste>true</IsHTMLPaste>
                  ${email.fromName ? `<FromName>${escapeXml(email.fromName)}</FromName>` : ''}
                  ${email.fromEmail ? `<FromAddress>${escapeXml(email.fromEmail)}</FromAddress>` : ''}
                </Objects>
              </CreateRequest>
            </soapenv:Body>
          </soapenv:Envelope>
        `;
        
        const templateResponse = await axios.post(
          `https://${auth.subdomain}.soap.marketingcloudapis.com/Service.asmx`,
          emailXml,
          {
            headers: {
              'Content-Type': 'text/xml',
              'SOAPAction': 'Create'
            }
          }
        );
        
        const templateResponseText = templateResponse.data.toString();
        console.log('SOAP template creation response:', templateResponseText);
        
        // Check for both ObjectID and NewID in the response
        const templateObjectIDMatch = templateResponseText.match(/<ObjectID>(.*?)<\/ObjectID>/);
        const templateNewIDMatch = templateResponseText.match(/<NewID>(.*?)<\/NewID>/);
        
        // Try to get the ID from ObjectID first, then NewID as fallback
        templateId = templateObjectIDMatch ? templateObjectIDMatch[1] : 
                    (templateNewIDMatch ? templateNewIDMatch[1] : null);
                    
        if (!templateId) {
          console.warn('Failed to extract template ID from SOAP response, using fallback approach');
          throw new Error('Failed to extract template ID from SOAP response');
        }
        
        console.log(`Created template with ID: ${templateId}`);
      } catch (templateError) {
        console.error('SOAP API template creation failed, using email directly:', templateError);
        // Skip template creation and create email directly in next step
      }
    }
    
    // Step 2: Create the email
    console.log(`Creating SFMC email for template ID ${templateId} via SOAP API...`);
    
    const emailXml = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <soapenv:Header>
          <fueloauth xmlns="http://exacttarget.com">${auth.accessToken}</fueloauth>
        </soapenv:Header>
        <soapenv:Body>
          <CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
            <Objects xsi:type="Email">
              <Name>${escapeXml(email.name)}</Name>
              <Subject>${escapeXml(email.subject || "")}</Subject>
              <CategoryID>${folderIdToUse}</CategoryID>
              <HTMLBody><![CDATA[${processedContent}]]></HTMLBody>
              <TextBody>${escapeXml(email.name || "Text version")}</TextBody>
              <IsActive>true</IsActive>
              <IsHTMLPaste>true</IsHTMLPaste>
              ${templateId ? `<TemplateID>${templateId}</TemplateID>` : ''}
              ${email.fromName ? `<FromName>${escapeXml(email.fromName)}</FromName>` : ''}
              ${email.fromEmail ? `<FromAddress>${escapeXml(email.fromEmail)}</FromAddress>` : ''}
            </Objects>
          </CreateRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
    
    const emailResponse = await axios.post(
      `https://${auth.subdomain}.soap.marketingcloudapis.com/Service.asmx`,
      emailXml,
      {
        headers: {
          'Content-Type': 'text/xml',
          'SOAPAction': 'Create'
        }
      }
    );
    
    const emailResponseText = emailResponse.data.toString();
    console.log('SOAP email creation response:', emailResponseText);
    
    // Check for both ObjectID and NewID in the response
    const emailObjectIDMatch = emailResponseText.match(/<ObjectID>(.*?)<\/ObjectID>/);
    const emailNewIDMatch = emailResponseText.match(/<NewID>(.*?)<\/NewID>/);
    const statusMatch = emailResponseText.match(/<StatusCode>(.*?)<\/StatusCode>/);
    
    // Try to get the ID from ObjectID first, then NewID as fallback
    const emailId = emailObjectIDMatch ? emailObjectIDMatch[1] : 
                  (emailNewIDMatch ? emailNewIDMatch[1] : null);
    const status = statusMatch ? statusMatch[1] : 'Unknown';
    
    if (!emailId && emailNewIDMatch && emailNewIDMatch[1]) {
      console.log(`Email created successfully with NewID: ${emailNewIDMatch[1]} (SOAP API format)`);
    }
    
    if (emailId) {
      console.log(`Successfully created true template-based email "${email.name}" in SFMC with ID: ${emailId} using template ID: ${templateId}`);
      
      // Try to add email classification to make sure it appears in Email Studio
      try {
        const classificationXml = `
          <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
            <soapenv:Header>
              <fueloauth xmlns="http://exacttarget.com">${auth.accessToken}</fueloauth>
            </soapenv:Header>
            <soapenv:Body>
              <CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
                <Objects xsi:type="EmailSendDefinition">
                  <Name>${escapeXml(email.name)}_SendDefinition</Name>
                  <CategoryID>${folderIdToUse}</CategoryID>
                  <Email>
                    <ID>${emailId}</ID>
                  </Email>
                  <SendClassification>
                    <CustomerKey>Default Commercial</CustomerKey>
                  </SendClassification>
                </Objects>
              </CreateRequest>
            </soapenv:Body>
          </soapenv:Envelope>
        `;
        
        const classificationResponse = await axios.post(
          `https://${auth.subdomain}.soap.marketingcloudapis.com/Service.asmx`,
          classificationXml,
          {
            headers: {
              'Content-Type': 'text/xml',
              'SOAPAction': 'Create'
            }
          }
        );
        
        console.log('Successfully added email classification for email ID:', emailId);
      } catch (classificationError: any) {
        console.warn(`Warning: Could not add email classification: ${classificationError.message || 'Unknown error'}`);
      }
      
      return {
        id: emailId,
        templateId: templateId,
        name: email.name,
        subject: email.subject,
        status: "Created",
        createdDate: new Date().toISOString(),
        isTemplate: true
      };
    } else {
      console.warn(`Failed to extract email ID from SOAP response. Status: ${status}`);
      throw new Error(`Failed to extract email ID from SOAP response. Status: ${status}`);
    }
  } catch (error: any) {
    console.error('Error creating SFMC template-based email via SOAP:', error);
    
    // Try REST API as fallback for email creation
    try {
      console.log(`Falling back to REST API for email creation`);
      
      const restEmailResponse = await axios.post(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
        {
          name: email.name,
          assetType: { 
            name: "htmlemail", 
            id: 208 
          },
          content: email.content,
          category: {
            id: folderId
          },
          views: {
            html: {
              content: email.content
            },
            text: {
              content: email.name || "Text version"
            },
            subjectLine: {
              content: email.subject || "No Subject"
            }
          },
          data: {
            email: {
              subject: email.subject || "No Subject",
              isHtmlPaste: true,
              emailFromName: email.fromName || '',
              emailFromEmail: email.fromEmail || ''
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return {
        id: restEmailResponse.data.id,
        name: email.name,
        subject: email.subject,
        status: "Created via REST API fallback",
        createdDate: new Date().toISOString(),
        isTemplate: false
      };
    } catch (restError) {
      console.error('REST API fallback also failed:', restError);
      throw error; // Throw the original error
    }
  }
};

// Create a Content Builder email that mimics template functionality using proper slots and blocks
export const createSFMCEnhancedEmail = async (auth: SFMCAuth, email: any, folderId: string | null): Promise<{
  id: string;
  name: string;
  subject: string;
  status: string;
  createdDate: string;
  isTemplate: boolean;
  isEnhancedContentBuilder?: boolean;
  templateId: string | null;
}> => {
  console.log(`Creating enhanced email with slots and blocks: "${email.name}"`);
  console.log(`Content length: ${email.content?.length || 0} characters`);
  
  try {
    // Debug content if it's very short
    if (email.content?.length < 100) {
      console.log(`WARNING: Email content is suspiciously short (${email.content?.length} chars): "${email.content}"`);
    }
    
    // Validate folder ID
    const folderIdToUse = folderId || 0;
    if (!folderIdToUse) {
      console.warn('No folder ID provided, using default folder');
    }
    
    // Log important email properties for debugging
    console.log(`Email properties: subject="${email.subject}", fromName="${email.fromName}", fromEmail="${email.fromEmail}"`);
    
    // Process content from HubSpot to make it compatible with SFMC
    let processedContent = email.content || '';
    
    // Handle empty content with a fallback
    if (!processedContent || processedContent.trim() === '') {
      console.warn('Email content is empty, using fallback content');
      processedContent = `<div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #333;">Email Content Unavailable</h1>
        <p>The content for this email could not be retrieved from HubSpot.</p>
      </div>`;
    }
    
    // Enhanced content processing for SFMC
    processedContent = processHubSpotContentForSFMC(processedContent);
    console.log(`Processed content length: ${processedContent.length} characters`);
    
    // Log the first 200 characters of the processed content for debugging
    console.log(`Processed content preview: "${processedContent.substring(0, 200)}..."`);
    
    // Check if content appears to be valid HTML
    if (!processedContent.includes('<')) {
      console.warn('Content does not appear to be HTML - attempting to wrap with HTML tags');
      processedContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">${processedContent}</div>`;
    }
    
    // Ensure HTML is properly formatted
    processedContent = ensureClosedHtmlTags(processedContent);
    
    // Create block structure for the email
    const blocks = [
      {
        "content": processedContent,
        "assetType": {
          "name": "htmlblock",
          "id": 197
        },
        "slots": [
          {
            "name": "main-content",
            "superContent": ""
          }
        ],
        "views": {
          "html": {
            "content": processedContent
          }
        }
      }
    ];
    
    // Create a design JSON structure for the email
    const designContent = {
      "design": {
        "head": {
          "css": "@import url('https://fonts.googleapis.com/css2?family=Arial:wght@400;700&display=swap');"
        }
      }
    };
    
    // Create super content JSON for the email
    const superContent = {
      "superContent": {
        "version": 1
      }
    };
    
    // Wrap the content in a template structure to ensure slots work properly
    const templateWrappedContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${email.subject || email.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    [data-type="slot"] { display: block; }
  </style>
</head>
<body>
  <!-- Header Slot -->
  <div data-type="slot" data-key="header" data-label="Email Header" data-max-blocks="1">
    <!-- Header content will be injected here -->
  </div>

  <!-- Main Content Slot -->
  <div data-type="slot" data-key="main-content" data-label="Main Content Area" data-max-blocks="5">
    <!-- Main content blocks will be injected here -->
  </div>
  
  <!-- Footer Slot -->
  <div data-type="slot" data-key="footer" data-label="Email Footer" data-max-blocks="1">
    <!-- Footer content will be injected here -->
  </div>
</body>
</html>
    `;
    
    console.log(`Creating enhanced email via Content Builder API with proper slots and blocks...`);
    
    // Create comprehensive email asset with slots and blocks
    const emailAssetResponse = await axios.post(
      `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      {
        name: email.name,
        assetType: { 
          name: "htmlemail", 
          id: 208 
        },
        content: templateWrappedContent,
        design: designContent,
        superContent: superContent,
        category: {
          id: folderIdToUse
        },
        meta: {
          templateUsage: {
            recipient: true,
            transactional: true
          }
        },
        views: {
          html: {
            content: templateWrappedContent
          },
          text: {
            content: email.name
          },
          subjectline: {
            content: email.subject || email.name
          },
          preheader: {
            content: email.preheader || ""
          }
        },
        data: {
          email: {
            subject: email.subject || email.name,
            preheader: email.preheader || "",
            emailFromName: email.fromName || "Default Sender",
            emailFromEmail: email.fromEmail || "default@example.com"
          }
        },
        // Define blocks for the slots
        blocks: blocks,
        minBlocks: 1,
        maxBlocks: 10,
        allowedBlocks: ["htmlblock", "textblock", "imageblock"]
      },
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const emailId = emailAssetResponse.data.id;
    console.log(`Successfully created enhanced email "${email.name}" in SFMC with ID: ${emailId}`);
    
    // Now try to add an email send definition to make it appear in Email Studio
    try {
      // Try to get email definitions API to register the email for Email Studio
      const sendDefResponse = await axios.post(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/email/v1/email-definitions`,
        {
          name: `${email.name}_SendDefinition`,
          description: `Send definition for email: ${email.name}`,
          status: "Active",
          type: "triggered",
          content: {
            customerKey: `${emailId}`
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log(`Successfully created email send definition for ID: ${emailId}`);
      
      // Try alternate endpoint if the first one doesn't work
      if (!sendDefResponse.data || !sendDefResponse.data.id) {
        const altSendDefResponse = await axios.post(
          `https://${auth.subdomain}.rest.marketingcloudapis.com/messaging/v1/email/definitions`,
          {
            name: `${email.name}_SendDefinition`,
            description: `Send definition for email: ${email.name}`,
            content: {
              email: {
                contentAreasByName: false,
                contentAreas: [
                  {
                    key: "header",
                    content: `<div style="text-align: center; padding: 20px; background-color: #f5f5f5;">
                      <h1 style="color: #333; margin: 0;">${email.name}</h1>
                    </div>`
                  },
                  {
                    key: "main-content",
                    content: processedContent
                  },
                  {
                    key: "footer",
                    content: `<div style="text-align: center; padding: 20px; background-color: #f5f5f5; font-size: 12px; color: #666;">
                      <p>This email was sent by ${email.fromName || "Company Name"}</p>
                      <p>&copy; ${new Date().getFullYear()} All Rights Reserved</p>
                    </div>`
                  }
                ]
              }
            },
            options: {
              trackLinks: true
            },
            assets: [{
              id: emailId,
              type: "htmlemail"
            }]
          },
          {
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        console.log(`Created alternate email send definition for ID: ${emailId}`);
      }
    } catch (sendDefError: any) {
      console.warn(`Warning: Could not create email send definition: ${sendDefError.message || 'Unknown error'}`);
      // Continue even if this fails, as the email is already created
    }
    
    return {
      id: emailId,
      name: email.name,
      subject: email.subject || email.name,
      status: "Created as enhanced template-like email",
      createdDate: new Date().toISOString(),
      isTemplate: true,
      isEnhancedContentBuilder: true,
      templateId: null // Content Builder emails don't have true templates, but we include this for API compatibility
    };
  } catch (error: any) {
    console.error('Error creating enhanced template-like email:', error.message);
    console.error('Error details:', error.response?.data || error);
    
    // Try simple approach as fallback
    try {
      console.log(`Falling back to simple email creation`);
      
      // Ensure we have at least basic content
      const safeContent = email.content || `<div style="padding: 20px;">
        <h1>Email Content</h1>
        <p>Fallback content for email: ${email.name}</p>
      </div>`;
      
      const simpleResponse = await axios.post(
        `https://${auth.subdomain}.rest.marketingcloudapis.com/asset/v1/content/assets`,
        {
          name: email.name,
          assetType: { 
            name: "htmlemail", 
            id: 208 
          },
          content: safeContent,
          category: {
            id: folderId || 0
          },
          views: {
            html: {
              content: safeContent
            },
            text: {
              content: email.name
            },
            subjectline: {
              content: email.subject || email.name
            }
          },
          data: {
            email: {
              subject: email.subject || email.name,
              emailFromName: email.fromName || '',
              emailFromEmail: email.fromEmail || ''
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return {
        id: simpleResponse.data.id,
        name: email.name,
        subject: email.subject || email.name,
        status: "Created as simple email (fallback)",
        createdDate: new Date().toISOString(),
        isTemplate: false,
        templateId: null // No template for simple emails
      };
    } catch (fallbackError: any) {
      console.error("Fallback approach also failed:", fallbackError.message);
      console.error("Fallback error details:", fallbackError.response?.data || fallbackError);
      throw error; // Throw the original error
    }
  }
};

// Create a classic email when a Content Builder folder is mistakenly used
export const createSFMCClassicEmailInContentFolder = async (auth: SFMCAuth, email: any, folderId: string): Promise<{
  id: string;
  name: string;
  subject: string;
  status: string;
  createdDate?: string;
  isTemplate: boolean;
  templateId: string | null;
}> => {
  console.log(`Attempting to create a proper classic email since Content Builder folder was used: "${email.name}"`);
  
  // Check if REST authentication is available
  if (!auth.rest || !auth.rest.baseUri || !auth.rest.accessToken) {
    console.error("REST authentication credentials are missing");
    throw new Error("REST authentication credentials are required to create classic emails");
  }
  
  let processedContent = email.content || "";
  if (!processedContent || processedContent.trim() === "") {
    processedContent = "<div style='font-family: Arial, sans-serif; padding: 20px;'><p>This email content was empty during migration.</p></div>";
    console.warn("Email content was empty, using placeholder content");
  }

  // Use the REST API as shown in the example
  try {
    const endpoint = `${auth.rest.baseUri}asset/v1/content/assets`;
    console.log(`Creating email using REST API endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.rest.accessToken}`
      },
      body: JSON.stringify({
        name: email.name,
        assetType: { 
          name: "htmlemail", 
          id: 208 
        },
        content: processedContent,
        category: {
          id: parseInt(folderId)
        },
        views: {
          html: {
            content: processedContent
          },
          text: {
            content: email.plainTextContent || "This is a text version of the email."
          },
          subjectLine: {
            content: email.subject || "No Subject"
          }
        },
        data: {
          email: {
            subject: email.subject || "No Subject",
            isHtmlPaste: true,
            emailFromName: email.fromName || '',
            emailFromEmail: email.fromEmail || ''
          }
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log("Successfully created email via REST API endpoint:", result);
      return {
        id: result.id || result.ID || "",
        name: email.name,
        subject: email.subject || "No Subject",
        status: "Active",
        createdDate: new Date().toISOString(),
        isTemplate: false,
        templateId: null
      };
    } else {
      const errorText = await response.text();
      console.warn("Failed to create email via REST API:", errorText);
      throw new Error(`Email creation failed: ${errorText}`);
    }
  } catch (error: any) {
    console.warn("Error creating email via REST API:", error.message || "Unknown error");
    throw new Error(`Failed to create email in Content Builder folder: ${error.message || "Unknown error"}`);
  }
};

// Add these helper functions at the end of the file

/**
 * Process HubSpot content to make it compatible with SFMC
 */
function processHubSpotContentForSFMC(content: string): string {
  if (!content) return '';
  
  // Convert HubSpot personalization tokens to SFMC format
  let processed = content
    // Common HubSpot personalization tokens
    .replace(/\{\{contact\.first_name\}\}/g, '%%First_Name%%')
    .replace(/\{\{contact\.last_name\}\}/g, '%%Last_Name%%')
    .replace(/\{\{contact\.email\}\}/g, '%%EmailAddr%%')
    .replace(/\{\{contact\.company\}\}/g, '%%Company%%')
    // Convert HubSpot date formats
    .replace(/\{\{today\}\}/g, '%%=Format(Now(), "MM/dd/yyyy")=%%')
    // Special characters and entities
    .replace(/&nbsp;/g, ' ')
    // Fix any broken or unclosed tags
    .replace(/<([a-z][a-z0-9]*)[^>]*?(\/?)>/gi, function(match, tagName, closeSlash) {
      // Make sure void elements are self-closed
      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
      if (voidElements.includes(tagName.toLowerCase()) && !closeSlash) {
        return match.replace(/>$/, ' />');
      }
      return match;
    });
  
  // Fix HubSpot's special containers
  processed = processed
    .replace(/<div class="hs_cos_wrapper[^>]*>(.*?)<\/div>/gis, '$1')
    .replace(/<span class="hs-cta-wrapper[^>]*>(.*?)<\/span>/gis, '$1');
  
  // Add proper wrapping if needed
  if (!processed.includes('<body') && !processed.includes('<div')) {
    processed = `<div style="font-family: Arial, sans-serif;">${processed}</div>`;
  }
  
  return processed;
}

/**
 * Ensure all HTML tags are properly closed
 */
function ensureClosedHtmlTags(html: string): string {
  if (!html) return '';
  
  // Simple stack-based approach to ensure tags are closed
  const openTags: string[] = [];
  let processedHtml = html;
  
  // Find all tags
  const tagPattern = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  const selfClosingPattern = /<([a-z][a-z0-9]*)[^>]*\/>/gi;
  
  // Remove self-closing tags from consideration
  processedHtml = processedHtml.replace(selfClosingPattern, '');
  
  // Find open/close tags
  let match;
  while ((match = tagPattern.exec(processedHtml)) !== null) {
    // Closing tag
    if (match[0].indexOf('</') === 0) {
      const tagName = match[1].toLowerCase();
      // Find the matching opening tag
      let i = openTags.length - 1;
      for (; i >= 0; i--) {
        if (openTags[i].toLowerCase() === tagName) {
          break;
        }
      }
      // Remove all tags closed by this tag
      if (i >= 0) {
        openTags.splice(i);
      }
    } 
    // Opening tag
    else if (match[0].indexOf('<') === 0 && match[0].indexOf('/>') === -1) {
      openTags.push(match[1]);
    }
  }
  
  // Close any remaining open tags
  for (let i = openTags.length - 1; i >= 0; i--) {
    processedHtml += `</${openTags[i]}>`;
  }
  
  return processedHtml;
}
