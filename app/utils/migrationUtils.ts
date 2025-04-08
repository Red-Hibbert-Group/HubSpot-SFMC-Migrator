/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

// Utility functions for mapping between HubSpot and SFMC

// Map HubSpot contact fields to SFMC data extension fields
export const mapContactFields = (hubspotProperties: Record<string, any>[]) => {
  const fieldMap: Record<string, string> = {
    email: 'EmailAddress',
    firstname: 'FirstName',
    lastname: 'LastName',
    phone: 'Phone',
    company: 'Company',
    jobtitle: 'JobTitle',
    website: 'Website',
    address: 'Address',
    city: 'City',
    state: 'State',
    zip: 'PostalCode',
    country: 'Country',
  };

  // Create SFMC data extension fields
  const fields = hubspotProperties.map(prop => {
    const fieldType = getFieldType(prop.type);
    const name = fieldMap[prop.name.toLowerCase()] || prop.name;
    
    return {
      name,
      fieldType,
      isRequired: prop.required || false,
      isPrimaryKey: prop.name.toLowerCase() === 'email',
    };
  });

  // Always ensure we have an EmailAddress field
  if (!fields.some(f => f.name === 'EmailAddress')) {
    fields.push({
      name: 'EmailAddress',
      fieldType: 'EmailAddress',
      isRequired: true,
      isPrimaryKey: true,
    });
  }

  return fields;
};

// Map HubSpot contact data to SFMC data extension format
export const mapContactData = (
  hubspotContacts: Record<string, any>[],
  fieldMap: Record<string, string> = {}
) => {
  return hubspotContacts.map(contact => {
    const sfmcContact: Record<string, any> = {};
    
    Object.entries(contact.properties).forEach(([key, value]) => {
      const sfmcField = fieldMap[key.toLowerCase()] || key;
      sfmcContact[sfmcField] = value;
    });

    // Ensure we have an EmailAddress field
    if (contact.properties.email && !sfmcContact.EmailAddress) {
      sfmcContact.EmailAddress = contact.properties.email;
    }

    return sfmcContact;
  });
};

// Convert HubSpot template to SFMC template format
export const convertHubspotTemplate = (hubspotTemplate: Record<string, any>) => {
  let content = hubspotTemplate.source || hubspotTemplate.html || hubspotTemplate.content || '';
  
  // If template is from CMS API, it might have different structure
  if (!content && hubspotTemplate.template_type === 'EMAIL' && hubspotTemplate.widget_containers) {
    try {
      // CMS templates might have a different structure with containers
      content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${hubspotTemplate.label || hubspotTemplate.name || 'Email Template'}</title>
</head>
<body>
  ${hubspotTemplate.widget_containers ? 
    Object.entries(hubspotTemplate.widget_containers).map(([key, container]: [string, any]) => 
      `<div data-type="slot" data-key="${key}">${container.body || ''}</div>`
    ).join('\n  ') 
    : '<div data-type="slot" data-key="content"></div>'}
</body>
</html>`;
    } catch (error) {
      console.error('Error parsing CMS template structure:', error);
      content = `<p>Template: ${hubspotTemplate.name || 'Untitled'}</p>`;
    }
  }
  
  // Replace HubSpot personalization tokens with SFMC AMPscript
  content = content.replace(/\{\{contact\.([^}]+)\}\}/g, '%%=v(@$1)=%%');
  
  // Replace HubSpot conditional logic with AMPscript
  content = content.replace(
    /\{% if ([^}]+) %\}(.*?)\{% endif %\}/gs,
    '%%[ IF $1 ]%%$2%%[ ENDIF ]%%'
  );
  
  // Check if content contains data-type="slot" to identify if it's already compatible with SFMC slots
  const hasSlots = content.includes('data-type="slot"');
  
  // If no slots found, add default template structure with slots
  if (!hasSlots) {
    content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${hubspotTemplate.name || hubspotTemplate.label || 'Migrated Template'}</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .content { padding: 20px; }
  </style>
</head>
<body>
  <div data-type="slot" data-key="header"></div>
  <div class="content">
    <div data-type="slot" data-key="content">${content}</div>
  </div>
  <div data-type="slot" data-key="footer"></div>
</body>
</html>`;
  }
  
  // Extract slot definitions
  const slotMatches = content.matchAll(/data-type="slot"\s+data-key="([^"]+)"/g);
  const slots: Record<string, Record<string, never>> = {};
  
  for (const match of slotMatches) {
    const slotKey = match[1];
    slots[slotKey] = {};
  }
  
  // If no slots found, add default ones
  if (Object.keys(slots).length === 0) {
    slots.cell1 = {};
    slots.cell2 = {};
    slots.cell3 = {};
  }
  
  return {
    content,
    slots,
    channels: {
      email: true,
      web: false
    }
  };
};

// Convert HubSpot marketing email to SFMC email
export const convertHubspotEmail = (
  hubspotEmail: Record<string, any>, 
  emailDetails?: Record<string, any>
) => {
  // Basic properties
  const emailName = hubspotEmail.name || `Migrated Email ${hubspotEmail.id}`;
  let subject = hubspotEmail.subject || emailDetails?.subject || emailName;
  let emailContent = '';
  let fromName = hubspotEmail.fromName || emailDetails?.fromName || 'Marketing Team';
  let fromEmail = hubspotEmail.fromEmail || emailDetails?.fromEmail || '';
  
  // Try to extract HTML content from email details
  if (emailDetails) {
    console.log(`Looking for content in email details for ${emailName}`);
    
    // First, try to find and parse HubSpot flex areas/modules
    if (emailDetails.flexAreas) {
      console.log(`Found flexAreas in email details for ${emailName}`);
      try {
        // Parse flexAreas JSON if it's a string
        let flexAreasData = typeof emailDetails.flexAreas === 'string' 
          ? JSON.parse(emailDetails.flexAreas) 
          : emailDetails.flexAreas;
        
        // Build email content from flex areas
        emailContent = parseHubspotFlexAreas(flexAreasData, emailDetails.moduleContent);
        console.log(`Successfully parsed flexAreas into content (${emailContent.length} characters)`);
      } catch (error) {
        console.error(`Error parsing flexAreas for ${emailName}:`, error);
        // Continue with other content extraction methods on failure
      }
    }
    
    // If no content yet and we have rendered content (from preview or similar call), use that
    if (!emailContent && emailDetails.renderedContent) {
      console.log(`Using rendered content for ${emailName} (${emailDetails.renderedContent.length} characters)`);
      emailContent = emailDetails.renderedContent;
    }
    
    // If still no content and email has emailBody, use that
    if (!emailContent && emailDetails.emailBody) {
      console.log(`Using emailBody for ${emailName} (${emailDetails.emailBody.length} characters)`);
      
      // Handling for placeholder-based emailBody
      if (emailDetails.emailBody.includes('{% content_attribute') || 
          emailDetails.emailBody.includes('{{ default_email_body }}')) {
        
        console.log('Email body contains template placeholders');
        
        // See if we can use content from modules
        if (emailDetails.moduleContent && Object.keys(emailDetails.moduleContent).length > 0) {
          console.log(`Found module content, using to populate email (${Object.keys(emailDetails.moduleContent).length} modules)`);
          
          // Create a div for each module content
          const moduleContentHtml = Object.entries(emailDetails.moduleContent)
            .map(([moduleId, content]) => 
              `<div class="module" id="${moduleId}" data-module-id="${moduleId}">${content}</div>`
            )
            .join('\n');
          
          emailContent = moduleContentHtml;
        } else {
          // No way to resolve placeholders, fall back to simple container
          emailContent = `<div>Email uses HubSpot template placeholders: ${emailName}</div>`;
        }
      } else {
        // Direct use of emailBody if no placeholders
        emailContent = emailDetails.emailBody;
      }
    }
    
    // If still no content, but we have htmlBody, use that
    if (!emailContent && emailDetails.htmlBody) {
      console.log(`Using htmlBody for ${emailName} (${emailDetails.htmlBody.length} characters)`);
      emailContent = emailDetails.htmlBody;
    }
    
    // If we're still empty but have source, try to extract HTML
    if (!emailContent && emailDetails.source) {
      console.log(`Trying to extract HTML from source for ${emailName}`);
      
      const htmlMatch = emailDetails.source.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
      if (htmlMatch && htmlMatch[0]) {
        console.log(`Found HTML in source (${htmlMatch[0].length} characters)`);
        emailContent = htmlMatch[0];
      } else {
        // If no full HTML, look for body
        const bodyMatch = emailDetails.source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
          console.log(`Found body content in source (${bodyMatch[1].length} characters)`);
          emailContent = `<div>${bodyMatch[1]}</div>`;
        }
      }
    }
  }
  
  // If still no content, create a minimal placeholder
  if (!emailContent) {
    console.log(`No content found for ${emailName}, using fallback placeholder`);
    emailContent = `<div>Empty email content: ${emailName}</div>`;
  }
  
  // NOTE: The Email will be created using AMPscript ContentBlockById functions
  // to reference content blocks, instead of using the slot-based approach.
  // This ensures proper rendering in SFMC Email Studio.
  
  return {
    name: emailName,
    subject,
    content: emailContent,
    fromName,
    fromEmail,
    moduleContent: emailDetails?.moduleContent || {}
  };
};

// Map HubSpot form to SFMC CloudPage form
export const convertHubspotForm = (hubspotForm: Record<string, any>) => {
  const fields = hubspotForm.formFieldGroups
    .flatMap((group: any) => group.fields)
    .map((field: any) => {
      return {
        name: field.name,
        label: field.label,
        type: mapFormFieldType(field.fieldType),
        required: field.required,
      };
    });

  // Generate HTML form for CloudPage
  const formHTML = generateSFMCFormHTML(hubspotForm.name, fields);
  
  return formHTML;
};

// Map HubSpot workflow to SFMC Journey
export const convertHubspotWorkflow = (hubspotWorkflow: Record<string, any>) => {
  // Start with basic journey structure
  const journey: {
    version: number;
    triggers: any[];
    activities: any[];
    exits: any[];
    stats: {
      currentActivities: any[];
      totalExitCount: number;
    }
  } = {
    version: 1,
    triggers: [],
    activities: [],
    exits: [],
    stats: {
      currentActivities: [],
      totalExitCount: 0,
    },
  };

  // Map HubSpot triggers to SFMC triggers
  if (hubspotWorkflow.type === 'DRIP_DELAY') {
    // Time-based workflow
    journey.triggers.push({
      key: 'TRIGGER-1',
      name: 'Scheduled Entry',
      type: 'Schedule',
      schedule: {
        startDate: new Date().toISOString(),
        endDate: null,
        recurrence: 'daily',
      },
    });
  } else {
    // Event-based workflow
    journey.triggers.push({
      key: 'TRIGGER-1',
      name: 'Data Extension Entry',
      type: 'DataExtensionAudienceActivity',
      dataSource: {
        name: 'Migrated List',
      },
    });
  }

  // Map actions to activities
  let activityIndex = 1;
  
  hubspotWorkflow.actions.forEach((action: any) => {
    const key = `ACTIVITY-${activityIndex}`;
    activityIndex++;

    if (action.type === 'DELAY') {
      // Map delay to wait activity
      journey.activities.push({
        key,
        name: 'Wait',
        type: 'Wait',
        waitTime: convertDelayTime(action.delayMillis),
      });
    } else if (action.type === 'EMAIL') {
      // Map email send to email activity
      journey.activities.push({
        key,
        name: 'Send Email',
        type: 'EmailActivity',
        email: {
          name: action.emailName || 'Migrated Email',
        },
      });
    } else if (action.type === 'BRANCH') {
      // Map branch to decision split
      journey.activities.push({
        key,
        name: 'Decision Split',
        type: 'DecisionSplitActivity',
        outcomes: mapBranchConditions(action.filters),
      });
    }
  });

  // Add exit
  journey.exits.push({
    key: 'EXIT-1',
    name: 'Journey Exit',
    criteria: 'Source Data',
  });

  return journey;
};

// Helper Functions

// Map HubSpot property type to SFMC field type
const getFieldType = (hubspotType: string): string => {
  const typeMap: Record<string, string> = {
    string: 'Text',
    number: 'Number',
    date: 'Date',
    datetime: 'Date',
    boolean: 'Boolean',
    enumeration: 'Text',
    email: 'EmailAddress',
    phone: 'Phone',
  };

  return typeMap[hubspotType] || 'Text';
};

// Map HubSpot form field type to HTML input type
const mapFormFieldType = (hubspotFieldType: string): string => {
  const typeMap: Record<string, string> = {
    text: 'text',
    textarea: 'textarea',
    number: 'number',
    date: 'date',
    select: 'select',
    checkbox: 'checkbox',
    radio: 'radio',
    email: 'email',
    phone: 'tel',
  };

  return typeMap[hubspotFieldType] || 'text';
};

// Generate HTML form for SFMC CloudPage
const generateSFMCFormHTML = (formName: string, fields: any[]): string => {
  let html = `
    <form id="${formName.replace(/\s+/g, '_')}" method="post">
      <h2>${formName}</h2>
  `;

  fields.forEach(field => {
    if (field.type === 'textarea') {
      html += `
        <div class="form-group">
          <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
          <textarea id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}></textarea>
        </div>
      `;
    } else if (field.type === 'select' && field.options) {
      html += `
        <div class="form-group">
          <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
          <select id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
            <option value="">-- Select --</option>
            ${field.options.map((opt: any) => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
        </div>
      `;
    } else {
      html += `
        <div class="form-group">
          <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
          <input type="${field.type}" id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
        </div>
      `;
    }
  });

  html += `
      <div class="form-group">
        <button type="submit">Submit</button>
      </div>
    </form>
    
    <script runat="server">
      if (Request.Method == "POST") {
        // AMPscript to handle form submission
        var @email = RequestParameter("email")
        if (not empty(@email)) {
          // Set all the form field values
          ${fields.map(field => `var @${field.name} = RequestParameter("${field.name}")`).join('\n          ')}
          
          // Insert into Data Extension
          var @insertDE = InsertData(
            "Form_Submissions",
            ${fields.map(field => `"${field.name}", @${field.name}`).join(',\n            ')}
          )
          
          // Redirect to thank you page
          Redirect("thank-you")
        }
      }
    </script>
  `;

  return html;
};

// Convert HubSpot delay time to SFMC wait time
const convertDelayTime = (delayMillis: number) => {
  const days = Math.floor(delayMillis / (1000 * 60 * 60 * 24));
  const hours = Math.floor((delayMillis % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return {
      duration: days,
      unit: 'days',
    };
  } else {
    return {
      duration: hours > 0 ? hours : 1,
      unit: 'hours',
    };
  }
};

// Map HubSpot branch conditions to SFMC decision split outcomes
const mapBranchConditions = (filters: any[]) => {
  return filters.map((filter, index) => {
    return {
      key: `OUTCOME-${index + 1}`,
      name: filter.filterName || `Condition ${index + 1}`,
      description: '',
      criteria: mapFilterCriteria(filter),
    };
  });
};

// Map HubSpot filter criteria to SFMC expression
const mapFilterCriteria = (filter: any) => {
  // This is a simplification - actual implementation would be more complex
  return `Contact:${filter.propertyName} ${mapOperator(filter.operator)} '${filter.value}'`;
};

// Map HubSpot operator to SFMC operator
const mapOperator = (hubspotOperator: string) => {
  const operatorMap: Record<string, string> = {
    EQ: '==',
    NEQ: '!=',
    CONTAINS: 'Contains',
    DOES_NOT_CONTAIN: 'DoesNotContain',
    GT: '>',
    GTE: '>=',
    LT: '<',
    LTE: '<=',
  };

  return operatorMap[hubspotOperator] || '==';
};

// Helper function to parse HubSpot flex areas and convert to SFMC content
const parseHubspotFlexAreas = (flexAreas: any, moduleContent?: Record<string, string>): string => {
  if (!flexAreas || typeof flexAreas !== 'object') {
    console.warn('Invalid flexAreas data');
    return '';
  }

  try {
    // Extract the main content area which typically contains all content sections
    const mainArea = flexAreas.main || flexAreas.flexAreas?.main || Object.values(flexAreas)[0];
    if (!mainArea) {
      console.warn('No main content area found in flexAreas');
      
      // Last resort: try to render the flexAreas directly if it has sections
      if (flexAreas.sections && Array.isArray(flexAreas.sections)) {
        console.log('Found sections array directly in flexAreas, using that');
        // Create a synthetic main area
        return renderSections(flexAreas.sections, moduleContent);
      }
      
      // If we can't find a structure we recognize, return empty
      return '';
    }
    
    // Handle non-standard structures
    if (mainArea.boxed !== undefined || mainArea.isSingleColumnFullWidth !== undefined) {
      // This appears to be a standard structure with sections
      if (mainArea.sections && Array.isArray(mainArea.sections)) {
        return renderSections(mainArea.sections, moduleContent);
      }
    }
    
    // Check if mainArea itself is just an array of sections
    if (Array.isArray(mainArea)) {
      console.log('Main area is an array, treating as sections');
      return renderSections(mainArea, moduleContent);
    }
    
    // Handle case where section data is nested differently
    if (mainArea.content && mainArea.content.sections) {
      console.log('Found sections in mainArea.content.sections');
      return renderSections(mainArea.content.sections, moduleContent);
    }
    
    // Default case - assume standard structure with sections
    return renderSections(mainArea.sections || [], moduleContent);
  } catch (error) {
    console.error('Error parsing flex areas:', error);
    return '';
  }
};

// Helper to render sections into HTML
const renderSections = (sections: any[], moduleContent?: Record<string, string>): string => {
  if (!Array.isArray(sections)) {
    console.warn('Sections is not an array:', typeof sections);
    return '';
  }
  
  // Start with proper email HTML structure with embedded styles for email clients
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      /* Base styles for email compatibility */
      body { margin: 0; padding: 0; min-width: 100%; width: 100% !important; height: 100% !important; }
      body, table, td, div, p, a { -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 1.5; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; border-spacing: 0; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
      /* Basic layout */
      .section { margin-bottom: 20px; }
      .module { margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <!-- Begin email content -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
      <tr>
        <td align="center" valign="top" style="padding: 10px;">
          <!-- Email container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
            <tr>
              <td align="left" valign="top">
  `;
  
  // Process sections
  sections.forEach((section: any, sectionIndex: number) => {
    // Check if this is actually a valid section
    if (!section) {
      console.warn(`Section ${sectionIndex} is null or undefined`);
      return;
    }
    
    // If section has an id field like "section-0", extract the index
    let sectionId = `section-${sectionIndex}`;
    if (section.id && typeof section.id === 'string' && section.id.startsWith('section-')) {
      sectionId = section.id;
    }
    
    // Add section container with section styling
    const sectionStyle = extractBackgroundStyles(section.style || {});
    html += `<!-- Section ${sectionIndex} -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="section" id="${sectionId}" style="${sectionStyle}">
      <tr>
        <td align="left" valign="top">`;
    
    // Handle different section formats
    if (section.columns && Array.isArray(section.columns)) {
      // Standard format with columns array
      html += renderColumns(section.columns, sectionIndex, moduleContent);
    } else if (typeof section === 'object' && 
               Object.keys(section).some(key => key.startsWith('column-'))) {
      // Alternate format where columns are direct properties (column-0-0, column-1-0, etc.)
      const columnKeys = Object.keys(section).filter(key => key.startsWith('column-'));
      const columnObjects = columnKeys.map(key => ({
        ...section[key],
        id: key, // Preserve the column ID for reference
      }));
      html += renderColumns(columnObjects, sectionIndex, moduleContent);
    } else if (Array.isArray(section)) {
      // The section itself might be an array of widgets/content
      html += `<table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="left" valign="top" width="100%" class="column" id="column-${sectionIndex}-0">`;
      
      // Treat each array item as a widget
      section.forEach((widget: any, widgetIndex: number) => {
        html += `<div class="module" id="module-${sectionIndex}-0-${widgetIndex}">`;
        html += convertWidgetToHtml(widget, moduleContent);
        html += '</div>';
      });
      
      html += `</td>
        </tr>
      </table>`;
    } else if (section.content) {
      // Section might have a direct content property
      html += `<table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="left" valign="top" width="100%" class="column" id="column-${sectionIndex}-0">
            <div class="module" id="module-${sectionIndex}-0-0">`;
      
      if (typeof section.content === 'string') {
        html += section.content;
      } else {
        html += convertWidgetToHtml(section.content, moduleContent);
      }
      
      html += `</div>
          </td>
        </tr>
      </table>`;
    } else if (section.widgets && Array.isArray(section.widgets)) {
      // Section might have widgets directly without columns
      html += `<table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="left" valign="top" width="100%" class="column" id="column-${sectionIndex}-0">`;
      
      section.widgets.forEach((widget: any, widgetIndex: number) => {
        html += `<div class="module" id="module-${sectionIndex}-0-${widgetIndex}">`;
        html += convertWidgetToHtml(widget, moduleContent);
        html += '</div>';
      });
      
      html += `</td>
        </tr>
      </table>`;
    } else {
      // If no recognizable structure, just convert the whole section as a widget
      html += `<table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="left" valign="top" width="100%" class="column" id="column-${sectionIndex}-0">
            <div class="module" id="module-${sectionIndex}-0-0">`;
      html += convertWidgetToHtml(section, moduleContent);
      html += `</div>
          </td>
        </tr>
      </table>`;
    }
    
    html += `</td>
      </tr>
    </table>`;
  });
  
  // Close the email structure
  html += `
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <!-- End email content -->
  </body>
  </html>
  `;
  
  return html;
};

// Helper to render columns into HTML
const renderColumns = (columns: any[], sectionIndex: number, moduleContent?: Record<string, string>): string => {
  if (!Array.isArray(columns)) {
    console.warn('Columns is not an array:', typeof columns);
    return '';
  }
  
  // If we have multiple columns, use a table layout with proper email structure
  let html = '';
  
  // Determine layout type based on number of columns
  if (columns.length > 1) {
    // Start with a table for multi-column layout
    html = '<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>';
    
    // Calculate total width to distribute columns
    const totalWidth = columns.reduce((sum, col) => {
      const colWidth = typeof col?.width === 'number' ? col.width : 12;
      return sum + colWidth;
    }, 0);
    
    columns.forEach((column: any, columnIndex: number) => {
      // Check if this is a valid column
      if (!column) {
        console.warn(`Column ${columnIndex} in section ${sectionIndex} is null or undefined`);
        return;
      }
      
      // Extract column width - handle different format possibilities
      let columnWidth = 12; // Default to full width
      
      if (typeof column.width === 'number') {
        columnWidth = column.width;
      } else if (typeof column.width === 'string') {
        // Handle string width values like "4" or "33%"
        const numericWidth = parseInt(column.width, 10);
        if (!isNaN(numericWidth)) {
          // If it was a percentage, convert to 12-grid system
          if (column.width.includes('%')) {
            columnWidth = Math.round((numericWidth / 100) * 12);
          } else {
            columnWidth = numericWidth;
          }
        }
      }
      
      // Constrain column width to valid range
      columnWidth = Math.max(1, Math.min(12, columnWidth)); 
      const widthPercent = Math.floor((columnWidth / totalWidth) * 100);
      
      // Extract column styles
      const columnStyle = extractBackgroundStyles(column.style || {});
      
      // Get column ID - use existing ID if available
      let columnId = `column-${sectionIndex}-${columnIndex}`;
      if (column.id && typeof column.id === 'string') {
        columnId = column.id;
      }
      
      html += `<td align="left" valign="top" width="${widthPercent}%" style="${columnStyle}" class="column" id="${columnId}">`;
      
      // Render column content
      html += renderColumnContent(column, sectionIndex, columnIndex, moduleContent);
      
      html += '</td>'; // Close column
    });
    
    html += '</tr></table>'; // Close columns table
  } else if (columns.length === 1) {
    // For single column, simpler structure
    const column = columns[0];
    const columnStyle = extractBackgroundStyles(column?.style || {});
    let columnId = `column-${sectionIndex}-0`;
    if (column?.id && typeof column.id === 'string') {
      columnId = column.id;
    }
    
    html = `<table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="left" valign="top" style="${columnStyle}" class="column" id="${columnId}">`;
        
    // Render column content
    html += renderColumnContent(column, sectionIndex, 0, moduleContent);
    
    html += `</td>
      </tr>
    </table>`;
  }
  
  return html;
};

// Helper to render column content
const renderColumnContent = (column: any, sectionIndex: number, columnIndex: number, moduleContent?: Record<string, string>): string => {
  let html = '';
  
  // Process widgets (modules) in this column
  if (column?.widgets && Array.isArray(column.widgets)) {
    column.widgets.forEach((widget: any, widgetIndex: number) => {
      // Extract module ID for reference
      const moduleId = typeof widget === 'string' ? widget : (widget.module || widget.module_id || widget.moduleId || '');
      
      // Determine widget type for proper handling in SFMC
      const widgetType = determineWidgetType(widget);
      
      html += `<div class="module" id="module-${sectionIndex}-${columnIndex}-${widgetIndex}" data-module-id="${moduleId}" data-module-type="${widgetType}">`;
      
      // Handle different widget content (text, image, etc.)
      html += convertWidgetToHtml(widget, moduleContent);
      
      html += '</div>'; // Close module div
    });
  } else if (column?.content) {
    // Column might have a direct content property instead of widgets
    const contentType = typeof column.content === 'string' ? 'textblock' : determineWidgetType(column.content);
    
    html += `<div class="module" id="module-${sectionIndex}-${columnIndex}-0" data-module-type="${contentType}">`;
    
    if (typeof column.content === 'string') {
      html += column.content;
    } else {
      html += convertWidgetToHtml(column.content, moduleContent);
    }
    
    html += '</div>';
  } else if (Array.isArray(column)) {
    // The column itself might be an array of widgets
    column.forEach((widget: any, widgetIndex: number) => {
      const widgetType = determineWidgetType(widget);
      html += `<div class="module" id="module-${sectionIndex}-${columnIndex}-${widgetIndex}" data-module-type="${widgetType}">`;
      html += convertWidgetToHtml(widget, moduleContent);
      html += '</div>';
    });
  } else if (typeof column === 'object' && Object.keys(column).length === 1 && Object.keys(column)[0].startsWith('module_')) {
    // The column might be a single module object
    const moduleKey = Object.keys(column)[0];
    html += `<div class="module" id="module-${sectionIndex}-${columnIndex}-0" data-module-id="${moduleKey}" data-module-type="htmlblock">`;
    html += convertWidgetToHtml(column, moduleContent);
    html += '</div>';
  } else if (typeof column === 'string') {
    // The column might be just a string of content
    html += `<div class="module" id="module-${sectionIndex}-${columnIndex}-0" data-module-type="textblock">`;
    html += column;
    html += '</div>';
  }
  
  return html;
};

// Helper function to determine widget type for SFMC mapping
const determineWidgetType = (widget: any): string => {
  // If widget is just a string
  if (typeof widget === 'string') {
    // Check if it's HTML content
    if (widget.includes('<') && widget.includes('>')) {
      return 'htmlblock';
    } 
    // If it's just text
    return 'textblock';
  }
  
  // If widget is null or undefined
  if (!widget) {
    return 'htmlblock';
  }
  
  // Check for module_id indicating specific module types
  if (widget.module_id || widget.moduleId) {
    const moduleId = widget.module_id || widget.moduleId;
    
    if (moduleId.includes('image') || widget.src) {
      return 'imageblock';
    } else if (moduleId.includes('button') || (widget.text && (widget.url || widget.link))) {
      return 'buttonblock';
    } else if (moduleId.includes('text') || widget.body) {
      // Check if body content is simple text or HTML
      if (widget.body && typeof widget.body === 'string' && 
          (!widget.body.includes('<') || 
          (widget.body.match(/<[^>]+>/g) && widget.body.match(/<[^>]+>/g).length <= 2))) {
        return 'textblock';
      }
    }
  }
  
  // Check for common widget structures
  if (widget.alt && widget.src) {
    return 'imageblock';
  } else if (widget.text && (widget.url || widget.link)) {
    return 'buttonblock';
  } else if (widget.body) {
    // Determine if the body is simple text or needs HTML
    if (typeof widget.body === 'string' && !widget.body.includes('<')) {
      return 'textblock';
    }
  }
  
  // When in doubt, use HTML block as default
  return 'htmlblock';
};

// Helper to extract background styles
const extractBackgroundStyles = (style: any): string => {
  if (!style || typeof style !== 'object') return '';
  
  const styles = [];
  
  if (style.backgroundColor) {
    styles.push(`background-color: ${style.backgroundColor}`);
  }
  
  if (style.backgroundImage) {
    styles.push(`background-image: url('${style.backgroundImage}')`);
    
    if (style.backgroundImageType === 'STRETCH') {
      styles.push('background-size: cover');
      styles.push('background-position: center center');
      styles.push('background-repeat: no-repeat');
    }
  }
  
  if (style.paddingTop) styles.push(`padding-top: ${style.paddingTop}`);
  if (style.paddingBottom) styles.push(`padding-bottom: ${style.paddingBottom}`);
  if (style.paddingLeft) styles.push(`padding-left: ${style.paddingLeft}`);
  if (style.paddingRight) styles.push(`padding-right: ${style.paddingRight}`);
  
  return styles.join('; ');
};

// Convert HubSpot widget to HTML
const convertWidgetToHtml = (widget: any, moduleContent?: Record<string, string>): string => {
  // If widget is just a string ID, return actual content if available, otherwise placeholder
  if (typeof widget === 'string') {
    // Check if we have actual content for this module ID
    if (moduleContent && moduleContent[widget]) {
      return moduleContent[widget];
    }
    
    // Check if we have content for a similarly named module
    if (moduleContent) {
      // Try with 'module_' prefix (common in HubSpot)
      if (widget.startsWith('module-') && moduleContent[`module_${widget.slice(7)}`]) {
        return moduleContent[`module_${widget.slice(7)}`];
      }
      // Try with numeric section at the end
      const numericMatch = widget.match(/\d+-\d+-\d+$/);
      if (numericMatch && moduleContent[`module-${numericMatch[0]}`]) {
        return moduleContent[`module-${numericMatch[0]}`];
      }
    }
    
    return `<div>Module ID: ${widget}</div>`;
  }
  
  // If widget is null or undefined
  if (!widget) {
    return '<div>[Empty module]</div>';
  }
  
  try {
    // Check if we have content for this module ID
    const moduleId = widget.module_id || widget.moduleId || widget.id || '';
    if (moduleContent && moduleId && moduleContent[moduleId]) {
      return moduleContent[moduleId];
    }
    
    // HubSpot modules data structure handling based on official API
    
    // 1. Text Modules
    if (widget.type === 'text' || 
        (widget.module_id && widget.module_id.includes('text')) || 
        (widget.moduleId && widget.moduleId.includes('text'))) {
      // Handle widget.body which is most common for text modules
      if (widget.body) {
        return typeof widget.body === 'string' ? widget.body : JSON.stringify(widget.body);
      }
      
      // Handle widget.value which is sometimes used instead of body
      if (widget.value) {
        return typeof widget.value === 'string' ? widget.value : JSON.stringify(widget.value);
      }
      
      // Handle nested text content in widget.content
      if (widget.content) {
        if (typeof widget.content === 'string') {
          return widget.content;
        } else if (widget.content.value) {
          return typeof widget.content.value === 'string' ? widget.content.value : JSON.stringify(widget.content.value);
        } else if (widget.content.html) {
          return widget.content.html;
        }
      }
    }
    
    // 2. Image Modules
    if (widget.type === 'image' || 
        (widget.module_id && widget.module_id.includes('image')) || 
        (widget.moduleId && widget.moduleId.includes('image')) ||
        (widget.src && (widget.alt || widget.alt === ''))) {
      
      const src = widget.src || (widget.content && widget.content.src) || '';
      const alt = widget.alt || (widget.content && widget.content.alt) || '';
      const width = widget.width || (widget.content && widget.content.width) || '';
      const height = widget.height || (widget.content && widget.content.height) || '';
      
      let styles = 'max-width: 100%';
      if (width) styles += `; width: ${width}px`;
      if (height) styles += `; height: ${height}px`;
      
      return `<img src="${src}" alt="${alt}" style="${styles}" />`;
    }
    
    // 3. Button Modules
    if (widget.type === 'button' || 
        (widget.module_id && widget.module_id.includes('button')) || 
        (widget.moduleId && widget.moduleId.includes('button')) ||
        (widget.text && (widget.url || widget.link || widget.href))) {
      
      const text = widget.text || (widget.content && widget.content.text) || 'Click here';
      const url = widget.url || widget.link || widget.href || 
                (widget.content && (widget.content.url || widget.content.link || widget.content.href)) || '#';
      const backgroundColor = widget.backgroundColor || widget.buttonBackgroundColor || 
                             (widget.styles && widget.styles.backgroundColor) || 
                             (widget.content && widget.content.backgroundColor) || '#0078D4';
      const textColor = widget.textColor || widget.buttonTextColor || 
                       (widget.styles && widget.styles.color) || 
                       (widget.content && widget.content.textColor) || 'white';
      
      return `<div class="button-container" style="margin: 10px 0; text-align: center;">
        <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: ${backgroundColor}; color: ${textColor}; text-decoration: none; border-radius: 4px; font-family: Arial, sans-serif;">${text}</a>
      </div>`;
    }
    
    // 4. Divider Modules
    if (widget.type === 'divider' || 
        (widget.module_id && widget.module_id.includes('divider')) || 
        (widget.moduleId && widget.moduleId.includes('divider'))) {
      
      const borderColor = widget.borderColor || widget.color || 
                         (widget.styles && widget.styles.borderColor) || 
                         (widget.content && widget.content.borderColor) || '#CCC';
      const borderWidth = widget.borderWidth || widget.width || 
                         (widget.styles && widget.styles.borderWidth) || 
                         (widget.content && widget.content.borderWidth) || '1px';
      
      return `<div style="padding: 10px 0;"><hr style="border: 0; border-top: ${borderWidth} solid ${borderColor};" /></div>`;
    }
    
    // 5. Social Module (Social Follow/Share)
    if (widget.type === 'social' || 
        (widget.module_id && (widget.module_id.includes('social') || widget.module_id.includes('follow'))) || 
        (widget.moduleId && (widget.moduleId.includes('social') || widget.moduleId.includes('follow')))) {
      
      let socialHtml = '<div style="text-align: center; padding: 10px 0;">';
      
      // Networks from main object
      const socialNetworks = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'pinterest'];
      
      // First check direct properties
      socialNetworks.forEach(network => {
        if (widget[network] || widget[`${network}_url`] || widget[`${network}Url`]) {
          const url = widget[network] || widget[`${network}_url`] || widget[`${network}Url`];
          socialHtml += `<a href="${url}" style="margin: 0 5px; display: inline-block; text-decoration: none;" target="_blank">${network.charAt(0).toUpperCase() + network.slice(1)}</a>`;
        }
      });
      
      // Then check nested content object
      if (widget.content && typeof widget.content === 'object') {
        socialNetworks.forEach(network => {
          if (widget.content[network] || widget.content[`${network}_url`] || widget.content[`${network}Url`]) {
            const url = widget.content[network] || widget.content[`${network}_url`] || widget.content[`${network}Url`];
            socialHtml += `<a href="${url}" style="margin: 0 5px; display: inline-block; text-decoration: none;" target="_blank">${network.charAt(0).toUpperCase() + network.slice(1)}</a>`;
          }
        });
      }
      
      // Check for accounts array (another format)
      if (widget.accounts && Array.isArray(widget.accounts)) {
        widget.accounts.forEach((account: any) => {
          if (account.url && account.network) {
            socialHtml += `<a href="${account.url}" style="margin: 0 5px; display: inline-block; text-decoration: none;" target="_blank">${account.network.charAt(0).toUpperCase() + account.network.slice(1)}</a>`;
          }
        });
      }
      
      socialHtml += '</div>';
      return socialHtml;
    }
    
    // 6. HTML Module
    if (widget.type === 'html' || 
        (widget.module_id && widget.module_id.includes('html')) || 
        (widget.moduleId && widget.moduleId.includes('html')) ||
        widget.html) {
      
      if (widget.html) {
        return widget.html;
      }
      
      if (widget.content && widget.content.html) {
        return widget.content.html;
      }
    }
    
    // 7. Rich Text Module (WYSIWYG)
    if (widget.type === 'rich_text' || 
        (widget.module_id && widget.module_id.includes('rich_text')) || 
        (widget.moduleId && widget.moduleId.includes('rich_text'))) {
      
      if (widget.body) {
        return typeof widget.body === 'string' ? widget.body : JSON.stringify(widget.body);
      }
      
      if (widget.content && widget.content.body) {
        return typeof widget.content.body === 'string' ? widget.content.body : JSON.stringify(widget.content.body);
      }
    }
    
    // 8. Video Module
    if (widget.type === 'video' || 
        (widget.module_id && widget.module_id.includes('video')) || 
        (widget.moduleId && widget.moduleId.includes('video'))) {
      
      const videoUrl = widget.videoUrl || widget.video_url || widget.url || 
                       (widget.content && (widget.content.videoUrl || widget.content.video_url || widget.content.url));
      
      if (videoUrl) {
        // Handle YouTube videos
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
          const videoId = extractYoutubeVideoId(videoUrl);
          if (videoId) {
            return `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
              <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" allowfullscreen></iframe>
            </div>`;
          }
        }
        
        // Handle Vimeo videos
        if (videoUrl.includes('vimeo.com')) {
          const videoId = videoUrl.split('/').pop();
          if (videoId) {
            return `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
              <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                src="https://player.vimeo.com/video/${videoId}" 
                frameborder="0" allowfullscreen></iframe>
            </div>`;
          }
        }
        
        // Generic video embed
        return `<div style="text-align: center;">
          <a href="${videoUrl}" target="_blank">Watch Video</a>
        </div>`;
      }
    }
    
    // Fall back to checking by property patterns
    
    // For text modules (common pattern)
    if (widget.body) {
      return typeof widget.body === 'string' ? widget.body : JSON.stringify(widget.body);
    }
    
    // For image modules
    if (widget.alt !== undefined && widget.src) {
      const width = widget.width ? `width="${widget.width}"` : 'style="max-width: 100%"';
      return `<img src="${widget.src}" alt="${widget.alt}" ${width} />`;
    }
    
    // For button modules
    if (widget.text && (widget.url || widget.link || widget.href)) {
      const url = widget.url || widget.link || widget.href;
      return `<a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #0078D4; color: white; text-decoration: none; border-radius: 4px;">${widget.text}</a>`;
    }
    
    // Check nested structures (layoutSections format)
    if (typeof widget === 'object' && Object.keys(widget).length === 1) {
      const key = Object.keys(widget)[0];
      if (key.startsWith('module_')) {
        const moduleContent = widget[key];
        if (typeof moduleContent === 'string') {
          return moduleContent;
        } else if (moduleContent && typeof moduleContent === 'object') {
          if (moduleContent.html) return moduleContent.html;
          if (moduleContent.body) return typeof moduleContent.body === 'string' ? moduleContent.body : JSON.stringify(moduleContent.body);
        }
      }
    }
    
    // Check content object
    if (widget.content && typeof widget.content === 'object') {
      // Try to extract text content
      if (widget.content.html) {
        return widget.content.html;
      }
      if (widget.content.body) {
        return typeof widget.content.body === 'string' ? widget.content.body : JSON.stringify(widget.content.body);
      }
      
      // If content has a specific structure like HubSpot's content blocks
      if (Array.isArray(widget.content)) {
        return widget.content.map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.html) return item.html;
          if (item.body) return typeof item.body === 'string' ? item.body : JSON.stringify(item.body);
          return '';
        }).join('');
      }
    }
    
    // If we have a data object with properties that might be content
    if (widget.data && typeof widget.data === 'object') {
      if (widget.data.html) return widget.data.html;
      if (widget.data.body) return typeof widget.data.body === 'string' ? widget.data.body : JSON.stringify(widget.data.body);
      if (widget.data.text) return `<p>${widget.data.text}</p>`;
    }
    
    // If none of the above patterns match, try to extract any HTML-like content
    const widgetStr = JSON.stringify(widget);
    const htmlRegex = /<([a-z]+)(?:[^<]+)*(?:>(.*?)<\/\1>|\s+\/>)/i;
    const htmlMatch = widgetStr.match(htmlRegex);
    
    if (htmlMatch) {
      try {
        // Extract HTML-like content from the JSON string
        const htmlContent = widgetStr.replace(/\\"/g, '"').replace(/\\n/g, '\n');
        // Return content between first < and last >
        const firstLt = htmlContent.indexOf('<');
        const lastGt = htmlContent.lastIndexOf('>');
        if (firstLt !== -1 && lastGt !== -1 && lastGt > firstLt) {
          return htmlContent.substring(firstLt, lastGt + 1);
        }
      } catch (e) {
        console.error('Error extracting HTML from widget JSON:', e);
      }
    }
    
    // For any other type, convert to a simple representation
    return `<div>[Module: ${typeof widget === 'object' ? 
      (widget.module_id || widget.moduleId || widget.name || widget.type || 'Unknown') : 
      'Unknown'}]</div>`;
  } catch (error) {
    console.error('Error converting widget to HTML:', error);
    return '<div>[Module conversion error]</div>';
  }
};

// Helper to extract YouTube video ID from various URL formats
const extractYoutubeVideoId = (url: string): string | null => {
  // Check for standard YouTube URL format: https://www.youtube.com/watch?v=VIDEO_ID
  let match = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (match) return match[1];
  
  // Check for short YouTube URL format: https://youtu.be/VIDEO_ID
  match = url.match(/youtu\.be\/([^?&]+)/);
  if (match) return match[1];
  
  // Check for embed URL format: https://www.youtube.com/embed/VIDEO_ID
  match = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (match) return match[1];
  
  return null;
}; 