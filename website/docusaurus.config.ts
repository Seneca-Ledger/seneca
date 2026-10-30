import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Stoic Budget Docs',
  tagline: 'Open-source financial data platform for bank statements',
  favicon: 'img/favicon.svg',

  url: 'https://stoic-budget.github.io',
  baseUrl: '/stoic-budget/',
  organizationName: 'stoic-budget',
  projectName: 'stoic-budget',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  trailingSlash: false,

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/stoic-budget/stoic-budget/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    image: 'img/screenshots/dashboard-overview.png',
    navbar: {
      title: 'Stoic Budget',
      logo: {
        alt: 'Stoic Budget logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/getting-started/quick-start',
          label: 'Quick Start',
          position: 'left',
        },
        {
          to: '/docs/guides/importing-statements',
          label: 'Guides',
          position: 'left',
        },
        {
          to: '/docs/architecture/overview',
          label: 'Architecture',
          position: 'left',
        },
        {
          href: 'https://github.com/stoic-budget/stoic-budget',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/docs/intro' },
            { label: 'Quick Start', to: '/docs/getting-started/quick-start' },
            { label: 'Architecture', to: '/docs/architecture/overview' },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/stoic-budget/stoic-budget/issues',
            },
            {
              label: 'Contributing',
              to: '/docs/contributing/development-workflow',
            },
            {
              label: 'Security',
              href: 'https://github.com/stoic-budget/stoic-budget/security',
            },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Changelog', href: 'https://github.com/stoic-budget/stoic-budget/releases' },
            { label: 'License (MIT)', href: 'https://github.com/stoic-budget/stoic-budget/blob/main/LICENSE' },
          ],
        },
      ],
      copyright: `Copyright (c) ${new Date().getFullYear()} Stoic Budget Contributors`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json'],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  },
};

export default config;
