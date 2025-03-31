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
  let content = hubspotTemplate.source;
  
  // Replace HubSpot personalization tokens with SFMC AMPscript
  content = content.replace(/\{\{contact\.([^}]+)\}\}/g, '%%=v(@$1)=%%');
  
  // Replace HubSpot conditional logic with AMPscript
  content = content.replace(
    /\{% if ([^}]+) %\}(.*?)\{% endif %\}/gs,
    '%%[ IF $1 ]%%$2%%[ ENDIF ]%%'
  );
  
  return content;
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