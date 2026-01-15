# My Money - Expense Management Application

A full-stack expense management application with passkey authentication, calculator UI, transaction management, PDF import, and recurring transactions.

## Features

- **Passkey Authentication**: Secure login using Pocket ID (OIDC) with passkeys
- **Modern Calculator UI**: Calculator with history list, number pad, and operations
- **Transaction Management**: Create, edit, and manage transactions with account balance tracking
- **Account Management**: Multiple accounts with balance tracking and charts
- **PDF Import**: Upload credit card statements and auto-match transactions
- **Recurring Transactions**: Schedule recurring transactions with cron jobs
- **Reports**: Generate reports filtered by account, date, category, and payee
- **PWA Support**: Progressive Web App with offline support and mobile features
- **Theme System**: Automatic dark/light theme based on time (Catppuccin dark / GitHub light)

## Technology Stack

- **Frontend**: React 19 + TypeScript 5.9.3 + Webpack + Apollo Client
- **Backend**: Apollo GraphQL Server + TypeScript 5.9.3 + Node 25.2.1 + Prisma
- **Database**: PostgreSQL v18
- **Authentication**: Pocket ID (OIDC) with passkeys
- **UI Framework**: Material-UI (MUI) with wrapper components
- **Charts**: Recharts
- **Testing**: Jest + React Testing Library (TDD methodology)
- **Package Manager**: npm workspaces
- **Containerization**: Docker Compose

## Prerequisites

- Node.js >= 25.2.1 (use `.nvmrc` file with `nvm use` to ensure correct version)
- npm >= 10.0.0
- Docker and Docker Compose
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

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# OIDC (Pocket ID)
OPENID_CLIENT_ID=your-client-id
OPENID_CLIENT_SECRET=your-client-secret
OPENID_DISCOVERY_URL=http://localhost:8080/.well-known/openid-configuration

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mymoney
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mymoney

# Server
PORT=4000
NODE_ENV=production

# Frontend
REACT_APP_GRAPHQL_URL=http://localhost:4000/graphql
```

### 3. Start services with Docker Compose

```bash
npm run docker:up
```

This will start:
- PostgreSQL database on port 5432
- Backend GraphQL server on port 4000
- Frontend web app on port 3000

### 4. Run database migrations

```bash
docker exec -it my-money-backend npm run prisma:migrate
```

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
docker-compose -f docker/docker-compose.yml --env-file .env up -d postgres
```

**Important:** The `--env-file .env` flag is required when using `-f docker/docker-compose.yml` because docker-compose needs to read the `.env` file from the project root for variable substitution (e.g., `${POSTGRES_USER}`) in the compose file. The docker-compose.yml also has `env_file: - ../.env` which loads variables into the container at runtime.

**If you see warnings about missing environment variables:**

The container may have been created before the .env file was configured. Recreate the container:

```bash
# Stop and remove the container (data is preserved in volume)
docker-compose -f docker/docker-compose.yml --env-file .env down postgres

# Start again with the updated .env file
docker-compose -f docker/docker-compose.yml --env-file .env up -d postgres
```

#### Verify PostgreSQL is Running

**Connect to the database:**
```bash
# Using docker exec (include --env-file to avoid warnings)
docker-compose -f docker/docker-compose.yml --env-file .env exec postgres psql -U postgres -d mymoney

# Or using psql from your host (if installed)
psql postgresql://postgres:postgres@localhost:5432/mymoney
```

**Note:** Even though `docker-compose exec` uses the container's existing environment, it still parses the compose file and tries to substitute variables (like `${POSTGRES_USER}`), so you need to include `--env-file .env` to avoid warnings.

#### Stop PostgreSQL

```bash
# Stop the container
docker-compose -f docker/docker-compose.yml --env-file .env stop postgres
```

**To stop and remove the container (data is preserved in volume):**
```bash
docker-compose -f docker/docker-compose.yml --env-file .env down postgres
```

**To remove container and data volume (⚠️ deletes all data):**
```bash
docker-compose -f docker/docker-compose.yml --env-file .env down -v postgres
```

**Note:** Include `--env-file .env` in all docker-compose commands that use `-f docker/docker-compose.yml` to avoid warnings about missing environment variables.

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

Create `.env` files in root, `frontend/`, and `backend/` directories with appropriate values.

### 4. Run database migrations

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

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
├── frontend/          # React 19 application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/        # MUI wrapper components
│   │   │   ├── calculator/
│   │   │   └── common/
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   ├── graphql/       # GraphQL queries/mutations
│   │   ├── theme/         # Theme configuration
│   │   └── service-worker/ # PWA service worker
│   ├── __tests__/     # Frontend tests
│   └── public/        # Static assets
├── backend/           # Apollo GraphQL server
│   ├── src/
│   │   ├── resolvers/     # GraphQL resolvers
│   │   ├── schema/        # GraphQL schema
│   │   ├── services/       # Business logic services
│   │   ├── utils/         # Utility functions
│   │   ├── middleware/    # Auth middleware
│   │   └── cron/          # Cron jobs
│   ├── __tests__/     # Backend tests
│   └── prisma/        # Prisma schema and migrations
├── shared/            # Shared types and utilities
├── docker/            # Docker configuration
└── README.md          # This file
```

## Available Scripts

### Root level

- `npm run dev` - Start both frontend and backend in development mode (automatically kills processes on ports 3000 and 4000)
- `npm run kill-ports` - Kill processes using ports 3000 and 4000 (or specify custom ports: `tsx scripts/kill-ports.ts 3000 4000`)
- `npm run build` - Build both frontend and backend for production
- `npm run test` - Run all tests
- `npm run lint` - Lint all packages
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:build` - Build Docker images

### Frontend

- `npm run dev` - Start development server
- `npm run build` - Build for production (includes service worker)
- `npm run build:sw` - Build service worker separately
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage

### Backend

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

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

See `.env.example` for all available environment variables.

## Documentation

Additional documentation is available in the `docs/` directory:

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step production deployment instructions
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Monitoring Guide](docs/MONITORING.md)** - Monitoring and alerting setup
- **[Production Readiness Review](PRODUCTION_READINESS_REVIEW.md)** - Pre-production review and checklist

## API Documentation

GraphQL API is available at `/graphql` endpoint. Use GraphQL Playground or any GraphQL client to explore the schema.

### Example Query

```graphql
query GetAccounts {
  accounts {
    id
    name
    balance
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
  }
}
```

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

1. Follow TDD methodology - write tests first
2. Use ESLint and Prettier for code formatting
3. Write JSDoc comments for all functions
4. Follow Google TypeScript style guide

## License

[Add your license here]


