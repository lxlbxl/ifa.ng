# Ifa Connect

A platform connecting users with Babalawos for spiritual consultations and divination sessions.

## Features

- User authentication and profile management
- Babalawo profiles and specialties
- Session booking and scheduling
- Live video consultations with Agora integration
- Session outcome documentation
- Dashboard interfaces for users, babalawos, and admins
- Secure payment processing

## Security Improvements

This repository includes several recent security and performance improvements:

- Environment-based configuration (no hardcoded credentials)
- Enhanced error handling and validation
- Database schema improvements and migration safeguards
- Performance optimizations and code splitting
- Error boundaries for component failure isolation

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or bun
- Supabase account and project

### Installation

1. Clone the repository:

```bash
git clone https://github.com/lxlbxl/ifa-connect.git
cd ifa-connect
```

2. Install dependencies:

```bash
npm install
# or with bun
bun install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Then edit the `.env` file with your Supabase credentials and other configuration:

```
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Feature Flags
VITE_FEATURE_INSTANT_SESSIONS=true
VITE_FEATURE_NOTIFICATIONS=true

# Environment
VITE_APP_ENV=development
```

4. Start the development server:

```bash
npm run dev
# or with bun
bun run dev
```

### Database Migrations

When running migrations:

1. Make sure your Supabase CLI is configured
2. Run migrations in order:

```bash
supabase migration up
```

The migrations are designed to be idempotent and include safety checks to prevent data corruption.

## Project Structure

- `/src` - Application source code
  - `/components` - Reusable UI components
  - `/hooks` - Custom React hooks
  - `/integrations` - External service integrations (Supabase, etc.)
  - `/pages` - Route components
  - `/utils` - Utility functions
- `/supabase` - Supabase configuration and migrations
  - `/migrations` - Database schema migrations
  - `/functions` - Edge functions

## Development Guidelines

- Use TypeScript for type safety
- Follow the component structure patterns
- Use Zod for form validation
- Add proper error handling for all async operations
- Use environment variables for configuration

## Security Best Practices

- Never commit sensitive credentials to the repository
- Always validate user input with Zod schemas
- Use parameterized queries for database operations
- Implement proper error handling to avoid leaking sensitive information
- Use HTTPS for all API calls

## License

[MIT](LICENSE)
