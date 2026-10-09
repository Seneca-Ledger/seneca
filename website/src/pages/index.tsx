import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

const features = [
  {
    title: 'Statement import',
    description:
      'PDF, CSV, XLSX, DOCX and image files. Native parsers for Kaspi, Bereke and Bank Hapoalim / Isracard, OCR for scans, and a generic AI parser for any other bank. SHA-256 hashing stops duplicate uploads.',
  },
  {
    title: 'Clean, categorized data',
    description:
      'Fingerprint-based deduplication, categorization rules that learn from your corrections, and AI categorization through any OpenAI-compatible endpoint, including a local one.',
  },
  {
    title: 'Dashboards and reports',
    description:
      'Cash flow, trends, top categories and merchants, a data health view, and custom reports with CSV and XLSX export.',
  },
  {
    title: 'Budgets, goals and net worth',
    description:
      'Budgets with live spend, savings goals, subscription detection, a crypto portfolio, net worth across accounts, and advice generated from your own numbers.',
  },
  {
    title: 'VAT and income tax',
    description:
      'A VAT engine with returns, plus year-end income tax drafts: Germany Anlage EÜR, Spain Modelo 100, Poland PIT-36L / PIT-28 / PIT-36, and a generic summary elsewhere. Filing deadlines for 25 EU countries.',
  },
  {
    title: 'Receipts on a map',
    description:
      'Collect receipts by upload or from an IMAP inbox, link them to transactions, and see where each one was bought on self-hosted map tiles.',
  },
  {
    title: 'Workspaces, roles and audit',
    description:
      'Multi-tenant workspaces with owner, admin, member and viewer roles, an audit log with rollback, TOTP two-factor sign-in and session management.',
  },
  {
    title: 'Integrations and API',
    description:
      'S3-compatible and WebDAV storage, Telegram reports, webhooks, API keys and an MCP server.',
  },
  {
    title: 'Self-hosted by design',
    description:
      'One Docker Compose stack, encrypted backups, Prometheus-format metrics, structured JSON logs, and a UI in 36 languages. MIT licensed.',
  },
];

const screenshots = [
  {
    src: '/img/screenshots/dashboard-trends.png',
    title: 'Trends',
    caption: 'Twelve months of income and expenses with period presets.',
  },
  {
    src: '/img/screenshots/statements-top-categories.png',
    title: 'Statements',
    caption: 'Work queue, spend analytics and category drill-down.',
  },
  {
    src: '/img/screenshots/tax-declaration.png',
    title: 'Tax declaration',
    caption: 'An Anlage EÜR draft with data completeness and filing dates.',
  },
  {
    src: '/img/screenshots/budgets.png',
    title: 'Budgets',
    caption: 'Monthly and annual budgets tracked against real spend.',
  },
  {
    src: '/img/screenshots/advice.png',
    title: 'Advice',
    caption: 'Observations about savings, prices and reconciliation.',
  },
];

const stack = [
  'NestJS 11',
  'Next.js 16',
  'React 19',
  'TypeScript',
  'PostgreSQL 14',
  'Redis 7',
  'TypeORM',
  'BullMQ',
  'Socket.IO',
  'Docker Compose',
];

function Screenshot({ src, title, caption }: { src: string; title: string; caption: string }): JSX.Element {
  return (
    <figure className="homepage-shot">
      <a href={useBaseUrl(src)} target="_blank" rel="noopener noreferrer">
        <img src={useBaseUrl(src)} alt={`Lumio ${title.toLowerCase()} screen`} loading="lazy" width={1895} height={947} />
      </a>
      <figcaption>
        <strong>{title}</strong> — {caption}
      </figcaption>
    </figure>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="Lumio Documentation"
      description="Documentation for Lumio, an open-source, self-hosted platform for bank statements, budgets and taxes"
    >
      <header className="hero hero--primary homepage-hero">
        <div className="container">
          <div className="homepage-metric">Open source · Self-hosted · MIT</div>
          <h1 className="hero__title">Your bank statements, turned into clean financial data</h1>
          <p className="hero__subtitle">
            Lumio imports statements and receipts, deduplicates and categorizes every transaction, and builds
            dashboards, budgets, VAT returns and income tax drafts on top — on your own server.
          </p>
          <div className="hero__buttons">
            <Link className="button button--primary button--lg" to="/docs/getting-started/quick-start">
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Read the docs
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="homepage-showcase">
          <div className="container">
            <a href={useBaseUrl('/img/screenshots/dashboard-overview.png')} target="_blank" rel="noopener noreferrer">
              <img
                className="homepage-showcase__main"
                src={useBaseUrl('/img/screenshots/dashboard-overview.png')}
                alt="Lumio dashboard overview with income, spending, savings rate and top categories"
                width={1893}
                height={947}
              />
            </a>
          </div>
        </section>

        <section className="homepage-section">
          <div className="container">
            <h2>What Lumio does</h2>
            <p>
              One place for the whole path from a raw bank export to numbers you can budget, report and file taxes
              with.
            </p>
            <div className="homepage-grid">
              {features.map((feature) => (
                <div key={feature.title} className="homepage-card">
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="homepage-section">
          <div className="container">
            <h2>A closer look</h2>
            <div className="homepage-shots">
              {screenshots.map((shot) => (
                <Screenshot key={shot.src} {...shot} />
              ))}
            </div>
          </div>
        </section>

        <section className="homepage-section">
          <div className="container">
            <h2>Tech stack</h2>
            <p>A TypeScript monorepo: NestJS API, Next.js web app, PostgreSQL and Redis, all run with Docker Compose.</p>
            <div className="badge-row">
              {stack.map((item) => (
                <span key={item} className="badge-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="homepage-section">
          <div className="container">
            <div className="docs-callout">
              <h2>Ready to try Lumio?</h2>
              <p>
                The quick start brings up the full stack with Docker in a few minutes. Contributors can start with the
                architecture overview.
              </p>
              <div className="hero__buttons">
                <Link className="button button--primary button--lg" to="/docs/getting-started/quick-start">
                  Quick Start
                </Link>
                <Link className="button button--secondary button--lg" to="/docs/architecture/overview">
                  Architecture
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
