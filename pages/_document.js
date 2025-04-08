import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'HubSpot to SFMC Migration Tool',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD'
              },
              provider: {
                '@type': 'Organization',
                name: 'Red Hibbert Group',
                url: 'https://www.redhibbert.com'
              },
              description: 'Seamlessly transfer your marketing assets from HubSpot to Salesforce Marketing Cloud with our dedicated migration tool.'
            })
          }}
        />
        {/* This hides the Next.js development indicator */}
        <style>
          {`
            #__next-build-watcher,
            .nextjs-portal-warning-container,
            .nextjs-container-build-in-progress-wrapper {
              display: none !important;
            }
          `}
        </style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 