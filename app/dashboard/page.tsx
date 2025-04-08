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
        <div className="flex flex-col items-center">
          <img 
            src="/HubSpot_Migrator_Logo.png" 
            alt="HubSpot to SFMC Migration Tool" 
            className="h-20 w-20 mb-4 animate-pulse"
          />
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
        </div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Dashboard content component that uses useSearchParams
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId') || null;
  const hubspotToken = searchParams?.get('hubspotToken') || null;
  
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

  // State for migration modules - Removed templates section
  const [migrationStatus, setMigrationStatus] = useState<Record<string, MigrationStatus>>({
    contacts: 'idle',
    emails: 'idle'
  });

  // State for migration results
  const [migrationResults, setMigrationResults] = useState<Record<string, MigrationResult>>({});

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

  // HubSpot OAuth URL construction with fallback values
  const hubspotClientId = process.env.NEXT_PUBLIC_HUBSPOT_CLIENT_ID || '63e23121-89be-48fa-9e1b-7c68d7e1f83b';
  const hubspotRedirectUri = process.env.NEXT_PUBLIC_HUBSPOT_REDIRECT_URI || 'http://localhost:3000/api/callback';

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

  // Start migration for a specific module
  const startMigration = async (module: string) => {
    if (!userId) {
      alert('No user ID found. Please reconnect to HubSpot.');
      return;
    }
    
    // Check if both HubSpot and SFMC are connected
    if (hubspotStatus !== 'connected' || sfmcStatus !== 'connected') {
      alert('Please connect both HubSpot and SFMC before migrating');
      return;
    }
    
    console.log(`Starting migration for module: ${module}, current status: ${migrationStatus[module]}`);
    setShowFolderDropdown(false);
    
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

  // Render connection status badge with blue branding
  const renderStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case 'connected':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Connected</span>;
      case 'disconnected':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-[#6B7280]">Disconnected</span>;
      case 'error':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>;
      case 'loading':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-[#6B7280]">
          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting...
        </span>;
      default:
        return null;
    }
  };

  // Render migration button with blue branding
  const renderMigrationButton = (module: string) => {
    const status = migrationStatus[module];
    const isDisabled = hubspotStatus !== 'connected' || sfmcStatus !== 'connected';
    
    switch (status) {
      case 'idle':
        return (
          <button 
            onClick={() => startMigration(module)}
            disabled={isDisabled}
            className={`inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
              isDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#0356af] to-[#1589ee] hover:from-[#024a98] hover:to-[#0d6efd] transition-all duration-200'
            }`}
          >
            Migrate {module.charAt(0).toUpperCase() + module.slice(1)}
          </button>
        );
      case 'loading':
        return (
          <button 
            disabled
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#0356af] to-[#1589ee] opacity-75 cursor-not-allowed"
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
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors duration-200"
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
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#0356af] to-[#1589ee] hover:from-[#024a98] hover:to-[#0d6efd] transition-all duration-200"
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

  // Render migration results with blue styling
  const renderMigrationResults = (module: string) => {
    const result = migrationResults[module];
    const status = migrationStatus[module];
    
    if (!result || status === 'idle' || status === 'loading') {
      return null;
    }
    
    if (status === 'error') {
      return (
        <div className="mt-6 p-5 bg-[#F9FAFB] text-[#1F1F1F] rounded-lg border border-[#D1D5DB]">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="font-bold text-[#1F1F1F]">Error:</p>
              <p className="mt-1">{result.error || 'Unknown error occurred'}</p>
          {result.details && (
                <div className="mt-3 text-sm">
                  <p className="font-bold">Details:</p>
                  <div className="overflow-auto max-h-24 bg-white p-3 rounded border border-[#D1D5DB] mt-2">
                    <pre className="whitespace-pre-wrap text-[#6B7280]">{typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)}</pre>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="mt-6 p-5 bg-[#F9FAFB] text-[#1F1F1F] rounded-lg border border-[#D1D5DB]">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 w-full">
            <p className="font-bold text-[#1F1F1F]">Success:</p>
            <p className="mt-1">{result.message || `Migrated ${result.migrated} items`}</p>
            
            {module === 'emails' && (
              <div className="mt-4 p-4 bg-white border border-[#D1D5DB] rounded-lg">
                <p className="text-[#1F1F1F] font-medium">
                  Emails were migrated as structured Content Builder template emails with slots and blocks.
                </p>
                <p className="text-sm text-[#6B7280] mt-2">
                  These emails have a proper template structure with header, content, and footer blocks, making them easy to edit in Content Builder while maintaining all HubSpot content and styling.
                </p>
              </div>
            )}
            
        {result.migrated && result.migrated.length > 0 && (
              <div className="mt-4 text-sm">
                <p className="font-bold">Migrated {result.migrated.length} items:</p>
                <ul className="list-disc list-inside pl-2 mt-2">
              {result.migrated.map((item: any, index: number) => (
                    <li key={index} className="text-xs text-[#6B7280] mb-1">
                  {item.hubspotName || item.customName || `Item ${index + 1}`}
                      {module === 'emails' && item.templateId && (
                        <span className="ml-1 text-[#1589ee]">(Template ID: {item.templateId})</span>
                      )}
                </li>
              )).slice(0, 5)}
                  {result.migrated.length > 5 && <li className="text-xs text-[#6B7280]">...and {result.migrated.length - 5} more</li>}
            </ul>
          </div>
        )}
        {result.errors && result.errors.length > 0 && (
              <div className="mt-4 text-sm">
                <p className="font-bold">Errors ({result.errors.length}):</p>
                <ul className="list-disc list-inside pl-2 mt-2">
              {result.errors.map((error: any, index: number) => (
                    <li key={index} className="text-xs text-[#6B7280] mb-1">
                  {error.hubspotName || error.customName || `Item ${index + 1}`}: {error.error}
                </li>
              )).slice(0, 3)}
                  {result.errors.length > 3 && <li className="text-xs text-[#6B7280]">...and {result.errors.length - 3} more errors</li>}
            </ul>
          </div>
        )}
            <p className="mt-3 text-xs text-[#6B7280] italic">
          View full details in the logs below
        </p>
          </div>
        </div>
      </div>
    );
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
      {/* Header to match RedHibbert style */}
      <header className="bg-white shadow-sm border-b border-[#D1D5DB]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-4">
              <img 
                src="/HubSpot_Migrator_Logo.png" 
                alt="HubSpot to SFMC Migration Tool Logo" 
                className="h-14 w-14"
              />
            </div>
            <h1 className="text-2xl font-bold text-[#1F1F1F]">
              HubSpot to SFMC <span className="text-[#1589ee]">Migration Tool</span>
            </h1>
          </div>
          <Link href="/" className="text-[#1589ee] hover:underline font-medium flex items-center group">
            Back to Home
            <span className="ml-1 transform transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </header>

      {/* Main content section */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Introduction */}
        <div className="bg-[#F9FAFB] p-6 rounded-lg shadow-sm mb-8 border border-[#D1D5DB]">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" role="img">
                <title>Information Icon</title>
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-[#1F1F1F]">Migration Tool Information</h3>
              <div className="mt-1 text-sm text-[#6B7280]">
                <p>This tool securely transfers your marketing assets from HubSpot to Salesforce Marketing Cloud. Complete each step below to perform the migration.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Connection status section */}
        <div className="bg-white shadow-md overflow-hidden rounded-lg mb-8 border border-[#D1D5DB]">
          <div className="px-6 py-5 bg-gradient-to-r from-[#0356af] to-[#1589ee] text-white">
            <h2 className="text-lg font-bold">Connection Status</h2>
            <p className="mt-1 max-w-2xl text-sm text-white opacity-90">
              Connect to HubSpot and Salesforce Marketing Cloud to begin migration
            </p>
          </div>
          <div className="border-t border-[#D1D5DB] px-6 py-6">
            {/* Information banner */}
            <div className="bg-[#F9FAFB] p-5 rounded-lg mb-6 border border-[#D1D5DB]">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" role="img">
                    <title>Information Icon</title>
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-[#1F1F1F]">
                    You must connect to both HubSpot and Salesforce Marketing Cloud before migration. SFMC requires API credentials from an Installed Package with Server-to-Server integration.
                  </p>
                  <p className="mt-3 text-sm md:mt-0 md:ml-6">
                    <a href="https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/install-packages.html" className="whitespace-nowrap font-medium text-[#1589ee] hover:underline flex items-center group" target="_blank" rel="noopener noreferrer">
                      Learn more <span className="ml-1 transform transition-transform group-hover:translate-x-1">→</span>
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Connection status content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* HubSpot Connection */}
            <div>
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#1F1F1F]">HubSpot</h3>
                {renderStatusBadge(hubspotStatus)}
              </div>
                
                <div className="text-sm text-[#6B7280] mb-4">
                  <p className="flex items-center">
                    <svg className="h-4 w-4 text-[#1589ee] mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Required for: OAuth authentication to access your HubSpot data
                  </p>
                </div>
              
              {hubspotStatus === 'disconnected' && (
                <a
                  href={`https://app.hubspot.com/oauth/authorize?client_id=${hubspotClientId}&redirect_uri=${encodeURIComponent(hubspotRedirectUri)}&scope=content%20automation%20oauth%20forms%20files%20crm.objects.contacts.write`}
                  className="inline-block mt-2 px-5 py-2.5 bg-gradient-to-r from-[#0356af] to-[#1589ee] text-white rounded-md hover:from-[#024a98] hover:to-[#0d6efd] transition-all duration-200"
                >
                  Connect HubSpot
                </a>
              )}
            </div>
            
            {/* SFMC Connection */}
            <div>
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#1F1F1F]">Salesforce Marketing Cloud</h3>
                {renderStatusBadge(sfmcStatus)}
              </div>

                <div className="text-sm text-[#6B7280] mb-4">
                  <p className="flex items-center">
                    <svg className="h-4 w-4 text-[#1589ee] mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Required for: API access to create assets in your SFMC instance
                  </p>
                </div>
              
              {sfmcStatus !== 'connected' && (
                <button
                  onClick={() => setShowSfmcModal(true)}
                  className="inline-block mt-2 px-5 py-2.5 bg-gradient-to-r from-[#0356af] to-[#1589ee] text-white rounded-md hover:from-[#024a98] hover:to-[#0d6efd] transition-all duration-200"
                >
                  Connect SFMC
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Migration Modules Section */}
        <div className="bg-white shadow-md overflow-hidden rounded-lg mb-8 border border-[#D1D5DB]">
          <div className="px-6 py-5 bg-gradient-to-r from-[#0356af] to-[#1589ee] text-white">
            <h2 className="text-lg font-bold">Migration Modules</h2>
            <p className="mt-1 max-w-2xl text-sm text-white opacity-90">
              Select what you want to migrate from HubSpot to SFMC
            </p>
          </div>
          <div className="border-t border-[#D1D5DB] px-6 py-6">
            <div className="space-y-10">
            {/* Contacts & Lists Migration */}
              <div className="border-b border-[#D1D5DB] pb-8">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center">
                    <div className="bg-[#1589ee] rounded-full p-2.5 mr-4 shadow-sm">
                      <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-[#1F1F1F]">Contacts & Lists</h3>
                  </div>
                {renderMigrationButton('contacts')}
              </div>
                <p className="text-[#6B7280] mb-4">
                Migrate your HubSpot contacts and lists to SFMC Data Extensions.
              </p>

                {/* Information section */}
                <div className="bg-[#F9FAFB] p-5 rounded-lg mb-4 border border-[#D1D5DB]">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" role="img">
                        <title>Information Icon</title>
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-bold text-[#1F1F1F]">What gets migrated:</h4>
                      <ul className="mt-2 text-sm text-[#6B7280] list-disc ml-4 space-y-1.5">
                        <li>Contact details including name, email, and all associated properties</li>
                        <li>Contact lists will be created as separate Data Extensions</li>
                        <li>HubSpot properties are automatically mapped to SFMC attributes</li>
                        <li>Email addresses are used as the unique identifier</li>
                      </ul>
              </div>
                  </div>
                </div>

                {renderMigrationResults('contacts')}
            </div>

            {/* Marketing Emails Migration */}
              <div>
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center">
                    <div className="bg-[#1589ee] rounded-full p-2.5 mr-4 shadow-sm">
                      <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-[#1F1F1F]">Marketing Emails</h3>
                  </div>
                {renderMigrationButton('emails')}
              </div>
                <p className="text-[#6B7280] mb-4">
                  Migrate your HubSpot email campaigns to SFMC as structured Content Builder emails.
                </p>

                {/* Information section */}
                <div className="bg-[#F9FAFB] p-5 rounded-lg mb-4 border border-[#D1D5DB]">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" role="img">
                        <title>Information Icon</title>
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
              </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-bold text-[#1F1F1F]">What gets migrated:</h4>
                      <ul className="mt-2 text-sm text-[#6B7280] list-disc ml-4 space-y-1.5">
                        <li>Full email HTML content with all styling preserved</li>
                        <li>Subject lines, preheaders, and sender information</li>
                        <li>Emails are created as editable template-based emails in Content Builder</li>
                        <li>Proper SFMC structure with content blocks for easy editing</li>
                        <li>Images are referenced from their original HubSpot URLs</li>
                      </ul>
                      <p className="mt-3 text-sm text-[#1F1F1F] font-medium">Note: For best results, ensure you have proper access to Content Builder in SFMC.</p>
                    </div>
                  </div>
            </div>
            
                {renderMigrationResults('emails')}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer section */}
      <footer className="bg-[#1F1F1F] text-white py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0 flex items-center">
              <img 
                src="/HubSpot_Migrator_Logo.png" 
                alt="HubSpot to SFMC Migration Tool Logo" 
                className="h-12 w-12 mr-4"
              />
              <div>
                <h3 className="text-lg font-bold">HubSpot to SFMC Migration Tool</h3>
                <p className="text-gray-300 text-sm mt-1">Seamlessly transfer your marketing assets between platforms</p>
              </div>
            </div>
            <div className="flex space-x-8">
              <a href="#" className="text-gray-300 hover:text-white hover:underline transition-colors duration-200 flex items-center group">
                Documentation
                <span className="ml-1 transform transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a href="#" className="text-gray-300 hover:text-white hover:underline transition-colors duration-200 flex items-center group">
                Support
                <span className="ml-1 transform transition-transform group-hover:translate-x-1">→</span>
              </a>
              <Link href="/" className="text-gray-300 hover:text-white hover:underline transition-colors duration-200 flex items-center group">
                Home
                <span className="ml-1 transform transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-800 pt-6 text-sm text-gray-400 text-center">
            <p>© {new Date().getFullYear()} | All rights reserved</p>
          </div>
        </div>
      </footer>

      {/* SFMC Connect Modal */}
      {showSfmcModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#1F1F1F]">Connect to Salesforce Marketing Cloud</h3>
              <button 
                onClick={() => setShowSfmcModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Information banner */}
            <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#D1D5DB] mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-[#1589ee]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" role="img">
                    <title>Information Icon</title>
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-bold text-[#1F1F1F]">How to find your SFMC API credentials:</h4>
                  <ol className="mt-2 text-sm text-[#6B7280] list-decimal space-y-1.5 ml-5">
                    <li>Log in to your SFMC account</li>
                    <li>Navigate to Setup &gt; Platform Tools &gt; Apps &gt; Installed Packages</li>
                    <li>Create a new package or use an existing one</li>
                    <li>Add a "Server-to-Server" API component</li>
                    <li>Copy the Client ID, Client Secret, and note your subdomain from your SFMC URL</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <form onSubmit={connectToSFMC}>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-[#1F1F1F] mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    name="clientId"
                    value={sfmcCredentials.clientId}
                    onChange={handleSfmcInputChange}
                    className="w-full px-4 py-2.5 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1589ee] focus:border-transparent"
                    placeholder="Enter your SFMC Client ID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1F1F1F] mb-1.5">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    name="clientSecret"
                    value={sfmcCredentials.clientSecret}
                    onChange={handleSfmcInputChange}
                    className="w-full px-4 py-2.5 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1589ee] focus:border-transparent"
                    placeholder="Enter your SFMC Client Secret"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1F1F1F] mb-1.5">
                    Subdomain
                  </label>
                  <input
                    type="text"
                    name="subdomain"
                    value={sfmcCredentials.subdomain}
                    onChange={handleSfmcInputChange}
                    className="w-full px-4 py-2.5 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1589ee] focus:border-transparent"
                    placeholder="E.g. mc6yqkp89lf5hy7p1r6zcl09j"
                    required
                  />
                  <p className="mt-2 text-xs text-[#6B7280]">
                    Your subdomain can be found in your SFMC URL (e.g., https://mc.s7.exacttarget.com - the subdomain is "mc.s7")
                  </p>
                </div>
              </div>
              <div className="mt-8 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowSfmcModal(false)}
                  className="px-5 py-2.5 border border-[#D1D5DB] rounded-md text-sm font-medium text-[#6B7280] hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0356af] to-[#1589ee] text-white rounded-md text-sm font-medium hover:from-[#024a98] hover:to-[#0d6efd] transition-all duration-200"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Add a CSS animation for the modal fade-in without using styled-jsx
function ModalStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out;
      }
    `}} />
  );
}

// Main Dashboard component with Suspense
export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoader />}>
      <ModalStyles />
      <DashboardContent />
    </Suspense>
  );
} 