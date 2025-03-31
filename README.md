# HubSpot to SFMC Migration Tool

A web application that helps marketing teams migrate their data from HubSpot to Salesforce Marketing Cloud (SFMC). Built with Next.js, Supabase, and Tailwind CSS.

## Features

- 🔄 **Seamless Migration:** Transfer contacts, email templates, forms, and workflows from HubSpot to SFMC
- 🔌 **OAuth Integration:** Connect to HubSpot with secure OAuth authentication
- 🔑 **SFMC API Integration:** Connect to SFMC using API credentials
- 📊 **Migration Dashboard:** Track migration progress and view logs
- 🎨 **Modern UI:** Built with a clean, responsive design using Tailwind CSS
- 🛡️ **Secure:** Tokens stored securely in Supabase database with proper authentication

## What Can Be Migrated

- **Contacts & Lists:** Migrate HubSpot contacts and lists to SFMC Data Extensions
- **Email Templates:** Convert HubSpot email templates to SFMC Content Builder templates
- **Forms:** Transform HubSpot forms into SFMC CloudPages with AMPscript
- **Workflows:** Map HubSpot workflows to SFMC Journey Builder journeys

## Setup & Installation

### Prerequisites

- Node.js v14+ 
- HubSpot developer account with OAuth app
- SFMC account with API integration package
- Supabase account for database

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hubspot-sfmc-migrator.git
   cd hubspot-sfmc-migrator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in the required environment variables:
     - HubSpot OAuth credentials
     - Supabase URL and key

4. **Set up Supabase schema**
   - Create a table called `integration_tokens` with the following structure:
     - `id`: uuid (primary key)
     - `user_id`: uuid (foreign key to auth.users)
     - `platform`: text (hubspot or sfmc)
     - `tokens`: jsonb
     - `created_at`: timestamp with time zone
     - `updated_at`: timestamp with time zone

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### HubSpot Configuration

1. Create a HubSpot developer account
2. Create a new app with OAuth integration
3. Set the redirect URI to `http://localhost:3000/api/auth/hubspot`
4. Request the following scopes: contacts, content, forms, automation
5. Copy the Client ID and Client Secret to your `.env.local` file

### SFMC Configuration

1. In SFMC, create a new Installed Package
2. Add component type: API Integration
3. Set the integration type to Server-to-Server
4. Select appropriate scopes for contacts, content, and journey builder
5. Copy the Client ID, Client Secret, and subdomain to use in the app

## Development

### Project Structure

```
hubspot-sfmc-migrator/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── hubspot/
│   │   │   └── sfmc/
│   │   └── migrate/
│   │       ├── contacts/
│   │       ├── templates/
│   │       ├── forms/
│   │       └── workflows/
│   ├── dashboard/
│   ├── components/
│   ├── lib/
│   ├── supabase/
│   └── utils/
├── public/
└── ...config files
```

### APIs Used

- **HubSpot API:** For fetching contacts, templates, forms, and workflows
- **SFMC REST/SOAP APIs:** For creating data extensions, templates, CloudPages, and journeys

## Deployment

This project can be easily deployed to Vercel:

1. Push your repository to GitHub
2. Import the repository into Vercel
3. Configure the environment variables
4. Deploy

## License

This project is licensed under the MIT License.

## Acknowledgements

- HubSpot API Documentation
- Salesforce Marketing Cloud API Documentation
- Next.js Framework
- Supabase for authentication and database
- Tailwind CSS for styling
