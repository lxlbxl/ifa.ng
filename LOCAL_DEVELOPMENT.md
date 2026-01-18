# Local Development Guide - IFA Connect

Complete guide for setting up and running IFA Connect locally with Supabase and SQLite testing.

## 🚀 Quick Setup (5 Minutes)

### Prerequisites

- Node.js 18+ installed
- Docker Desktop installed and running (for local Supabase)
- Git installed

### Step-by-Step Setup

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/lxlbxl/ifa-connect.git
cd ifa-connect

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.local.example .env.local

# 4. Start Supabase local instance
npm run supabase:start

# 5. Start the development server
npm run dev
```

That's it! The app is now running at http://localhost:8080

## 📋 Development Modes

### Mode 1: Full Local Stack (Recommended)

**Best for:** Full-stack development, testing features end-to-end

```bash
# Terminal 1: Start Supabase
npm run supabase:start

# Terminal 2: Start dev server
npm run dev
```

**Services Running:**
- Frontend: http://localhost:8080
- Supabase Studio: http://localhost:54323
- Supabase API: http://localhost:54321
- PostgreSQL: localhost:54322
- Email Testing: http://localhost:54324

### Mode 2: Production Supabase + Local Frontend

**Best for:** Frontend development, using real production data

```bash
# Use production .env file
cp .env.example .env

# Start dev server
npm run dev
```

### Mode 3: Unit Testing Only

**Best for:** TDD, quick iteration on logic

```bash
# No services needed - all mocked!
npm run test:watch
```

## 🛠️ Available Commands

### Development

```bash
npm run dev                # Start dev server (production Supabase)
npm run dev:local          # Start with local Supabase
npm run build              # Production build
npm run build:dev          # Development build
npm run preview            # Preview production build
npm run lint               # Run ESLint
```

### Supabase

```bash
npm run supabase:start     # Start local Supabase (Docker)
npm run supabase:stop      # Stop all services
npm run supabase:status    # View service status
npm run supabase:reset     # Reset database (apply all migrations)
```

### Testing

```bash
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:ui            # Visual UI for tests
npm run test:coverage      # Coverage report
```

## 📁 Project Structure

```
ifa-connect/
├── src/
│   ├── components/        # React components
│   │   ├── dashboard/     # Dashboard components
│   │   │   ├── admin/     # Admin panel
│   │   │   ├── user/      # User dashboard
│   │   │   └── babalawo/  # Babalawo dashboard
│   │   └── ui/            # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Business logic
│   │   ├── agoraService.ts      # Video SDK
│   │   ├── dailyService.ts      # Alt video SDK
│   │   ├── errorService.ts      # Error handling
│   │   └── logger.ts            # Logging (NEW!)
│   ├── integrations/      # External services
│   │   └── supabase/      # Supabase client & types
│   ├── pages/             # Route pages
│   ├── types/             # TypeScript types
│   └── test/              # Test utilities (NEW!)
├── supabase/
│   ├── migrations/        # Database migrations
│   ├── functions/         # Edge functions
│   │   ├── generate-agora-token/
│   │   ├── create-daily-room/
│   │   └── health-check/  # Health monitoring (NEW!)
│   └── config.toml        # Local config (UPDATED!)
├── .env.example           # Production env template
├── .env.local.example     # Local env template (NEW!)
├── TESTING.md             # Testing guide (NEW!)
└── VIDEO_SESSION_DIAGNOSTIC_REPORT.md  # Bug report
```

## 🗄️ Database Management

### Accessing Local Database

**Supabase Studio (Recommended):**
```bash
# Start Supabase
npm run supabase:start

# Open Studio
open http://localhost:54323
```

**Direct PostgreSQL:**
```bash
# Connection string
postgresql://postgres:postgres@localhost:54322/postgres

# Using psql
psql postgresql://postgres:postgres@localhost:54322/postgres
```

### Managing Migrations

```bash
# Create new migration
supabase migration new my_migration_name

# Apply all migrations
npm run supabase:reset

# View migration history
supabase migration list
```

### Seeding Test Data

Create `supabase/seed.sql`:

```sql
-- Insert test babalawo
INSERT INTO profiles (id, full_name, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Babalawo', 'babalawo');

INSERT INTO babalawos (user_id, hourly_rate, experience_years, current_status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 15000, 10, 'online');
```

Apply with:
```bash
npm run supabase:reset
```

## 🎬 Video Service Configuration

### Agora (Default)

1. Get Agora credentials from https://console.agora.io
2. Add to database via Admin Panel:
   - Go to http://localhost:8080/admin
   - Settings → Video Settings
   - Enter Agora App ID and Certificate
   - Save

**Or via SQL:**
```sql
INSERT INTO admin_settings (setting_key, setting_value)
VALUES
  ('agora_app_id', 'your_app_id'),
  ('agora_app_certificate', 'your_certificate'),
  ('agora_token_expiry', '3600'),
  ('video_provider', 'agora');
```

### Daily.co (Alternative)

```sql
UPDATE admin_settings
SET setting_value = 'daily'
WHERE setting_key = 'video_provider';

INSERT INTO admin_settings (setting_key, setting_value)
VALUES ('daily_api_key', 'your_daily_api_key');
```

## 🔐 Authentication & Roles

### Test Users

Create test users via Supabase Studio:

**Admin:**
```sql
INSERT INTO profiles (id, full_name, role)
VALUES (auth.uid(), 'Admin User', 'admin');
```

**Babalawo:**
```sql
INSERT INTO profiles (id, full_name, role)
VALUES (auth.uid(), 'Test Babalawo', 'babalawo');

INSERT INTO babalawos (user_id, hourly_rate)
VALUES (auth.uid(), 15000);
```

**Regular User:**
```sql
-- Just sign up normally - defaults to 'user' role
```

## 📧 Email Testing (Local)

Emails are captured by Inbucket:

```bash
# Start Supabase
npm run supabase:start

# View emails
open http://localhost:54324

# All emails go to: test@example.com
```

## 🐛 Debugging

### VS Code Setup

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug App",
      "url": "http://localhost:8080",
      "webRoot": "${workspaceFolder}/src"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Enable Detailed Logging

The new `logger` service provides structured logging:

```typescript
import { logger } from '@/services/logger';

// Instead of console.log
logger.info('User logged in', { userId: user.id });

// Instead of console.error
logger.error('Payment failed', error, { sessionId, amount });

// Domain-specific loggers
logger.payment.started(sessionId, amount);
logger.video.initialized('agora', sessionId);
logger.auth.login(userId);
```

## 🔥 Hot Reload Issues

If hot reload stops working:

```bash
# 1. Stop dev server (Ctrl+C)
# 2. Clear cache
rm -rf node_modules/.vite

# 3. Restart
npm run dev
```

## 🆘 Common Issues

### Port Already in Use

```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or use different port
vite --port 3000
```

### Supabase Won't Start

```bash
# Check Docker
docker ps

# Stop all containers
docker stop $(docker ps -aq)

# Restart Supabase
npm run supabase:start
```

### Database Connection Errors

```bash
# Reset database
npm run supabase:reset

# Check migrations
supabase migration list

# View logs
supabase logs db
```

### Type Errors After Schema Changes

```bash
# Regenerate types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## 🎯 Feature Flags (Environment)

```bash
# .env.local
VITE_ENABLE_ANALYTICS=false         # Disable analytics in dev
VITE_ENABLE_ERROR_REPORTING=false   # Disable Sentry in dev
VITE_ENABLE_MOCK_DATA=true          # Use mock data
VITE_VIDEO_PROVIDER=agora           # Default video provider
```

## 📱 Mobile Development

Test mobile UI:

```bash
# Get local IP
ipconfig getifaddr en0  # Mac
hostname -I             # Linux

# Access from phone
http://192.168.1.XXX:8080
```

Or use Chrome DevTools:
- F12 → Device Toolbar (Ctrl+Shift+M)
- Select device: iPhone 14 Pro, etc.

## 🚀 Production Deployment Checklist

Before deploying:

```bash
# 1. Run tests
npm run test:coverage

# 2. Check linting
npm run lint

# 3. Build production
npm run build

# 4. Preview build
npm run preview

# 5. Check bundle size
npm run build -- --analyze

# 6. Update types from production
supabase gen types typescript --project-id bxzwsfglgodfuirdkgsc > src/integrations/supabase/types.ts
```

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [Agora Docs](https://docs.agora.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

Happy Coding! 💻✨
