# Tours System

Interactive tours system for Seneca based on Driver.js with three-language support via Intlayer.

## Structure

```
frontend/app/tours/
├── types.ts                      # TypeScript types and interfaces
├── TourManager.ts               # Tour manager with navigation and state persistence
├── tour-theme.css               # Custom styles for Driver.js
├── index.ts                     # Export all tours
├── statements-tour.ts           # Statements page tour
├── statements-tour.content.ts   # Translations for statements tour
├── upload-tour.ts               # File upload tour
├── upload-tour.content.ts       # Translations for upload tour
├── storage-tour.ts              # File storage tour
├── storage-tour.content.ts      # Translations for storage tour
├── custom-tables-tour.ts        # Custom tables tour
├── custom-tables-tour.content.ts # Translations for tables tour
├── reports-tour.ts              # Reports tour
├── reports-tour.content.ts      # Translations for reports tour
├── categories-tour.ts           # Categories tour
├── categories-tour.content.ts   # Translations for categories tour
├── data-entry-tour.ts           # Data entry tour
├── data-entry-tour.content.ts   # Translations for data entry tour
├── integrations-tour.ts         # Integrations tour
├── integrations-tour.content.ts # Translations for integrations tour
├── settings-tour.ts             # Settings tour
├── settings-tour.content.ts     # Translations for settings tour
└── components/
    ├── TourButton.tsx           # Button to start the tour
    ├── TourProgress.tsx         # Progress indicator
    └── TourMenu.tsx             # Tour selection menu
```

## Implemented Tours

### ✅ Statements Tour
- Page: `/statements`
- Steps: welcome, upload button, search, filters, table, statuses, actions, pagination

### ✅ Upload Tour
- Page: `/upload`
- Steps: welcome, drag-drop zone, file list, duplicates, upload button

### ✅ Storage Tour
- Page: `/storage`
- Steps: welcome, search, filters, file table, actions, categories, access rights

### ✅ Custom Tables Tour
- Page: `/custom-tables`
- Steps: welcome, table creation, table list, search

### ✅ Reports Tour
- Page: `/reports`
- Steps: welcome, period selection, income/expense chart, category breakdown, bank comparison, export, filters

### ✅ Categories Tour
- Page: `/categories`
- Steps: welcome, category creation, list, color selection, icon selection

### ✅ Data Entry Tour
- Page: `/data-entry`
- Steps: welcome, statements filter, transactions table, editing, categories, bulk actions

### ✅ Integrations Tour
- Page: `/integrations`
- Steps: welcome, API keys, webhooks, connection status

### ✅ Settings Tour
- Page: `/settings`
- Steps: welcome, profile, workspace, team, security, notifications

## Usage

### 1. Registering a Tour

```typescript
import { useRegisterTours } from '@/app/hooks/useTour';
import { getStatementsTour } from '@/app/tours';

function App() {
  const statementsTour = getStatementsTour();
  
  useRegisterTours([statementsTour]);
  
  return <div>...</div>;
}
```

### 2. Starting a Tour

```typescript
import { useTour } from '@/app/hooks/useTour';

function MyPage() {
  const { startTour, isActive, isCompleted } = useTour('statements-tour');
  
  return (
    <button onClick={() => startTour()}>
      {isCompleted ? 'Repeat tour' : 'Start tour'}
    </button>
  );
}
```

### 3. Using Pre-built Components

```typescript
import { TourButton, TourMenu } from '@/app/tours';

function Header() {
  return (
    <>
      <TourButton tourId="statements-tour" />
      <TourMenu />
    </>
  );
}
```

### 4. Marking Elements

Add the `data-tour-id` attribute to elements that should be part of the tour:

```tsx
<button data-tour-id="upload-button">
  Upload statement
</button>

<div data-tour-id="statements-table">
  <Table />
</div>

<input data-tour-id="search-bar" />
```

## Creating a New Tour

### Step 1: Content File

Create a file with translations (e.g., `my-tour.content.ts`):

```typescript
import { t, type Dictionary } from 'intlayer';

const content = {
  key: 'my-tour',
  content: {
    name: t({
      ru: 'Мой тур',
      en: 'My Tour',
      kk: 'Менің турым',
    }),
    description: t({
      ru: 'Описание тура',
      en: 'Tour description',
      kk: 'Тур сипаттамасы',
    }),
    steps: {
      welcome: {
        title: t({
          ru: 'Добро пожаловать!',
          en: 'Welcome!',
          kk: 'Қош келдіңіз!',
        }),
        description: t({
          ru: 'Описание шага',
          en: 'Step description',
          kk: 'Қадам сипаттамасы',
        }),
      },
      // Other steps...
    },
  },
} satisfies Dictionary;

export default content;
```

### Step 2: Tour

Create a file with the tour configuration (e.g., `my-tour.ts`):

```typescript
import { useIntlayer } from 'next-intlayer';
import type { TourConfig } from './types';

export function getMyTour(): TourConfig {
  const { steps } = useIntlayer('my-tour');

  return {
    id: 'my-tour',
    name: 'My Tour',
    description: 'Tour description',
    page: '/my-page',
    steps: [
      {
        selector: 'body',
        title: steps.welcome.title.value,
        description: steps.welcome.description.value,
        side: 'center' as any,
      },
      {
        selector: '[data-tour-id="element-1"]',
        title: steps.step1.title.value,
        description: steps.step1.description.value,
        side: 'bottom',
        align: 'start',
      },
      // Other steps...
    ],
  };
}
```

### Step 3: Export

Add the export to `index.ts`:

```typescript
export * from './my-tour';
```

### Step 4: Usage

```typescript
import { getMyTour } from '@/app/tours';

const myTour = getMyTour();
tourManager.registerTour(myTour);
```

## API

### TourManager

```typescript
const tourManager = getTourManager({
  onNavigate: async (url: string) => {
    router.push(url);
  },
});

// Register tours
tourManager.registerTour(tour);
tourManager.registerTours([tour1, tour2]);

// Launch
tourManager.startTour('tour-id');
tourManager.resumeTour();
tourManager.stopTour();

// Control
tourManager.nextStep();
tourManager.previousStep();

// Checks
tourManager.isActive();
tourManager.isTourCompleted('tour-id');
tourManager.getActiveStepIndex();

// Reset
tourManager.resetTour('tour-id');
tourManager.clearAllData();
```

### useTour Hook

```typescript
const {
  startTour,      // (tourId?: string) => void
  resumeTour,     // () => boolean
  stopTour,       // () => void
  nextStep,       // () => void
  previousStep,   // () => void
  resetTour,      // (tourId?: string) => void
  isActive,       // boolean
  currentStep,    // number | null
  isCompleted,    // boolean
  tourManager,    // TourManager
} = useTour('tour-id');
```

### useAutoTour Hook

Automatic tour start for new users:

```typescript
useAutoTour('welcome-tour', {
  condition: !user.hasSeenTour,
  delay: 1000, // ms
});
```

## Step Configuration

```typescript
interface TourStep {
  selector: string;           // CSS selector
  title: string;             // Title
  description: string;       // Description
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  highlight?: boolean;
  nextButton?: string;
  prevButton?: string;
  showButtons?: boolean | string[];
  onNext?: () => void | Promise<void>;
  onPrev?: () => void | Promise<void>;
  onDestroy?: () => void;
}
```

## Styling

Styles are located in `tour-theme.css` and automatically connected in `globals.css`.

Customization via CSS variables:

```css
:root {
  --primary: #0a66c2;
  --card: #ffffff;
  --card-foreground: #191919;
  --border: #e0e0e0;
  /* etc. */
}
```

## Tour Examples

### Simple Tour

```typescript
{
  id: 'simple-tour',
  name: 'Simple Tour',
  description: 'Basic page tour',
  page: '/page',
  steps: [
    {
      selector: '[data-tour-id="button"]',
      title: 'This is a button',
      description: 'Click it for action',
      side: 'bottom',
    },
  ],
}
```

### Tour with Navigation

```typescript
{
  id: 'multi-page-tour',
  name: 'Multi-page Tour',
  description: 'Tour transitions between pages',
  canNavigate: true,
  steps: [
    {
      selector: '[data-tour-id="link"]',
      title: 'Transition',
      description: 'Now we will transition to another page',
      onNext: async () => {
        await navigateTo('/another-page');
      },
    },
  ],
}
```

### Conditional Tour

```typescript
{
  id: 'conditional-tour',
  name: 'Conditional Tour',
  description: 'Shown only to admins',
  requiredRole: 'admin',
  autoStart: true,
  steps: [...],
}
```

## Best Practices

### 1. Tour length
- **Page tour**: 8-15 steps
- **Full tour**: Split into parts

### 2. Texts
- Title: 3-7 words
- Description: 1-3 sentences
- Avoid jargon

### 3. Selectors
- Use `data-tour-id` instead of classes
- Ensure unique selectors
- Check element visibility

### 4. Performance
- Lazy loading tours
- Check element visibility
- Debounce for interactive elements

### 5. Accessibility
- Keyboard support (Enter, Esc, arrows)
- ARIA attributes
- Screen reader friendly

## Testing

```typescript
// Unit test
describe('TourManager', () => {
  it('should start tour', () => {
    const manager = getTourManager();
    manager.registerTour(testTour);
    manager.startTour('test-tour');
    expect(manager.isActive()).toBe(true);
  });
});

// E2E test
describe('Statements Tour', () => {
  it('should complete tour', () => {
    cy.visit('/statements');
    cy.get('[data-tour-id="upload-button"]').should('be.visible');
    // ... step-through
  });
});
```

## Analytics

The system automatically sends events:

- `tour_started` - Tour started
- `tour_step_viewed` - Step viewed
- `tour_step_skipped` - Step skipped
- `tour_completed` - Tour completed
- `tour_abandoned` - Tour interrupted
- `tour_resumed` - Tour resumed

## Troubleshooting

### Element not found

```typescript
// Check selector
document.querySelector('[data-tour-id="my-element"]')

// Ensure element is visible
getComputedStyle(element).display !== 'none'
```

### Tour not saved

```typescript
// Check localStorage
localStorage.getItem('seneca_tour_state')

// Clear data
tourManager.clearAllData()
```

### Navigation not working

```typescript
// Ensure onNavigate is passed
const tourManager = getTourManager({
  onNavigate: async (url) => {
    await router.push(url);
  },
});
```

## TODO

- [ ] Implement tours for other pages
- [ ] Add a full tour of the entire application
- [ ] Implement contextual tours
- [ ] Add A/B testing
- [ ] Integrate with analytics system
- [ ] Add video instructions
- [ ] Create an admin panel for tour management

## Useful Links

- [Driver.js Documentation](https://driverjs.com/)
- [Intlayer Documentation](https://intlayer.org/)
- [Plan document](../../docs/comprehensive-tour-plan.md)
