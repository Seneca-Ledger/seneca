# Contributing to Seneca

First off, thank you for considering contributing to Seneca! It's people like you that make Seneca such a great tool.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Style Guides](#style-guides)
  - [Git Commit Messages](#git-commit-messages)
  - [TypeScript Style Guide](#typescript-style-guide)
  - [Documentation Style Guide](#documentation-style-guide)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior through GitHub issues.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Use the bug report template** which includes:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Node version, Docker version, browser
- **Screenshots**: If applicable
- **Logs**: Relevant error messages or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

**Use the feature request template** which includes:

- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: How would you like it to work?
- **Alternatives Considered**: What other solutions did you consider?
- **Additional Context**: Mockups, examples, or other context

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

- **good first issue** - Issues that should only require a few lines of code
- **help wanted** - Issues that are a bit more involved
- **documentation** - Help improve our docs

### Pull Requests

The process described here has several goals:

- Maintain Seneca's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible Seneca
- Enable a sustainable system for maintainers to review contributions

**Before submitting a pull request:**

1. **Fork the repository** and create your branch from `main`
2. **Follow the development setup** instructions below
3. **Make your changes** and ensure they work
4. **Add tests** if you've added code that should be tested
5. **Update documentation** if you've changed APIs or added features
6. **Ensure the test suite passes** (`npm test` at the root runs backend Jest and frontend Vitest)
7. **Make sure your code lints and type-checks** (`npm --prefix backend run lint:check`, `npm --prefix frontend run lint:check`, `npm --prefix backend run typecheck`, `npm --prefix frontend run type-check`)
8. **Format your code** (`make format`)

**Pull Request Guidelines:**

- Use a clear and descriptive title
- Follow the pull request template
- Link related issues (e.g., "Fixes #123")
- Include screenshots/GIFs for UI changes
- Keep PRs focused on a single concern
- Respond to review feedback promptly

## Style Guides

### Git Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `ci`: CI/CD changes

**Examples:**
```bash
feat(statements): add support for CSV import

Add CSV parser for bank statements with column mapping.
Supports custom date formats and automatic column detection.

Closes #45

fix(auth): correct JWT token expiration handling

Previously tokens were not properly validated after expiration.
Now returns 401 and prompts for re-authentication.

Fixes #123

docs(readme): update Docker setup instructions

Add troubleshooting section for common Docker issues.

chore(deps): update dependencies to latest versions
```

**Commit Message Rules:**
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests in the footer
- Separate subject from body with a blank line
- Wrap the body at 72 characters

commitlint checks every message in the `commit-msg` hook. The `pre-push` hook runs the backend unit
tests when `backend/src` changed.

### TypeScript Style Guide

We use Biome to enforce code style (linting, formatting, import sorting):

**Key principles:**
- Use TypeScript strict mode
- Prefer `const` over `let`, avoid `var`
- Use async/await instead of callbacks
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Avoid `any` type, use proper types
- Use interfaces for object shapes
- Export types that are used across modules

**Naming conventions:**
- `camelCase` for variables and functions
- `PascalCase` for classes, interfaces, and types
- `UPPER_SNAKE_CASE` for constants
- Prefix interfaces with `I` only when necessary
- Use descriptive names, avoid abbreviations

**Example:**
```typescript
// Good
export interface CreateUserDto {
  email: string;
  name: string;
  role: UserRole;
}

export class UserService {
  async createUser(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await this.hashPassword(dto.password);
    return this.userRepository.save({ ...dto, password: hashedPassword });
  }
}

// Bad
export interface IUser {
  e: string; // unclear
  n: string; // unclear
}

export class usrSvc { // bad naming
  async crt(d: any): Promise<any> { // avoid any
    return this.repo.save(d);
  }
}
```

**Running linters:**
```bash
# Check for linting errors
npm --prefix backend run lint:check
npm --prefix frontend run lint:check

# Auto-fix linting errors (Biome)
npm --prefix backend run lint:fix
npm --prefix frontend run lint:fix

# Format code explicitly (Biome also formats on lint --write)
npm --prefix backend run format
npm --prefix frontend run format
```

### Documentation Style Guide

- Use Markdown for all documentation
- Include code examples where applicable
- Keep line length under 100 characters
- Use descriptive link text (not "click here")
- Add table of contents for long documents
- Update relevant docs when changing functionality
- Use proper headings hierarchy (h1 → h2 → h3)
- Include both "what" and "why" in explanations

## Development Setup

### Prerequisites

- Node.js 22.18+ and npm
- Docker with Compose v2 (`docker compose`) for local PostgreSQL/Redis
- Git
- PostgreSQL 14+ (optional if you do not use Docker)
- Redis 7+ (optional if you do not use Docker)

### Quick Start (Recommended)

```bash
git clone https://github.com/YOUR_USERNAME/seneca.git
cd seneca
npm run setup:dev:docker   # or: make quick-dev
```

Open http://localhost:3000 and login with `demo@seneca.dev` / `demo123`.

### Local Development (without backend/frontend containers)

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/seneca.git
   cd seneca
   ```

2. **Generate env files and start database services only:**
   ```bash
   npm run setup:env   # writes ignored .env, backend/.env and frontend/.env.local
   make db-start
   ```

3. **Install dependencies:**
   ```bash
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

5. **Create demo user (optional but recommended):**
   ```bash
   make seed-demo
   ```

6. **Access the application:**
    - Frontend: http://localhost:3000
    - Backend API: http://localhost:3001/api/v1
    - API Docs (Swagger): http://localhost:3001/api/docs

`npm run setup:dev:local` does steps 2–5 in one go. The generated env files keep any values you
already set; use `backend/.env.example` (minimal) or `backend/.env.all-options` (full reference)
for local overrides. Swagger is served only outside production.

### Hot Reload in Development

Both backend and frontend support hot reload:

- **Backend**: Uses `nodemon` to watch for changes
- **Frontend**: Next.js Fast Refresh automatically reloads

### Useful Commands

```bash
# Backend
cd backend
npm run start:dev       # Start with hot reload
npm run build           # Build for production
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:cov        # Run tests with coverage
npm run lint:fix        # Lint and fix
npm run lint:check      # Check linting
npm run typecheck       # TypeScript type checking
npm run migration:generate -- src/migrations/MigrationName  # Generate migration
npm run migration:run:dev  # Run migrations (ts-node, no lock)
npm run migration:run   # Run migrations the production way (build + lock)
npm run migration:revert  # Revert last migration

# Frontend
cd frontend
npm run dev             # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint:check      # Biome
npm run type-check      # TypeScript type checking
npm test                # Vitest

# Docker
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose logs -f            # View logs
docker compose logs -f backend    # View backend logs
docker compose restart backend    # Restart backend
docker exec -it finflow-backend sh  # Shell into backend
```

## Testing

The backend uses Jest; the frontend uses Vitest.

### Running Tests

```bash
# Backend tests
cd backend
npm test                # Run all tests
npm run test:watch      # Run in watch mode
npm run test:cov        # With coverage
npm run test:e2e        # Run e2e tests (needs PostgreSQL and Redis)
npm run test:golden     # Parser golden tests

# Frontend tests
cd frontend
npm test
```

### Writing Tests

**Backend example:**
```typescript
describe('UserService', () => {
  let service: UserService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserService],
    }).compile();
    
    service = module.get<UserService>(UserService);
  });
  
  it('should create a user', async () => {
    const dto: CreateUserDto = {
      email: 'test@example.com',
      name: 'Test User',
    };
    
    const result = await service.create(dto);
    
    expect(result.email).toBe(dto.email);
  });
});
```

**Frontend example:**
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Test Coverage

There is no project-wide coverage target yet — cover the code you change. The backend Jest config
enforces only a low global floor.

View the backend coverage report:
```bash
npm --prefix backend run test:cov
# Open backend/coverage/lcov-report/index.html
```

## Project Structure

```
seneca/
├── backend/                    # NestJS backend
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/         # Authentication
│   │   │   ├── users/        # User management
│   │   │   ├── statements/   # Statement processing
│   │   │   └── ...
│   │   ├── entities/         # TypeORM entities
│   │   ├── common/           # Shared utilities
│   │   ├── config/           # Configuration
│   │   ├── migrations/       # Database migrations
│   │   └── main.ts           # Entry point
│   └── @tests/               # Unit, integration and e2e tests
│
├── frontend/                  # Next.js frontend
│   ├── app/                  # App Router pages
│   │   ├── (auth)/          # Auth pages
│   │   ├── (main)/          # Signed-in app routes
│   │   ├── admin/           # Admin dashboard
│   │   ├── components/      # Shared components
│   │   ├── lib/             # API client, CSRF helper, utilities
│   │   ├── styles/          # Global SCSS
│   │   └── ...
│   └── public/              # Static assets
│
├── docs/                     # Plans, CI and security notes
├── website/                  # Docusaurus documentation site
└── scripts/                  # Helper scripts
```

### Key Directories

- **`backend/src/modules/`**: Each feature is a self-contained module
- **`backend/src/entities/`**: Database models (TypeORM)
- **`backend/src/common/`**: Shared decorators, guards, pipes
- **`frontend/app/`**: Next.js App Router structure
- **`frontend/app/components/`**: Reusable React components

### Adding a New Feature

1. **Backend:**
   ```bash
   cd backend/src/modules
   mkdir my-feature
   cd my-feature
   # Create: my-feature.module.ts, my-feature.service.ts, my-feature.controller.ts
   ```

2. **Frontend:**
   ```bash
   cd frontend/app
   mkdir my-feature
   # Create page.tsx, components/
   ```

3. **Add tests:**
   - Backend: `backend/@tests/unit/.../my-feature.service.spec.ts`
   - Frontend: `MyFeature.test.tsx` next to the component

4. **Update documentation:**
   - Add to relevant pages in `website/docs/`
   - Update API docs if adding endpoints

## Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Use the bug report template
- **Feature requests**: Use the feature request template
- **Security issues**: See [SECURITY.md](SECURITY.md)

## Recognition

Contributors are recognized in:
- Release notes
- GitHub contributors page
- Special mentions for significant contributions

Thank you for contributing to Seneca! 🎉
