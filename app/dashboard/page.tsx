/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

// Define integration status types
type IntegrationStatus = 'loading' | 'connected' | 'disconnected' | 'error';
type MigrationStatus = 'idle' | 'loading' | 'success' | 'error';
type MigrationResult = Record<string, any>;

export default function Dashboard() {
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
    
    try {
      setMigrationStatus(prev => ({
        ...prev,
        [module]: 'loading'
      }));

      // Call migration API with userId, hubspotToken, and SFMC credentials
      const response = await axios.post(`/api/migrate/${module}`, {
        userId,
        hubspotToken,
        sfmcCredentials,  // Pass SFMC credentials directly
        limit: 100 // You can adjust this or make it configurable
      });

      // Update migration status and results
      setMigrationStatus(prev => ({
        ...prev,
        [module]: 'success'
      }));
      
      setMigrationResults(prev => ({
        ...prev,
        [module]: response.data
      }));
    } catch (error) {
      console.error(`Error migrating ${module}:`, error);
      
      setMigrationStatus(prev => ({
        ...prev,
        [module]: 'error'
      }));
      
      setMigrationResults(prev => ({
        ...prev,
        [module]: { error: 'Migration failed' }
      }));
    }
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
        </div>
      );
    }
    
    return (
      <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
        <p className="font-semibold">Success:</p>
        <p>{result.message || `Migrated ${result.migrated} items`}</p>
        {result.migrated > 0 && (
          <p className="mt-2 text-sm">
            View details in the logs below
          </p>
        )}
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
                {renderMigrationButton('templates')}
              </div>
              <p className="text-gray-600 mb-2">
                Convert HubSpot email templates to SFMC Content Builder templates.
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
    </main>
  );
} 