import { PolicyEngineShell } from "@policyengine/ui-kit/layout";
import "@policyengine/ui-kit/styles.css";

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

const SITE_URL = 'https://healthcare-calculator.policyengine.org';
const TITLE =
  'Healthcare Calculator | Compare ACA, Medicaid & CHIP Support by State | PolicyEngine';
const DESCRIPTION =
  "Estimate your household's ACA, Medicaid, and CHIP healthcare support across all US states. Compare benefits by income, household size, and state with PolicyEngine's free calculator.";
const OG_TITLE =
  'Healthcare Calculator | Compare ACA, Medicaid & CHIP Support by State';
const OG_DESCRIPTION =
  "Estimate your household's ACA, Medicaid, and CHIP healthcare support across all US states. Compare benefits by income, household size, and state.";
const TWITTER_TITLE =
  'Healthcare Calculator | Compare ACA, Medicaid & CHIP Support';
const TWITTER_DESCRIPTION =
  "Estimate your household's ACA, Medicaid, and CHIP healthcare support across all US states.";
const OG_IMAGE = `${SITE_URL}/policyengine-logo.png`;
const GA_MEASUREMENT_ID = 'G-2YHG89FY0N';
const TOOL_NAME = 'healthcare-calculator';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: 'PolicyEngine',
    locale: 'en_US',
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: 'summary',
    title: TWITTER_TITLE,
    description: TWITTER_DESCRIPTION,
    images: [{ url: OG_IMAGE }],
  },
  icons: { icon: `${BASE_PATH}/policyengine-logo.png` },
};

export const viewport: Viewport = {
  themeColor: '#2C6496',
  width: 'device-width',
  initialScale: 1,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Healthcare Calculator',
  description: OG_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: {
    '@type': 'Organization',
    name: 'PolicyEngine',
    url: 'https://policyengine.org',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          // Static JSON object built above; not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
                <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', { tool_name: '${TOOL_NAME}' });
          `}
        </Script>
        <Script id="ga-engagement" strategy="afterInteractive">
          {`
            (function() {
              var TOOL_NAME = '${TOOL_NAME}';
              if (typeof window === 'undefined' || !window.gtag) return;

              var scrollFired = {};
              window.addEventListener('scroll', function() {
                var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (docHeight <= 0) return;
                var pct = Math.floor((window.scrollY / docHeight) * 100);
                [25, 50, 75, 100].forEach(function(m) {
                  if (pct >= m && !scrollFired[m]) {
                    scrollFired[m] = true;
                    window.gtag('event', 'scroll_depth', { percent: m, tool_name: TOOL_NAME });
                  }
                });
              }, { passive: true });

              [30, 60, 120, 300].forEach(function(sec) {
                setTimeout(function() {
                  if (document.visibilityState !== 'hidden') {
                    window.gtag('event', 'time_on_tool', { seconds: sec, tool_name: TOOL_NAME });
                  }
                }, sec * 1000);
              });

              document.addEventListener('click', function(e) {
                var link = e.target && e.target.closest ? e.target.closest('a') : null;
                if (!link || !link.href) return;
                try {
                  var url = new URL(link.href, window.location.origin);
                  if (url.hostname && url.hostname !== window.location.hostname) {
                    window.gtag('event', 'outbound_click', {
                      url: link.href,
                      target_hostname: url.hostname,
                      tool_name: TOOL_NAME
                    });
                  }
                } catch (err) {}
              });
            })();
          `}
        </Script>
        <noscript>
          <p>
            You need to enable JavaScript to use the Healthcare Calculator. This
            tool estimates ACA, Medicaid, and CHIP support across US states.
          </p>
        </noscript>
        <PolicyEngineShell country="us">
        {children}
        </PolicyEngineShell>
      </body>
    </html>
  );
}
