# My Money - Transaction Management Application

A full-stack transaction management application with passkey authentication, calculator UI, transaction management, multi-user workspaces, budgets, and advanced collaboration features.

## Features

### Core Features

- **Passkey Authentication**: Secure login using Pocket ID (OIDC) with passkeys
- **Modern Calculator UI**: Calculator with history list, number pad, and operations
- **Transaction Management**: Create, edit, and manage transactions with account balance tracking
- **Account Management**: Multiple accounts with balance tracking and charts
- **Category & Payee Management**: Organize transactions with categories and payees
- **Reports**: Generate comprehensive reports filtered by account, date, category, payee, and workspace members
- **PWA Support**: Progressive Web App with offline support and mobile features
- **Theme System**: Automatic dark/light theme based on time (Catppuccin dark / GitHub light)

### Collaboration & Workspaces

- **Multi-User Workspaces**: Create and manage workspaces for team collaboration
- **Role-Based Access Control**: Owner, Admin, and Member roles with appropriate permissions
- **Workspace Invitations**: Invite users via email with role assignment
- **Real-Time Updates**: GraphQL subscriptions for live updates across all entities
- **Conflict Resolution**: Automatic conflict detection and resolution for concurrent edits
- **Version History**: Track entity changes with full version history

### Budget Management

- **Budget Tracking**: Set budgets for accounts, categories, or payees
- **Budget Notifications**: Get notified when budgets approach or exceed limits
- **Automatic Budget Reset**: Scheduled budget resets with configurable periods
- **Budget Analytics**: Track spending against budgets with visual indicators

### Import & Export

- **PDF Import**: Upload credit card statements and auto-match transactions
- **CSV Import**: Import accounts, categories, payees, and transactions from CSV files
- **Auto-Matching**: Intelligent transaction matching with import match rules
- **Data Export**: Export all data (accounts, transactions, budgets, etc.) for backup or migration
- **Import Match Rules**: Create rules to automatically match imported transactions

### Automation

- **Recurring Transactions**: Schedule recurring transactions with cron expressions
- **Automatic Balance Reconciliation**: Scheduled balance checks and corrections
- **Data Archival**: Automatic archival of old transactions
- **Scheduled Backups**: Automated database backups

### Advanced Features

- **Batch Operations**: Bulk create/update accounts, categories, payees, and transactions
- **Smart Suggestions**: AI-powered suggestions for account, category, and payee based on transaction amount
- **Transaction Search**: Full-text search across transaction notes
- **Cursor-Based Pagination**: Efficient pagination for large transaction lists
- **Query Caching**: Intelligent caching for improved performance
- **Rate Limiting**: Protection against abuse with configurable rate limits

## Technology Stack

### Frontend

- **Framework**: React 19 + TypeScript 5.9.3
- **Build Tool**: Webpack 5
- **GraphQL Client**: Apollo Client 4 with subscriptions support
- **Routing**: React Router 7
- **UI Framework**: Material-UI (MUI) v7 with custom wrapper components
- **Charts**: Recharts 2
- **Form Handling**: React Hook Form + Zod validation
- **State Management**: Apollo Client cache + React Context
- **PWA**: Service Worker with offline support

### Backend

- **HTTP Framework**: Hono 4 (lightweight, fast web framework)
- **GraphQL Server**: Apollo Server 4 integrated with Hono
- **Runtime**: Node.js 25.2.1 with ESM modules
- **Language**: TypeScript 5.9.3
- **Database ORM**: Prisma 7 with PostgreSQL adapter
- **Database**: PostgreSQL 18
- **Authentication**: Pocket ID (OIDC) with passkeys via openid-client
- **Real-Time**: GraphQL Subscriptions with WebSocket (graphql-ws)
- **File Processing**: PDF.js for PDF parsing, Busboy for multipart uploads
- **Scheduling**: node-cron for recurring tasks
- **Security**: Helmet, CORS, rate limiting, CSRF protection

### Infrastructure

- **Package Manager**: npm workspaces (monorepo)
- **Containerization**: Docker Compose
- **Testing**: Jest + React Testing Library (TDD methodology)
- **Code Quality**: ESLint (Google style guide) + Prettier

## Prerequisites

- Node.js >= 25.2.1 (use `.nvmrc` file with `nvm use` to ensure correct version)
- npm >= 10.0.0
- Docker and Docker Compose (v2: `docker compose` CLI)
- PostgreSQL 18 (or use Docker)

### Node Version Management

This project uses `.nvmrc` to ensure consistent Node.js versions. If you're using nvm:

```bash
nvm use
```

This will automatically switch to Node.js 25.2.1 as specified in `.nvmrc`.

## Quick Start with Docker

### 1. Clone the repository

```bash
git clone <repository-url>
cd my-money
```

### 2. Configure environment variables

Create `.env` files. For Docker you need the root `.env`; for local development create `.env` in root, `backend/`, and `frontend/`:

```bash
# Root (required for Docker Compose)
cp .env.example .env

# Backend and frontend (required when running apps without Docker)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit each `.env` with your configuration (see `.env.example` in each directory for variables).

### 3. Start services with Docker Compose

```bash
npm run docker:up
```

This will start:

- PostgreSQL database on port 5432
- Backend GraphQL server on port 4000
- Frontend web app on port 3000

### 4. Set up database schema

The application uses a hybrid approach:

- **Automatic schema sync** (via `prisma db push`) runs on startup when `RUN_MIGRATIONS=true` or in production
- **Manual migrations** are used for data migrations and production deployments

**For Docker setup:**

The schema will automatically sync when the backend starts (if `RUN_MIGRATIONS=true` or `NODE_ENV=production`).

**To manually run migrations instead:**

```bash
docker exec -it my-money-backend npm run prisma:migrate
```

**Note:** If you see migration drift errors, see the [Migration Guide](backend/prisma/MIGRATION_GUIDE.md) for resolution steps.

### 5. Access the application

- Frontend: http://localhost:3000
- Backend GraphQL: http://localhost:4000/graphql

## Development Setup (Without Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Setup PostgreSQL

The project includes a Docker Compose configuration for PostgreSQL. This is the recommended approach for local development.

#### Configure Environment Variables

First, ensure your `.env` file in the project root has the PostgreSQL configuration:

```env
# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mymoney

# Database Connection URL
# For local development (connecting from host machine):
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mymoney
# For Docker containers (connecting from backend service):
# DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mymoney
```

#### Start PostgreSQL with Docker Compose

Start only the PostgreSQL service:

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d postgres
```

**Important:** The `--env-file .env` flag is required when using `-f docker/docker-compose.yml` because Docker Compose needs to read the `.env` file from the project root for variable substitution (e.g., `${POSTGRES_USER}`) in the compose file. The docker-compose.yml also has `env_file: - ../.env` which loads variables into the container at runtime.

**If you see warnings about missing environment variables:**

The container may have been created before the .env file was configured. Recreate the container:

```bash
# Stop and remove the container (data is preserved in volume)
docker compose -f docker/docker-compose.yml --env-file .env down postgres

# Start again with the updated .env file
docker compose -f docker/docker-compose.yml --env-file .env up -d postgres
```

#### Verify PostgreSQL is Running

**Connect to the database:**

```bash
# Using docker exec (include --env-file to avoid warnings)
docker compose -f docker/docker-compose.yml --env-file .env exec postgres psql -U postgres -d mymoney

# Or using psql from your host (if installed)
psql postgresql://postgres:postgres@localhost:5432/mymoney
```

**Note:** Even though `docker-compose exec` uses the container's existing environment, it still parses the compose file and tries to substitute variables (like `${POSTGRES_USER}`), so you need to include `--env-file .env` to avoid warnings.

#### Stop PostgreSQL

```bash
# Stop the container
docker compose -f docker/docker-compose.yml --env-file .env stop postgres
```

**To stop and remove the container (data is preserved in volume):**

```bash
docker compose -f docker/docker-compose.yml --env-file .env down postgres
```

**To remove container and data volume (⚠️ deletes all data):**

```bash
docker compose -f docker/docker-compose.yml --env-file .env down -v postgres
```

**Note:** Include `--env-file .env` in all `docker compose` commands that use `-f docker/docker-compose.yml` to avoid warnings about missing environment variables.

#### Alternative: Local PostgreSQL Installation

If you prefer to install PostgreSQL locally instead of using Docker:

**macOS (using Homebrew):**

```bash
brew install postgresql@18
brew services start postgresql@18
createdb -U postgres mymoney
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install postgresql-18 postgresql-contrib-18
sudo systemctl start postgresql
createdb -U postgres mymoney
```

**Windows:**
Download from [PostgreSQL official website](https://www.postgresql.org/download/windows/) or use Chocolatey:

```bash
choco install postgresql18
createdb -U postgres mymoney
```

Then update your `DATABASE_URL` in `.env` to point to your local PostgreSQL instance.

### 3. Configure environment variables

Create `.env` in the project root, `backend/`, and `frontend/` so each app has its own config when run directly:

```bash
# From project root
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit each file with your values. Keep these in sync where they overlap:

- **Root & backend:** `DATABASE_URL`, `OPENID_*`, `CORS_ORIGIN`, `BACKEND_URL`, `FRONTEND_URL`
- **Root & frontend:** `REACT_APP_GRAPHQL_URL`, `REACT_APP_OPENID_*`
- **Backend & frontend:** OIDC client ID and discovery URL must match

Example for local development: in `backend/.env` set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mymoney` (host `localhost` when DB runs in Docker); in `frontend/.env` set `REACT_APP_GRAPHQL_URL=http://localhost:4000/graphql`.

### 4. Set up database schema

The application uses a hybrid approach:

- **Automatic schema sync** (via `prisma db push`) runs on startup when `RUN_MIGRATIONS=true` or in production
- **Manual migrations** are used for data migrations and production deployments

**For first-time setup:**

```bash
cd backend
npm run prisma:generate

# Option 1: Use automatic schema sync (recommended for development)
# Set RUN_MIGRATIONS=true in .env or let it run automatically in production
# The schema will sync on application startup

# Option 2: Use manual migrations (recommended for production)
npm run prisma:migrate
```

**Note:** If you see migration drift errors, see the [Migration Guide](backend/prisma/MIGRATION_GUIDE.md) for resolution steps.

### 5. Start development servers

In separate terminals:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Project Structure

```
my-money/
├── frontend/              # React 19 application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/        # MUI wrapper components
│   │   │   ├── calculator/ # Calculator components
│   │   │   ├── report/    # Report components
│   │   │   ├── budget/    # Budget components
│   │   │   ├── import/    # Import components
│   │   │   └── common/    # Shared components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   ├── graphql/       # GraphQL operations
│   │   │   ├── queries.ts
│   │   │   ├── mutations.ts
│   │   │   ├── subscriptions.ts
│   │   │   └── workspaceOperations.ts
│   │   ├── contexts/      # React contexts
│   │   ├── theme/         # Theme configuration
│   │   ├── service-worker/ # PWA service worker
│   │   └── docs/          # Frontend documentation
│   ├── __tests__/         # Frontend tests
│   └── public/            # Static assets
├── backend/               # Hono + Apollo GraphQL server
│   ├── src/
│   │   ├── resolvers/     # GraphQL resolvers
│   │   │   ├── transaction/ # Transaction resolvers
│   │   │   └── ...
│   │   ├── schema/        # GraphQL schema
│   │   ├── services/      # Business logic services
│   │   ├── repositories/  # Data access layer
│   │   ├── commands/      # Command pattern implementations
│   │   ├── queries/       # Query pattern implementations
│   │   ├── events/        # Event system
│   │   ├── jobs/          # Job queue
│   │   ├── routes/        # HTTP routes (auth, health)
│   │   ├── config/        # Configuration (Apollo, security, etc.)
│   │   ├── middleware/    # Auth, validation, caching middleware
│   │   ├── utils/         # Utility functions
│   │   ├── cron/          # Scheduled jobs
│   │   ├── recurringTransactions.ts
│   │   │   ├── budgetReset.ts
│   │   │   ├── balanceReconciliation.ts
│   │   │   ├── backup.ts
│   │   │   └── dataArchival.ts
│   │   └── docs/          # Backend documentation
│   ├── __tests__/         # Backend tests
│   └── prisma/            # Prisma schema and migrations
├── shared/                # Shared types and utilities
│   └── src/
│       ├── types/         # Shared TypeScript types
│       └── utils/         # Shared utility functions
├── docker/                # Docker configuration
│   ├── docker-compose.yml
│   └── ...
├── scripts/               # Utility scripts
│   ├── kill-ports.ts
│   ├── docker-prepare-images.sh
│   └── docker-prune.sh
├── docs/                  # Documentation
│   ├── DEPLOYMENT.md
│   ├── MONITORING.md
│   └── TROUBLESHOOTING.md
└── README.md              # This file
```

## Available Scripts

### Root Level

- `npm run dev` - Start both frontend and backend in development mode (automatically kills processes on ports 3000 and 4000)
- `npm run kill-ports` - Kill processes using ports 3000 and 4000 (or specify custom ports: `tsx scripts/kill-ports.ts 3000 4000`)
- `npm run build` - Build both frontend and backend for production
- `npm run test` - Run all tests across all workspaces
- `npm run test:frontend` - Run frontend tests only
- `npm run test:backend` - Run backend tests only
- `npm run test:coverage` - Generate test coverage reports
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Fix linting issues automatically
- `npm run type-check` - Type check all packages
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run validate` - Run lint, type-check, and format check
- `npm run clean` - Remove build artifacts and caches
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:build` - Build Docker images
- `npm run docker:logs` - View Docker logs
- `npm run docker:clean` - Stop and remove Docker containers and volumes
- `npm run docker:prune` - Remove unused Docker resources (containers, images, networks, volumes, build cache)

### Frontend

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (includes service worker)
- `npm run build:sw` - Build service worker separately
- `npm run build:analyze` - Analyze bundle size
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage
- `npm run type-check` - Type check TypeScript files
- `npm run lint` - Lint source files
- `npm run lint:fix` - Fix linting issues

### Backend

- `npm run dev` - Start development server with hot reload (Node.js --watch)
- `npm run build` - Build for production (TypeScript compilation)
- `npm run start` - Start production server
- `npm run start:prod` - Start production server with NODE_ENV=production
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage
- `npm run type-check` - Type check TypeScript files
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations (development)
- `npm run prisma:deploy` - Deploy migrations (production)
- `npm run prisma:reset` - Reset database (⚠️ deletes all data)
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run backup` - Create database backup

## Testing

The project uses Test-Driven Development (TDD) methodology. Tests are written first, then implementation follows.

### Running Tests

```bash
# All tests
npm run test

# Frontend only
npm run test:frontend

# Backend only
npm run test:backend

# With coverage
npm run test:coverage
```

## Environment Variables

See `.env.example` (root), `backend/.env.example`, and `frontend/.env.example` for all available variables. Create `.env` in each of those directories when running backend or frontend outside Docker (see [Configure environment variables](#2-configure-environment-variables) for examples).

## Documentation

Additional documentation is available in the `docs/` directory:

- **[User Guide](docs/USAGE.md)** - Complete user guide with instructions for using the application UI, managing accounts, categories, payees, budgets, and more
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step production deployment instructions
- **[Monitoring Guide](docs/MONITORING.md)** - Monitoring and alerting setup
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Key Concepts

- **Workspaces**: Multi-user collaboration with role-based access control
- **Version Control**: Optimistic locking with version numbers to prevent conflicts
- **Conflict Resolution**: Automatic detection and manual resolution of concurrent edits
- **Real-Time Updates**: GraphQL subscriptions for live collaboration
- **Batch Operations**: Efficient bulk operations for data import/export
- **Import Matching**: Intelligent auto-matching of imported transactions using rules

## API Documentation

GraphQL API is available at `/graphql` endpoint. The API supports:

- **Queries**: Read data (accounts, transactions, budgets, workspaces, etc.)
- **Mutations**: Modify data (create, update, delete operations)
- **Subscriptions**: Real-time updates via WebSocket
- **File Uploads**: Multipart file uploads for PDF/CSV imports

### Example Query

```graphql
query GetAccounts {
  accounts {
    id
    name
    balance
    accountType
    workspaceId
  }
}
```

### Example Mutation

```graphql
mutation CreateTransaction($input: CreateTransactionInput!) {
  createTransaction(input: $input) {
    id
    value
    date
    account {
      id
      name
    }
    category {
      id
      name
    }
  }
}
```

### Example Subscription

```graphql
subscription OnTransactionUpdated($workspaceId: ID!) {
  transactionUpdated(workspaceId: $workspaceId) {
    id
    value
    date
    account {
      name
    }
  }
}
```

### Batch Operations

The API supports batch operations for efficient bulk updates:

```graphql
mutation BulkCreateTransactions($inputs: [BatchCreateTransactionInput!]!) {
  bulkCreateTransactions(inputs: $inputs) {
    created {
      id
      value
    }
    errors {
      index
      message
    }
  }
}
```

For complete API documentation, explore the GraphQL schema using GraphQL Playground or any GraphQL client.

## Deployment

### Production Build

```bash
npm run build
```

### Docker Production

```bash
npm run docker:build
npm run docker:up
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Verify database exists and user has permissions

### Migration Issues

**Migration drift errors:**

- Common causes: Database created with `db push` but migrations exist, or empty migration directories
- Solution: Use `prisma migrate reset` to reset database, or manually resolve drift

**P3015 Error (Missing migration file):**

- Check for empty migration directories: `ls -la backend/prisma/migrations/`
- Remove empty directories and re-run migration

**Migration fails because tables don't exist:**

- Ensure base schema is applied before data migrations
- Run migrations in order: `npm run prisma:migrate`

### OIDC Authentication Issues

- Verify Pocket ID is running and accessible
- Check `OPENID_DISCOVERY_URL` is correct
- Ensure `OPENID_CLIENT_ID` and `OPENID_CLIENT_SECRET` are set

### Port Conflicts

- The `npm run dev` command automatically kills processes on ports 3000 and 4000 before starting
- To manually kill ports: `npm run kill-ports` or `tsx scripts/kill-ports.ts [port1] [port2] ...`
- Change ports in `docker-compose.yml` if needed
- Update `REACT_APP_GRAPHQL_URL` if backend port changes

## Contributing

1. **Follow TDD methodology** - Write tests first, then implementation
2. **Code Quality** - Use ESLint and Prettier for code formatting
3. **Documentation** - Write JSDoc comments for all functions and classes
4. **Style Guide** - Follow Google TypeScript style guide
5. **Principles** - Follow SRP, KISS, DRY, and functional programming principles
6. **Security** - Keep security in mind, validate and sanitize all inputs
7. **Performance** - Optimize for performance, use caching where appropriate

## Architecture Highlights

- **Monorepo Structure**: npm workspaces for shared code and dependencies
- **Type Safety**: Full TypeScript coverage across frontend and backend
- **GraphQL-First**: Single API endpoint with type-safe queries and mutations
- **Real-Time Collaboration**: WebSocket subscriptions for live updates
- **Optimistic Concurrency**: Version-based conflict detection and resolution
- **Repository Pattern**: Clean separation of data access and business logic
- **Command/Query Separation**: CQRS-inspired patterns for complex operations
- **Event-Driven**: Event system for decoupled components
- **Security-First**: Rate limiting, CSRF protection, input sanitization, SQL injection prevention

## License

[Add your license here]
