/**
 * Statements page tour
 */

import type { TourConfig } from './types';

type TextNode = { value: string };

type StatementsSteps = {
  welcome: { title: TextNode; description: TextNode };
  uploadTrigger?: { title: TextNode; description: TextNode };
  uploadButton?: { title: TextNode; description: TextNode };
  searchBar: { title: TextNode; description: TextNode };
  filters?: { title: TextNode; description: TextNode };
  statusFilter?: { title: TextNode; description: TextNode };
  statementsList?: { title: TextNode; description: TextNode };
  statementsTable?: { title: TextNode; description: TextNode };
  statementRow?: { title: TextNode; description: TextNode };
  viewDetails?: { title: TextNode; description: TextNode };
  completed: { title: TextNode; description: TextNode };
};

/**
 * Creates tour configuration for the statements page
 * @param texts - Object with translations from useIntlayer
 */
export function createStatementsTour(texts: {
  name: TextNode;
  description: TextNode;
  steps: StatementsSteps;
  content?: {
    name: TextNode;
    description: TextNode;
    steps: StatementsSteps;
  };
}): TourConfig {
  const resolvedTexts = texts.content ?? texts;
  const { steps } = resolvedTexts;
  const uploadStep = steps.uploadTrigger ?? steps.uploadButton;
  const filtersStep = steps.filters ?? steps.statusFilter;
  const statementsListStep = steps.statementsList ?? steps.statementsTable;
  const statementRowStep = steps.statementRow ?? steps.viewDetails;

  return {
    id: 'statements-tour',
    name: resolvedTexts.name?.value ?? 'Statements Tour',
    description:
      resolvedTexts.description?.value ?? 'Learn how to upload and manage bank statements',
    page: '/statements/submit',
    steps: [
      {
        selector: 'body',
        title: steps.welcome.title.value,
        description: steps.welcome.description.value,
        side: 'bottom',
        align: 'center',
      },
      {
        selector: '[data-tour-id="statements-upload-trigger"]',
        title: uploadStep?.title.value ?? 'Upload and Scan',
        description:
          uploadStep?.description.value ??
          'Opens the receipt scanner straight away: drop in a file or a photo, or switch to manual entry in the same panel.',
        // The trigger moved from the sidebar's foot into the page header.
        side: 'bottom',
        align: 'end',
      },
      {
        selector: '[data-tour-id="statements-filters"]',
        optional: true,
        title: filtersStep?.title.value ?? 'Filters',
        description:
          filtersStep?.description.value ??
          'Use filters to narrow the list down to the documents you need.',
        side: 'bottom',
      },
      {
        selector: '[data-tour-id="statements-table"]',
        title: statementsListStep?.title.value ?? 'Statements List',
        description:
          statementsListStep?.description.value ??
          'Review uploaded statements, their details, and available actions from the main list.',
        side: 'top',
      },
      {
        selector: '[data-tour-id="statement-row-primary"]',
        optional: true,
        title: statementRowStep?.title.value ?? 'Statement Row',
        description:
          statementRowStep?.description.value ??
          'Open a statement row to inspect document details before moving to the next step.',
        side: 'left',
      },
      {
        selector: 'body',
        title: steps.completed.title.value,
        description: steps.completed.description.value,
        side: 'bottom',
        align: 'center',
      },
    ],
  };
}
