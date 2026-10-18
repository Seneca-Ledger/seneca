import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'intro',
        'getting-started/quick-start',
        'getting-started/local-development',
        'getting-started/configuration',
        'getting-started/demo-mode',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/importing-statements',
        'guides/workspaces-and-rbac',
        'guides/integrations',
        'guides/categorization',
        'guides/receipt-maps',
        'guides/income-tax-declaration',
        'guides/observability',
        'guides/mcp',
        'guides/security-posture',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/backend',
        'architecture/frontend',
        'architecture/database',
        'architecture/parsing-pipeline',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing/development-workflow',
        'contributing/testing',
        'contributing/coding-standards',
        'contributing/adding-a-bank-parser',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/docker',
        'deployment/ci-cd',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/makefile',
        'reference/api',
        'reference/supported-banks',
      ],
    },
  ],
};

export default sidebars;
