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
- Pocket ID (OIDC provider) on port 8080
- Backend GraphQL server on port 4000
- Frontend web app on port 3000

### 4. Run database migrations

```bash
docker exec -it my-money-backend npm run prisma:migrate
```

### 5. Access the application

- Frontend: http://localhost:3000
- Backend GraphQL: http://localhost:4000/graphql
- Pocket ID: http://localhost:8080

## Development Setup (Without Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Setup PostgreSQL

Make sure PostgreSQL 18 is running locally and create a database:

```sql
CREATE DATABASE mymoney;
```

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

- `npm run dev` - Start both frontend and backend in development mode
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

- Change ports in `docker-compose.yml` if needed
- Update `REACT_APP_GRAPHQL_URL` if backend port changes

## Contributing

1. Follow TDD methodology - write tests first
2. Use ESLint and Prettier for code formatting
3. Write JSDoc comments for all functions
4. Follow Google TypeScript style guide

## License

[Add your license here]


