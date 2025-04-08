# HubSpot to SFMC Migration Tool

A powerful tool developed by [Red Hibbert Group](https://www.redhibbert.com/) for migrating marketing assets from HubSpot to Salesforce Marketing Cloud.

![Red Hibbert Group Logo](https://www.redhibbert.com/images/logo.png)

## Features

This application allows you to seamlessly migrate:

- **Contacts & Lists** - Transfer your contact data and list memberships
- **Email Templates** - Migrate email designs and templates with their content

## Getting Started

### Prerequisites

- Node.js 18.x or later
- HubSpot account with API access
- Salesforce Marketing Cloud account with API access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Red-Hibbert-Group/HubSpot-SFMC-Migrator.git
   cd HubSpot-SFMC-Migrator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env.local` file with the following variables:
   ```
   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # HubSpot OAuth
   HUBSPOT_CLIENT_ID=your_hubspot_client_id
   HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
   HUBSPOT_REDIRECT_URI=http://localhost:3000/api/callback
   NEXT_PUBLIC_HUBSPOT_CLIENT_ID=your_hubspot_client_id
   NEXT_PUBLIC_HUBSPOT_REDIRECT_URI=http://localhost:3000/api/callback

   # Supabase (optional for persistent storage)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## API Connection Guide

### HubSpot API Setup

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new app by clicking "Create App" in the top right
3. Select "Public App"
4. Fill in the required information:
   - App Name: "SFMC Migration Tool" (or your preferred name)
   - Description: Brief description of your application
5. In the "Auth" tab, configure:
   - Redirect URL: Add your application callback URL (e.g., `https://your-domain.com/api/callback` or `http://localhost:3000/api/callback` for local development)
   - Scopes: Select the following minimum required scopes:
     - `contacts`
     - `content`
     - `forms` (optional)
     - `automation`
6. Click "Create App" to save your configuration
7. Note your Client ID and Client Secret for the `.env.local` file

### Salesforce Marketing Cloud API Setup

1. Log in to your SFMC account and navigate to **Setup** (gear icon in top right)
2. Search for "Installed Packages" and select it
3. Click "New" to create a new package
4. Enter a name for your package (e.g., "Migration Tool")
5. Once created, click "Add Component" and select "API Integration"
6. Select "Server-to-Server" integration type
7. Set the following permissions:
   - Email: Read, Write, Send
   - Content Builder: Read, Write
   - Data Extensions: Read, Write
   - Subscribers: Read, Write
8. Save the component
9. Note the following information for your application:
   - **Client ID**: Listed in the package details
   - **Client Secret**: Listed in the package details
   - **Subdomain**: Found in your SFMC URL (e.g., if your URL is `https://mc.s7.exacttarget.com`, the subdomain is `mc.s7`)

## Deployment

### Deploying to Vercel

1. Create a Vercel account if you don't have one at [vercel.com](https://vercel.com)
2. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Deploy the application:
   ```bash
   vercel
   ```
4. Or connect your GitHub repository to Vercel for automated deployments

### Environment Variables for Production

When deploying, be sure to set the following environment variables:

- `NEXT_PUBLIC_APP_URL`: Your production URL (e.g., `https://hub-spot-sfmc-migrator-nu.vercel.app`)
- `HUBSPOT_REDIRECT_URI`: Your production callback URL (e.g., `https://hub-spot-sfmc-migrator-nu.vercel.app/api/callback`)
- `NEXT_PUBLIC_HUBSPOT_REDIRECT_URI`: Same as above
- `HUBSPOT_CLIENT_ID`: Your HubSpot client ID
- `HUBSPOT_CLIENT_SECRET`: Your HubSpot client secret
- `NEXT_PUBLIC_HUBSPOT_CLIENT_ID`: Same as HUBSPOT_CLIENT_ID

## Support

For support, please contact:

Red Hibbert Group  
3001 Bishop Dr, Suite 300  
San Ramon, CA 94583  
Phone: 732-734-8282  
Email: contact@redhibbert.com

## License

This project is licensed under the MIT License - see the LICENSE file for details.
