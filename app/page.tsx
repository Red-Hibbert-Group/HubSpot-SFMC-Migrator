/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Link from 'next/link';

export default function Home() {
  // HubSpot OAuth URL construction with fallback values
  const hubspotClientId = process.env.NEXT_PUBLIC_HUBSPOT_CLIENT_ID || '63e23121-89be-48fa-9e1b-7c68d7e1f83b';
  const hubspotRedirectUri = process.env.NEXT_PUBLIC_HUBSPOT_REDIRECT_URI || 'https://hub-spot-sfmc-migrator-nu.vercel.app/api/callback';
  
  // For debugging - log variables to console
  console.log('Client ID:', hubspotClientId);
  console.log('Redirect URI:', hubspotRedirectUri);
  
  // Create the OAuth authorization URL with all required scopes
  const hubspotAuthUrl = `https://app.hubspot.com/oauth/authorize?client_id=${hubspotClientId}&redirect_uri=${encodeURIComponent(hubspotRedirectUri)}&scope=content%20automation%20oauth%20forms%20files%20crm.objects.contacts.write%20crm.objects.companies.read%20crm.lists.read%20crm.objects.deals.read%20crm.schemas.contacts.read%20crm.objects.contacts.read`;
  
  // For debugging
  console.log('Full Auth URL:', hubspotAuthUrl);
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 lg:p-24 bg-gradient-to-b from-gray-100 to-white">
      <div className="max-w-5xl w-full text-center mb-12">
        <div className="flex justify-center mb-8">
          <div className="w-64 h-16 relative">
            {/* Text fallback instead of Image */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-red-700 font-bold text-3xl">RED HIBBERT GROUP</span>
            </div>
          </div>
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl mb-6">
          HubSpot to SFMC <span className="text-red-700">Migration Tool</span>
        </h1>
        <p className="text-xl leading-8 text-gray-600 mb-8 max-w-3xl mx-auto">
          Our dedicated migration tool helps you transfer your marketing assets from HubSpot to Salesforce Marketing Cloud with ease and precision.
        </p>
        
        {/* Information banner */}
        <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 mb-10 max-w-3xl mx-auto">
          <div className="flex">
            <div className="flex-shrink-0 pt-0.5">
              <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 text-left">
              <h4 className="text-sm font-medium text-blue-800">About this migration tool:</h4>
              <p className="mt-2 text-sm text-blue-700">
                This tool was developed by Red Hibbert Group, a Salesforce Marketing Cloud experts team, to simplify the migration process from HubSpot to SFMC. It securely transfers your data without storing any credentials permanently.
              </p>
              <p className="mt-2 text-sm text-blue-700">
                <strong>Before using this tool, you should have:</strong>
              </p>
              <ul className="list-disc pl-5 mt-1 text-sm text-blue-700 space-y-1">
                <li>Admin access to your HubSpot account</li>
                <li>Admin access to your Salesforce Marketing Cloud instance</li>
                <li>Server-to-Server API integration set up in SFMC (instructions provided)</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
          <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <div className="text-red-700 text-3xl font-bold mb-6">What We Migrate</div>
            <ul className="text-left space-y-4">
              <li className="flex items-center text-lg">
                <svg className="h-6 w-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <div>
                  <span className="font-semibold">Contacts & Lists</span>
                  <p className="text-gray-600 text-sm mt-1">Transfer your contact data and list memberships</p>
                </div>
              </li>
              <li className="flex items-center text-lg">
                <svg className="h-6 w-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <div>
                  <span className="font-semibold">Marketing Emails</span>
                  <p className="text-gray-600 text-sm mt-1">Transfer your email campaigns to SFMC</p>
                </div>
              </li>
            </ul>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <div className="text-red-700 text-3xl font-bold mb-6">How It Works</div>
            <ol className="text-left space-y-4 list-inside">
              <li className="flex items-center text-lg">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">1</span>
                <div>
                  <span className="font-semibold">Connect your HubSpot account</span>
                  <p className="text-gray-600 text-sm mt-1">Authorize access to your HubSpot data</p>
                </div>
              </li>
              <li className="flex items-center text-lg">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">2</span>
                <div>
                  <span className="font-semibold">Connect your SFMC account</span>
                  <p className="text-gray-600 text-sm mt-1">Provide your SFMC API credentials</p>
                </div>
              </li>
              <li className="flex items-center text-lg">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">3</span>
                <div>
                  <span className="font-semibold">Select what to migrate</span>
                  <p className="text-gray-600 text-sm mt-1">Choose which assets to transfer</p>
                </div>
              </li>
              <li className="flex items-center text-lg">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">4</span>
                <div>
                  <span className="font-semibold">Start migration</span>
                  <p className="text-gray-600 text-sm mt-1">Begin the transfer process</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
        
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 justify-center">
          <a 
            href={hubspotAuthUrl}
            className="rounded-md bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
          >
            Connect HubSpot
          </a>
          
          <Link 
            href="/dashboard"
            className="rounded-md bg-white px-8 py-4 text-lg font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
      
      <footer className="w-full mt-20 text-center text-gray-600">
        <div className="max-w-5xl mx-auto border-t border-gray-200 pt-8">
          <p>© {new Date().getFullYear()} Red Hibbert Group. All Rights Reserved.</p>
          <p className="mt-2">
            <a href="https://www.redhibbert.com/" className="text-red-700 hover:underline" target="_blank" rel="noopener noreferrer">
              Visit Our Website
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
