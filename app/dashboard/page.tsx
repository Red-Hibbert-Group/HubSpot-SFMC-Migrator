/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';

// Define integration status types
type IntegrationStatus = 'loading' | 'connected' | 'disconnected' | 'error';
type MigrationStatus = 'idle' | 'loading' | 'success' | 'error';
type MigrationResult = Record<string, any>;

// Dashboard loader component
function DashboardLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Dashboard content component that uses useSearchParams
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const hubspotToken = searchParams.get('hubspotToken');
  
  // State for SFMC credentials to be passed directly
  const [sfmcCredentials, setSfmcCredentials] = useState({
    clientId: '',
    clientSecret: '',
    subdomain: ''
  });
  
  // State for connection status
  const [hubspotStatus, setHubspotStatus] = useState<IntegrationStatus>('loading');
  const [sfmcStatus, setSfmcStatus] = useState<IntegrationStatus>('loading');
  
  // State for SFMC modal
  const [showSfmcModal, setShowSfmcModal] = useState(false);

  // State for migration modules
  const [migrationStatus, setMigrationStatus] = useState<Record<string, MigrationStatus>>({
    contacts: 'idle',
    templates: 'idle',
    emails: 'idle'
  });

  // State for migration results
  const [migrationResults, setMigrationResults] = useState<Record<string, MigrationResult>>({});

  // Define state for custom template data
  const [customTemplate, setCustomTemplate] = useState({
    name: '',
    content: '',
    folderId: ''
  });
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // State for folder ID modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderIdInput, setFolderIdInput] = useState('');
  const [migrationModule, setMigrationModule] = useState('');

  // State for SFMC folders
  const [folders, setFolders] = useState<any[]>([]);
  const [emailFolders, setEmailFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);

  // Add a ref for the folder dropdown
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Add a state for folder explorer around line 67-70 where other states are defined
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [folderExplorerResults, setFolderExplorerResults] = useState<any>(null);
  const [loadingFolderExplorer, setLoadingFolderExplorer] = useState(false);

  // Check if we have userId
  useEffect(() => {
    if (!userId) {
      router.push('/');
    } else {
      // If we have a hubspotToken from query parameter, we're in temporary mode
      if (hubspotToken) {
        setHubspotStatus('connected');
        console.log('Using temporary HubSpot token from URL parameter');
      } else {
        // Simulate connection status or check with backend
        setHubspotStatus('connected');
      }
      
      setTimeout(() => {
        setSfmcStatus('disconnected');
      }, 500);
    }
  }, [userId, hubspotToken, router]);

  // Add click outside handler for the folder dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
    }
    
    // Add event listener when dropdown is open
    if (showFolderDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFolderDropdown]);

  // Handle SFMC form input changes
  const handleSfmcInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSfmcCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Connect to SFMC
  const connectToSFMC = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      alert('Please connect to HubSpot first');
      return;
    }
    
    setSfmcStatus('loading');
    
    try {
      const { clientId, clientSecret, subdomain } = sfmcCredentials;
      
      // Store credentials in state for direct use in migration
      setSfmcCredentials({
        clientId,
        clientSecret,
        subdomain
      });
      
      // Update UI to show as connected
      setSfmcStatus('connected');
      
      // Close modal
      setShowSfmcModal(false);
    } catch (error) {
      console.error('Error connecting to SFMC:', error);
      setSfmcStatus('error');
    }
  };

  // Handle template input change
  const handleTemplateInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCustomTemplate(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Upload custom template
  const uploadCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customTemplate.name || !customTemplate.content) {
      alert('Template name and content are required');
      return;
    }
    
    try {
      setMigrationStatus(prev => ({
        ...prev,
        templates: 'loading'
      }));
      
      // Prepare API request data
      const requestData: any = {
        userId,
        hubspotToken,
        sfmcCredentials,
        customTemplates: [
          {
            id: `custom-${Date.now()}`,
            name: customTemplate.name,
            content: customTemplate.content
          }
        ]
      };
      
      // Add folderId if provided
      if (customTemplate.folderId && customTemplate.folderId.trim()) {
        requestData.folderId = parseInt(customTemplate.folderId.trim(), 10);
      }
      
      // Call migration API with customTemplates array
      const response = await axios.post(`/api/migrate/templates`, requestData);
      
      // Update migration status and results
      setMigrationStatus(prev => ({
        ...prev,
        templates: 'success'
      }));
      
      setMigrationResults(prev => ({
        ...prev,
        templates: response.data
      }));
      
      // Reset form and close modal
      setCustomTemplate({ name: '', content: '', folderId: '' });
      setShowTemplateModal(false);
      
    } catch (error) {
      console.error('Error uploading custom template:', error);
      
      setMigrationStatus(prev => ({
        ...prev,
        templates: 'error'
      }));
      
      setMigrationResults(prev => ({
        ...prev,
        templates: { error: 'Template upload failed' }
      }));
    }
  };

  // Modify getSFMCFolders to also fetch Email Studio folders
  const getSFMCFolders = async () => {
    if (!sfmcCredentials.clientId || !sfmcCredentials.clientSecret || !sfmcCredentials.subdomain) {
      alert('SFMC credentials are required');
      return;
    }
    
    setLoading(true);
    setShowFolderDropdown(false);
    
    try {
      // Get Content Builder folders
      const response = await axios.post('/api/sfmc/folders', {
        sfmcCredentials
      });
      
      if (response.data && response.data.items) {
        setFolders(response.data.items);
      }

      // Get Email Studio folders if we're in email migration mode
      if (migrationModule === 'emails') {
        try {
          const emailFoldersResponse = await axios.post('/api/sfmc/email-folders', {
            sfmcCredentials
          });
          
          if (emailFoldersResponse.data) {
            setEmailFolders(emailFoldersResponse.data);
          }
        } catch (emailFolderError) {
          console.error('Error fetching Email Studio folders:', emailFolderError);
          // Don't alert, just log the error
        }
      }
    } catch (error) {
      console.error('Error fetching SFMC folders:', error);
      alert('Failed to fetch SFMC folders');
    } finally {
      setLoading(false);
    }
  };

  // Filter folders based on search term for both folder types
  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(folderSearchTerm.toLowerCase()) || 
    folder.id.toString().includes(folderSearchTerm));
  
  const filteredEmailFolders = emailFolders.filter(folder => 
    folder.name.toLowerCase().includes(folderSearchTerm.toLowerCase()) || 
    folder.id.toString().includes(folderSearchTerm));

  // Start migration for a specific module
  const startMigration = async (module: string) => {
    if (!userId) {
      alert('No user ID found. Please reconnect to HubSpot.');
      return;
    }
    
    console.log(`Starting migration for module: ${module}, current status: ${migrationStatus[module]}`);
    setShowFolderDropdown(false);
    
    // For templates or emails module, prompt for folder ID if it's a new migration and no folder ID entered
    if ((module === 'templates' || module === 'emails') && migrationStatus[module] === 'idle' && !folderIdInput) {
      console.log(`Opening folder selection modal for ${module} migration`);
      setMigrationModule(module);
      setShowFolderModal(true);
      return;
    }
    
    try {
      console.log(`Setting migration status to loading for ${module}`);
      setMigrationStatus(prev => ({
        ...prev,
        [module]: 'loading'
      }));

      // Build request data
      const requestData: any = {
        userId,
        hubspotToken,
        sfmcCredentials,
        limit: 100
      };
      
      // Add folder ID for templates or emails
      if (module === 'templates' || module === 'emails') {
        if (folderIdInput && folderIdInput.trim()) {
          try {
            const folderId = parseInt(folderIdInput.trim(), 10);
            if (isNaN(folderId)) {
              throw new Error(`Invalid folder ID: ${folderIdInput}`);
            }
            requestData.folderId = folderId;
            console.log(`Using folder ID: ${folderId} for ${module} migration`);
          } catch (error) {
            console.error(`Error parsing folder ID: ${folderIdInput}`, error);
            alert(`Invalid folder ID: ${folderIdInput}. Please enter a valid number.`);
            setMigrationStatus(prev => ({
              ...prev,
              [module]: 'idle'
            }));
            return;
          }
        } else {
          console.log(`No folder ID provided for ${module}, will auto-create a folder`);
        }
      }

      console.log(`Making API request to /api/migrate/${module} with data:`, JSON.stringify(requestData, null, 2));
      
      // Call migration API
      const response = await axios.post(`/api/migrate/${module}`, requestData);
      console.log(`Migration API response for ${module}:`, response.data);

      // Update migration status and results
      setMigrationStatus(prev => ({
        ...prev,
        [module]: 'success'
      }));
      
      setMigrationResults(prev => ({
        ...prev,
        [module]: response.data
      }));
      
      // Reset folder input after successful migration
      if (module === 'templates') {
        setFolderIdInput('');
      }
    } catch (error: any) {
      console.error(`Error migrating ${module}:`, error);
      
      // Get detailed error information
      let errorDetails = 'Unknown error';
      if (error.response) {
        console.error('Error response:', error.response.data);
        errorDetails = error.response.data.error || error.response.data.details || JSON.stringify(error.response.data);
      } else if (error.message) {
        errorDetails = error.message;
      }
      
      setMigrationStatus(prev => ({
        ...prev,
        [module]: 'error'
      }));
      
      setMigrationResults(prev => ({
        ...prev,
        [module]: { 
          error: 'Migration failed', 
          details: errorDetails
        }
      }));
      
      // Show alert with error details
      alert(`Migration failed: ${errorDetails}`);
    }
  };

  // Handle folder ID submission
  const handleFolderIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure we have a valid module to migrate
    if (!migrationModule) {
      console.error('No migration module specified');
      return;
    }
    
    // Close the modal first
    setShowFolderModal(false);
    
    // Give time for the modal to close before starting migration
    setTimeout(() => {
      console.log(`Starting migration for ${migrationModule} with folder ID: ${folderIdInput || 'auto-create'}`);
      startMigration(migrationModule);
    }, 100);
  };

  // Render connection status badge with Red Hibbert branding
  const renderStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case 'connected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Connected</span>;
      case 'disconnected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Disconnected</span>;
      case 'error':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>;
      case 'loading':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Connecting...</span>;
      default:
        return null;
    }
  };

  // Render migration button with Red Hibbert branding
  const renderMigrationButton = (module: string) => {
    const status = migrationStatus[module];
    
    switch (status) {
      case 'idle':
        return (
          <button 
            onClick={() => startMigration(module)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Migrate {module.charAt(0).toUpperCase() + module.slice(1)}
          </button>
        );
      case 'loading':
        return (
          <button 
            disabled
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-300 cursor-not-allowed"
          >
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Migrating...
          </button>
        );
      case 'success':
        return (
          <button 
            onClick={() => startMigration(module)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Migrate Again
          </button>
        );
      case 'error':
        return (
          <button 
            onClick={() => startMigration(module)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Retry
          </button>
        );
      default:
        return null;
    }
  };

  // Render migration results
  const renderMigrationResults = (module: string) => {
    const result = migrationResults[module];
    const status = migrationStatus[module];
    
    if (!result || status === 'idle' || status === 'loading') {
      return null;
    }
    
    if (status === 'error') {
      return (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
          <p className="font-semibold">Error:</p>
          <p>{result.error || 'Unknown error occurred'}</p>
          {result.details && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">Details:</p>
              <div className="overflow-auto max-h-20 bg-red-100 p-2 rounded">
                <pre className="whitespace-pre-wrap">{typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
        <p className="font-semibold">Success:</p>
        <p>{result.message || `Migrated ${result.migrated} items`}</p>
        
        {module === 'emails' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">
              Emails were migrated as structured Content Builder template emails with slots and blocks.
            </p>
            <p className="text-sm text-green-600 mt-1">
              These emails have a proper template structure with header, content, and footer blocks, making them easy to edit in Content Builder while maintaining all HubSpot content and styling.
            </p>
          </div>
        )}
        
        {result.migrated && result.migrated.length > 0 && (
          <div className="mt-2 text-sm">
            <p className="font-semibold">Migrated {result.migrated.length} items:</p>
            <ul className="list-disc list-inside pl-2 mt-1">
              {result.migrated.map((item: any, index: number) => (
                <li key={index} className="text-xs">
                  {item.hubspotName || item.customName || `Item ${index + 1}`}
                  {module === 'emails' && item.templateId && (
                    <span className="ml-1 text-blue-600">(Template ID: {item.templateId})</span>
                  )}
                </li>
              )).slice(0, 5)}
              {result.migrated.length > 5 && <li className="text-xs">...and {result.migrated.length - 5} more</li>}
            </ul>
          </div>
        )}
        {result.errors && result.errors.length > 0 && (
          <div className="mt-2 text-sm text-red-600">
            <p className="font-semibold">Errors ({result.errors.length}):</p>
            <ul className="list-disc list-inside pl-2 mt-1">
              {result.errors.map((error: any, index: number) => (
                <li key={index} className="text-xs">
                  {error.hubspotName || error.customName || `Item ${index + 1}`}: {error.error}
                </li>
              )).slice(0, 3)}
              {result.errors.length > 3 && <li className="text-xs">...and {result.errors.length - 3} more errors</li>}
            </ul>
          </div>
        )}
        <p className="mt-2 text-xs">
          View full details in the logs below
        </p>

        {migrationResults.emails && migrationResults.emails.migrated && (
          <div className="mt-4">
            <h3 className="text-md font-semibold mb-2">Migrated Emails ({migrationResults.emails.migrated.length}):</h3>
            <ul className="pl-5 list-disc mb-4">
              {migrationResults.emails.migrated.map((email: any) => (
                <li key={email.id} className="mb-1 text-sm">
                  <span className="font-medium">{email.name}</span>
                  <span className="text-gray-600 text-xs ml-2">
                    (SFMC ID: {email.sfmcId}{email.templateId ? `, Template ID: ${email.templateId}` : ''})
                  </span>
                </li>
              ))}
            </ul>
            
            {/* Add the Find My Emails button */}
            <button
              onClick={fetchFolderExplorer}
              className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm hover:bg-blue-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find My Emails in SFMC
            </button>
          </div>
        )}
      </div>
    );
  };

  // Fetch folder explorer data
  const fetchFolderExplorer = async () => {
    if (!sfmcCredentials.clientId || !sfmcCredentials.clientSecret || !sfmcCredentials.subdomain) {
      alert('SFMC credentials are required');
      return;
    }
    
    setLoadingFolderExplorer(true);
    setShowFolderExplorer(true);
    
    try {
      const response = await axios.post('/api/sfmc/test-content-block', {
        sfmcCredentials
      });
      
      setFolderExplorerResults(response.data);
    } catch (error) {
      console.error('Error fetching folder explorer:', error);
      alert('Failed to fetch folder explorer data');
    } finally {
      setLoadingFolderExplorer(false);
    }
  };

  // If no userId, show a message
  if (!userId) {
    return (
      <main className="min-h-screen p-6 lg:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">User ID Required</h1>
            <p className="mb-4">Please connect with HubSpot first to get started.</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Red Hibbert branding */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-48 h-10 relative mr-4">
              <Image 
                src="/images/red-hibbert-logo.png" 
                alt="Red Hibbert Group Logo" 
                fill
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              HubSpot to SFMC <span className="text-red-700">Migration Tool</span>
            </h1>
          </div>
          <Link href="/" className="text-red-700 hover:text-red-800 font-medium">
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main content section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection status section */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6 bg-red-700 text-white">
            <h2 className="text-lg font-medium">Connection Status</h2>
            <p className="mt-1 max-w-2xl text-sm text-red-100">
              Connect to HubSpot and Salesforce Marketing Cloud to begin migration
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            {/* ... continue with rest of your code for connection status ... */}
          </div>
        </div>
      </main>
    </div>
  );
}

// Main Dashboard component with Suspense
export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoader />}>
      <DashboardContent />
    </Suspense>
  );
} 