/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

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
    emails: 'idle',
    forms: 'idle',
    workflows: 'idle',
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

  // Render connection status badge
  const renderStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case 'connected':
        return <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">Connected</span>;
      case 'disconnected':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">Disconnected</span>;
      case 'loading':
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">Checking...</span>;
    }
  };

  // Render migration button
  const renderMigrationButton = (module: string) => {
    const status = migrationStatus[module];
    const bothConnected = hubspotStatus === 'connected' && sfmcStatus === 'connected';
    
    switch (status) {
      case 'idle':
        return (
          <button
            onClick={() => startMigration(module)}
            disabled={!bothConnected}
            className={`px-4 py-2 rounded-md text-white ${
              bothConnected ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Start Migration
          </button>
        );
      case 'loading':
        return (
          <button
            disabled
            className="px-4 py-2 rounded-md bg-blue-300 text-white cursor-not-allowed"
          >
            Migrating...
          </button>
        );
      case 'success':
        return (
          <button
            onClick={() => startMigration(module)}
            className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white"
          >
            Migrate Again
          </button>
        );
      case 'error':
        return (
          <button
            onClick={() => startMigration(module)}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white"
          >
            Retry
          </button>
        );
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
    <main className="min-h-screen p-6 lg:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Migration Dashboard</h1>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-500"
          >
            Back to Home
          </Link>
        </div>
        
        {/* User ID Display */}
        <div className="bg-blue-50 p-4 rounded-md mb-6 flex items-center justify-between">
          <div>
            <p className="text-blue-700">User ID: <span className="font-mono">{userId}</span></p>
            <p className="text-sm text-blue-600">This ID is used to track your migration progress</p>
          </div>
        </div>
        
        {/* Connection Status Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Connection Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* HubSpot Connection */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">HubSpot</h3>
                {renderStatusBadge(hubspotStatus)}
              </div>
              
              {hubspotStatus === 'disconnected' && (
                <a
                  href={`/api/auth/hubspot`}
                  className="inline-block mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-md"
                >
                  Connect HubSpot
                </a>
              )}
            </div>
            
            {/* SFMC Connection */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Salesforce Marketing Cloud</h3>
                {renderStatusBadge(sfmcStatus)}
              </div>
              
              {sfmcStatus !== 'connected' && (
                <button
                  onClick={() => setShowSfmcModal(true)}
                  className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
                >
                  Connect SFMC
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Migration Modules Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Migration Modules</h2>
          
          <div className="space-y-6">
            {/* Contacts & Lists Migration */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Contacts & Lists</h3>
                {renderMigrationButton('contacts')}
              </div>
              <p className="text-gray-600 mb-2">
                Migrate your HubSpot contacts and lists to SFMC Data Extensions.
              </p>
              {renderMigrationResults('contacts')}
            </div>
            
            {/* Email Templates Migration */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Email Templates</h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    disabled={!(hubspotStatus === 'connected' && sfmcStatus === 'connected')}
                    className={`px-4 py-2 rounded-md text-white ${
                      (hubspotStatus === 'connected' && sfmcStatus === 'connected') 
                        ? 'bg-green-600 hover:bg-green-500' 
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Upload Custom Template
                  </button>
                  {renderMigrationButton('templates')}
                </div>
              </div>
              <p className="text-gray-600 mb-2">
                Convert HubSpot email templates to SFMC Content Builder templates or upload your own custom templates.
              </p>
              {renderMigrationResults('templates')}
            </div>

            {/* Marketing Emails Migration */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-2">Email Migration</h2>
              <p className="text-gray-600 mb-4">
                Migrate your HubSpot email campaigns to SFMC as structured Content Builder emails with proper slots and blocks, following Salesforce best practices.
              </p>
              
              <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-md">
                <h3 className="font-semibold text-blue-700">Select Folder for {migrationModule}</h3>
                <p className="text-sm text-blue-600 mt-1">
                  {migrationModule === 'emails' ? (
                    <>
                      <strong>Important:</strong> For proper template-based emails, we recommend using an Email Studio folder.
                    </>
                  ) : (
                    <>
                      Choose a folder from Content Builder where your migrated content will be created.
                    </>
                  )}
                </p>
                {migrationModule === 'emails' && (
                  <div className="mt-2 text-sm text-blue-600 bg-blue-100 p-2 rounded">
                    <strong>Important:</strong> This tool creates template-based emails using the official Salesforce Marketing Cloud API methods:
                    <ul className="list-disc ml-5 mt-1">
                      <li>Primary: SOAP API with proper template structure</li>
                      <li>Fallback: REST API with complete email attributes</li>
                    </ul>
                    <p className="mt-1">All emails will include subject lines, preheaders and sender information as recommended by Salesforce.</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={getSFMCFolders}
                    disabled={loading}
                    className={`text-xs px-2 py-1 rounded ${
                      loading ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {loading ? 'Loading...' : 'Load Folders'}
                  </button>
                  
                  {/* Custom dropdown with search */}
                  <div className="relative inline-block text-left" ref={folderDropdownRef}>
                    <div>
                      <button 
                        type="button" 
                        onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                        className={`text-sm border rounded px-2 py-1 bg-white inline-flex justify-between items-center w-64 ${
                          folderIdInput && folders.some(f => f.id.toString() === folderIdInput)
                            ? 'border-green-400' // Highlight with green border if it's an Email Studio folder
                            : 'border-gray-300'
                        }`}
                      >
                        <span className="truncate">
                          {folderIdInput 
                            ? (folders.find(f => f.id.toString() === folderIdInput)?.name || 
                               `Folder ID: ${folderIdInput}`)
                            : "Select a folder"
                          }
                        </span>
                        <svg className="-mr-1 ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        {folders.some(f => f.id.toString() === folderIdInput) && (
                          <span className="ml-1 h-2 w-2 bg-green-500 rounded-full" title="Content Builder Folder"></span>
                        )}
                      </button>
                    </div>
                    
                    {showFolderDropdown && (
                      <div 
                        className="origin-top-right absolute right-0 mt-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                      >
                        <div className="p-2">
                          <input
                            type="text"
                            value={folderSearchTerm}
                            onChange={(e) => setFolderSearchTerm(e.target.value)}
                            placeholder="Search folders..."
                            className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1" role="none">
                          {/* "Select a folder" option */}
                          <button
                            onClick={() => {
                              setFolderIdInput('');
                              setShowFolderDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            role="menuitem"
                          >
                            Select a folder
                          </button>
                          
                          {/* Email Studio Folders - Show first if present */}
                          {migrationModule === 'emails' && emailFolders.length > 0 && (
                            <>
                              <div className="p-2 sticky top-0 border-b border-gray-200 flex justify-between items-center bg-green-50">
                                <h5 className="font-medium text-xs text-green-700">
                                  Email Studio Folders
                                </h5>
                                <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium">Recommended for Emails</span>
                              </div>
                              
                              {filteredEmailFolders.map((folder, index) => (
                                <button
                                  key={`email-folder-${folder.id}-${index}`}
                                  type="button"
                                  onClick={() => setFolderIdInput(folder.id.toString())}
                                  className={`w-full text-left px-3 py-2 border-b border-gray-200 text-sm hover:bg-blue-50 flex items-center ${
                                    folderIdInput === folder.id.toString() ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <span className="w-8 text-gray-500">
                                    📧
                                  </span>
                                  <span>
                                    {folder.name} 
                                    <span className="ml-1 text-xs text-gray-500">({folder.id})</span>
                                    <span className="ml-2 text-xs text-green-600">[Email Studio]</span>
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                          
                          {/* Content Builder Folders */}
                          {folders.length > 0 && (
                            <div className={`p-2 sticky top-0 border-b border-gray-200 flex justify-between items-center ${
                              migrationModule === 'emails' ? 'bg-yellow-50' : 'bg-green-50'
                            }`}>
                              <h5 className={`font-medium text-xs ${migrationModule === 'emails' ? 'text-yellow-700' : 'text-green-700'}`}>
                                Content Builder Folders
                              </h5>
                              {migrationModule === 'emails' && (
                                <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-xs font-medium">Not Recommended for Emails</span>
                              )}
                            </div>
                          )}
                          
                          {filteredFolders.map((folder, index) => (
                            <button
                              key={`content-builder-folder-${folder.id}-${index}`}
                              type="button"
                              onClick={() => setFolderIdInput(folder.id.toString())}
                              className={`w-full text-left px-3 py-2 border-b border-gray-200 text-sm hover:bg-blue-50 flex items-center ${
                                folderIdInput === folder.id.toString() ? 'bg-blue-50' : ''
                              }`}
                            >
                              <span className="w-8 text-gray-500">
                                {folder.parentId ? '📁' : '📂'}
                              </span>
                              <span>
                                {folder.name} 
                                <span className="ml-1 text-xs text-gray-500">({folder.id})</span>
                              </span>
                            </button>
                          ))}
                          
                          {folders.length === 0 && emailFolders.length === 0 && (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              {folderSearchTerm ? 'No folders match your search.' : 'No folders found. Please refresh to fetch folders.'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {renderMigrationButton('emails')}
              </div>
              
              {renderMigrationResults('emails')}
            </div>
            
            {/* Forms Migration */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Forms</h3>
                {renderMigrationButton('forms')}
              </div>
              <p className="text-gray-600 mb-2">
                Convert HubSpot forms to SFMC CloudPages with AMPscript.
              </p>
              {renderMigrationResults('forms')}
            </div>
            
            {/* Workflows Migration */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Workflows</h3>
                {renderMigrationButton('workflows')}
              </div>
              <p className="text-gray-600 mb-2">
                Map HubSpot workflows to SFMC Journey Builder journeys.
              </p>
              {renderMigrationResults('workflows')}
            </div>
          </div>
        </div>
        
        {/* Migration Logs Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-6">Migration Logs</h2>
          
          {Object.keys(migrationResults).length === 0 ? (
            <p className="text-gray-600">No migration logs yet. Start a migration to see results here.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(migrationResults).map(([module, result]) => {
                if (migrationStatus[module] !== 'success' || !result.results) {
                  return null;
                }
                
                return (
                  <div key={module} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                    <h3 className="text-lg font-medium capitalize mb-3">{module} Migration Results</h3>
                    <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-60">
                      <pre className="text-xs text-gray-800">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SFMC Connect Modal */}
      {showSfmcModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Connect to Salesforce Marketing Cloud</h3>
            <form onSubmit={connectToSFMC}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    name="clientId"
                    value={sfmcCredentials.clientId}
                    onChange={handleSfmcInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter your SFMC Client ID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    name="clientSecret"
                    value={sfmcCredentials.clientSecret}
                    onChange={handleSfmcInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter your SFMC Client Secret"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subdomain
                  </label>
                  <input
                    type="text"
                    name="subdomain"
                    value={sfmcCredentials.subdomain}
                    onChange={handleSfmcInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="E.g. mc6yqkp89lf5hy7p1r6zcl09j"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSfmcModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Upload Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl">
            <h3 className="text-lg font-semibold mb-4">Upload Custom SFMC Template</h3>
            <form onSubmit={uploadCustomTemplate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={customTemplate.name}
                    onChange={handleTemplateInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter template name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template HTML Content
                  </label>
                  <textarea
                    name="content"
                    value={customTemplate.content}
                    onChange={handleTemplateInputChange}
                    className="w-full h-96 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder="Paste your HTML template content here"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include <code className="bg-gray-100 px-1 rounded">data-type="slot" data-key="slotName"</code> attributes for editable regions.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Folder ID
                  </label>
                  <input
                    type="text"
                    name="folderId"
                    value={customTemplate.folderId}
                    onChange={handleTemplateInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter folder ID"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-500"
                >
                  Upload Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Folder ID Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Select SFMC Folder for {migrationModule}</h3>
            
            <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-md">
              <h3 className="font-semibold text-blue-700">Select Folder for {migrationModule}</h3>
              <p className="text-sm text-blue-600 mt-1">
                {migrationModule === 'emails' ? (
                  <>
                    <strong>Important:</strong> For proper template-based emails, we recommend using an Email Studio folder.
                  </>
                ) : (
                  <>
                    Choose a folder from Content Builder where your migrated content will be created.
                  </>
                )}
              </p>
              {migrationModule === 'emails' && (
                <div className="mt-2 text-sm text-blue-600 bg-blue-100 p-2 rounded">
                  <strong>Important:</strong> This tool creates template-based emails using the official Salesforce Marketing Cloud API methods:
                  <ul className="list-disc ml-5 mt-1">
                    <li>Primary: SOAP API with proper template structure</li>
                    <li>Fallback: REST API with complete email attributes</li>
                  </ul>
                  <p className="mt-1">All emails will include subject lines, preheaders and sender information as recommended by Salesforce.</p>
                </div>
              )}
            </div>
            
            <form onSubmit={handleFolderIdSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder ID
                </label>
                <input
                  type="text"
                  value={folderIdInput}
                  onChange={e => setFolderIdInput(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    migrationModule === 'emails' && folderIdInput && folders.some(f => f.id.toString() === folderIdInput)
                      ? 'border-green-400' // Highlight with green border if it's an Email Studio folder
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter folder ID, e.g. 13172"
                />
                <p className="mt-1 text-sm text-gray-500">
                  The numeric ID of the folder in SFMC where content will be created.
                  {migrationModule === 'emails' && folders.some(f => f.id.toString() === folderIdInput) && (
                    <span className="text-green-600 ml-1">✓ Valid Content Builder folder</span>
                  )}
                </p>
              </div>
              
              {/* Folder Browser */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Your Folders:</h4>
                
                {/* Search Input */}
                <div className="mb-2 relative">
                  <input
                    type="text"
                    value={folderSearchTerm}
                    onChange={(e) => setFolderSearchTerm(e.target.value)}
                    placeholder="Search folders by name or ID..."
                    className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-md text-sm"
                  />
                  <div className="absolute left-3 top-2.5 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {folderSearchTerm && (
                    <button 
                      onClick={() => setFolderSearchTerm('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {loading ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                    <span className="text-sm text-gray-500">Loading folders...</span>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                    {/* Email Studio Folders - Show first if present */}
                    {migrationModule === 'emails' && emailFolders.length > 0 && (
                      <>
                        <div className="p-2 sticky top-0 border-b border-gray-200 flex justify-between items-center bg-green-50">
                          <h5 className="font-medium text-xs text-green-700">
                            Email Studio Folders
                          </h5>
                          <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium">Recommended for Emails</span>
                        </div>
                        
                        {filteredEmailFolders.map((folder, index) => (
                          <button
                            key={`email-folder-${folder.id}-${index}`}
                            type="button"
                            onClick={() => setFolderIdInput(folder.id.toString())}
                            className={`w-full text-left px-3 py-2 border-b border-gray-200 text-sm hover:bg-blue-50 flex items-center ${
                              folderIdInput === folder.id.toString() ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span className="w-8 text-gray-500">
                              📧
                            </span>
                            <span>
                              {folder.name} 
                              <span className="ml-1 text-xs text-gray-500">({folder.id})</span>
                              <span className="ml-2 text-xs text-green-600">[Email Studio]</span>
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                    
                    {/* Content Builder Folders */}
                    {folders.length > 0 && (
                      <div className={`p-2 sticky top-0 border-b border-gray-200 flex justify-between items-center ${
                        migrationModule === 'emails' ? 'bg-yellow-50' : 'bg-green-50'
                      }`}>
                        <h5 className={`font-medium text-xs ${migrationModule === 'emails' ? 'text-yellow-700' : 'text-green-700'}`}>
                          Content Builder Folders
                        </h5>
                        {migrationModule === 'emails' && (
                          <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-xs font-medium">Not Recommended for Emails</span>
                        )}
                      </div>
                    )}
                    
                    {filteredFolders.map((folder, index) => (
                      <button
                        key={`content-builder-folder-${folder.id}-${index}`}
                        type="button"
                        onClick={() => setFolderIdInput(folder.id.toString())}
                        className={`w-full text-left px-3 py-2 border-b border-gray-200 text-sm hover:bg-blue-50 flex items-center ${
                          folderIdInput === folder.id.toString() ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="w-8 text-gray-500">
                          {folder.parentId ? '📁' : '📂'}
                        </span>
                        <span>
                          {folder.name} 
                          <span className="ml-1 text-xs text-gray-500">({folder.id})</span>
                        </span>
                      </button>
                    ))}
                    
                    {folders.length === 0 && emailFolders.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        {folderSearchTerm ? 'No folders match your search.' : 'No folders found. Please refresh to fetch folders.'}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={getSFMCFolders}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Refresh Folders
                  </button>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-500"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Migration Results Help Section */}
      {migrationResults.emails && migrationResults.emails.migrated && migrationResults.emails.migrated.length > 0 && (
        <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h3 className="text-lg font-medium text-blue-800 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Where to Find Your Migrated Emails
          </h3>
          <div className="text-blue-700 text-sm">
            <p className="mb-2">Your emails have been successfully created in Salesforce Marketing Cloud as template-based emails. Here's how to find them:</p>
            
            <div className="ml-1 mb-2">
              <p className="font-medium">Option 1: Email Studio (Recommended)</p>
              <ol className="list-decimal ml-5">
                <li>Go to <strong>Email Studio</strong> in the top navigation</li>
                <li>Select <strong>Content</strong> from the dropdown</li>
                <li>Look for emails with the exact names listed above</li>
                <li>You may need to check different folders</li>
              </ol>
            </div>
            
            <div className="ml-1 mb-2">
              <p className="font-medium">Option 2: Search</p>
              <ol className="list-decimal ml-5">
                <li>Use the global search in the top right of Marketing Cloud</li>
                <li>Search for the email name or ID</li>
                <li>Filter results to show only emails</li>
              </ol>
            </div>
            
            <div className="ml-1">
              <p className="font-medium">Option 3: Content Builder</p>
              <ol className="list-decimal ml-5">
                <li>Go to <strong>Content Builder</strong></li>
                <li>Navigate to the folder you selected</li>
                <li>If you can't find your emails, they may be in a different folder</li>
                <li>Template-based emails may only appear in Email Studio</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Folder Explorer Modal */}
      {showFolderExplorer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
              <span>SFMC Email Explorer</span>
              <button
                onClick={() => setShowFolderExplorer(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </h3>
            
            {loadingFolderExplorer ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-gray-600">Loading folder data...</p>
              </div>
            ) : (
              <div>
                {folderExplorerResults ? (
                  <div>
                    <div className="mb-6">
                      <h4 className="font-medium text-lg mb-2">Emails by Folder</h4>
                      <div className="border rounded-md overflow-hidden">
                        {Object.keys(folderExplorerResults.folderMap).length > 0 ? (
                          Object.entries(folderExplorerResults.folderMap).map(([folderId, folderData]: [string, any]) => (
                            <div key={folderId} className="border-b last:border-b-0">
                              <div className="p-3 bg-gray-50 font-medium flex items-center justify-between">
                                <span>
                                  {folderData.folderName} 
                                  <span className="ml-2 text-xs text-gray-500">Folder ID: {folderId}</span>
                                </span>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {folderData.emails.length} email{folderData.emails.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="p-0">
                                {folderData.emails.map((email: any) => (
                                  <div key={email.id} className="p-3 border-t">
                                    <div className="text-sm font-medium">{email.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      ID: {email.id} • Created: {new Date(email.createdDate).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            No emails found. Try refreshing or checking in SFMC directly.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mt-4">
                      <p className="mb-2">
                        <strong>Looking for your emails?</strong> If you can't find your emails in the list above:
                      </p>
                      <ol className="list-decimal ml-5">
                        <li className="mb-1">Check in Email Studio (not Content Builder) in SFMC</li>
                        <li className="mb-1">Search for specific email names or IDs using the global search</li>
                        <li className="mb-1">Check the logs for the exact email ID numbers</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">
                    No data available. Try refreshing.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
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