/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState, Suspense } from 'react';
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
  const [folders, setFolders] = useState<Array<any>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

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

  // Start migration for a specific module
  const startMigration = async (module: string) => {
    if (!userId) {
      alert('No user ID found. Please reconnect to HubSpot.');
      return;
    }
    
    console.log(`Starting migration for module: ${module}, current status: ${migrationStatus[module]}`);
    
    // For templates module, prompt for folder ID if it's a new migration
    if (module === 'templates' && migrationStatus[module] === 'idle') {
      console.log('Opening folder selection modal for templates migration');
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
      
      // Add folder ID for templates if provided
      if (module === 'templates' && folderIdInput.trim()) {
        const folderId = parseInt(folderIdInput.trim(), 10);
        requestData.folderId = folderId;
        console.log(`Using folder ID: ${folderId} for templates migration`);
      } else if (module === 'templates') {
        console.log('No folder ID provided, will auto-create a folder');
      }

      console.log(`Making API request to /api/migrate/${module}`, requestData);
      
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
        {result.migrated && result.migrated.length > 0 && (
          <div className="mt-2 text-sm">
            <p className="font-semibold">Migrated {result.migrated.length} items:</p>
            <ul className="list-disc list-inside pl-2 mt-1">
              {result.migrated.map((item: any, index: number) => (
                <li key={index} className="text-xs">
                  {item.hubspotName || item.customName || `Item ${index + 1}`}
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
      </div>
    );
  };

  // Get SFMC folders
  const getSFMCFolders = async () => {
    if (!sfmcCredentials.clientId || !sfmcCredentials.clientSecret || !sfmcCredentials.subdomain) {
      alert('SFMC credentials are required');
      return;
    }
    
    setLoadingFolders(true);
    
    try {
      const response = await axios.post('/api/sfmc/folders', {
        sfmcCredentials
      });
      
      if (response.data && response.data.items) {
        setFolders(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching SFMC folders:', error);
      alert('Failed to fetch SFMC folders');
    } finally {
      setLoadingFolders(false);
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
            <h3 className="text-lg font-semibold mb-4">Enter Folder ID</h3>
            <form onSubmit={handleFolderIdSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Folder ID
                  </label>
                  <input
                    type="text"
                    name="folderId"
                    value={folderIdInput}
                    onChange={(e) => setFolderIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter folder ID"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to automatically create a "HubSpot Templates" folder
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700">
                      SFMC Folders
                    </label>
                    <button
                      type="button"
                      onClick={getSFMCFolders}
                      disabled={loadingFolders}
                      className="text-sm text-blue-600 hover:text-blue-500"
                    >
                      {loadingFolders ? 'Loading...' : 'Refresh Folders'}
                    </button>
                  </div>
                  
                  {folders.length > 0 ? (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {folders.map((folder) => (
                            <tr key={folder.id}>
                              <td className="px-3 py-2 text-xs text-gray-500">{folder.name}</td>
                              <td className="px-3 py-2 text-xs text-gray-500">{folder.id}</td>
                              <td className="px-3 py-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setFolderIdInput(folder.id.toString())}
                                  className="text-blue-600 hover:text-blue-500"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      {loadingFolders ? 'Loading folders...' : 'Click "Refresh Folders" to view available folders'}
                    </p>
                  )}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Start Migration
                </button>
              </div>
            </form>
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