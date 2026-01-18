# Testing Guide - IFA Connect

This guide explains how to run tests locally using SQLite and Supabase local development.

## 🎯 Overview

- **Unit Tests**: Use Vitest with mocked Supabase (in-memory, super fast)
- **Integration Tests**: Use Supabase local development (PostgreSQL in Docker)
- **Production**: Uses Supabase cloud (PostgreSQL)

## 🚀 Quick Start

### Option 1: Run Unit Tests (Fastest - No Setup Required)

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

**Advantages:**
- ⚡ Super fast (no database connection)
- 🔧 No setup required
- 🎯 Perfect for TDD and unit testing
- 💻 Works offline

### Option 2: Local Development with Supabase (Full Stack Testing)

```bash
# Start Supabase local instance (requires Docker)
npm run supabase:start

# Run the app with local Supabase
npm run dev:local

# In another terminal, run integration tests
npm test

# Stop Supabase when done
npm run supabase:stop
```

**Advantages:**
- 🔄 Real PostgreSQL database
- 🎭 Matches production environment
- 🔐 Test auth, storage, and edge functions
- 📊 Includes Supabase Studio UI at http://localhost:54323

## 📁 Project Structure

```
ifa-connect/
├── src/
│   └── test/
│       ├── setup.ts           # Test configuration
│       ├── mockSupabase.ts    # Mock Supabase client
│       └── example.test.tsx   # Example tests
├── vitest.config.ts           # Vitest configuration
├── supabase/config.toml       # Local Supabase config
└── .env.local.example         # Environment template
```

## 🧪 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockSupabaseClient, mockBabalawo } from '@/test/mockSupabase';

describe('Babalawo Service', () => {
  it('should fetch babalawo by id', async () => {
    const supabase = createMockSupabaseClient();

    // Mock the response
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: mockBabalawo,
            error: null
          })
        })
      })
    } as any);

    const result = await supabase
      .from('babalawos')
      .select('*')
      .eq('id', '123')
      .single();

    expect(result.data).toEqual(mockBabalawo);
  });
});
```

### Component Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render and handle clicks', () => {
    render(<MyComponent />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

## 🐳 Supabase Local Development

### Prerequisites

- Docker Desktop installed and running
- Supabase CLI installed (`npm install -g supabase`)

### Commands

```bash
# Start local Supabase (PostgreSQL + all services)
supabase start

# View status and URLs
supabase status

# Access Supabase Studio
open http://localhost:54323

# Reset database (apply all migrations)
supabase db reset

# Stop all services
supabase stop
```

### What You Get Locally

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:54321 | Supabase API Gateway |
| Studio | http://localhost:54323 | Database UI |
| Database | postgresql://postgres:postgres@localhost:54322/postgres | PostgreSQL |
| Inbucket | http://localhost:54324 | Email testing |

## 🎨 Mock Data

We provide mock data for testing:

```typescript
import {
  mockSession,
  mockBabalawo,
  mockUser,
  mockProfile
} from '@/test/mockSupabase';

// Use in your tests
it('should work with mock data', () => {
  expect(mockBabalawo.current_status).toBe('online');
  expect(mockSession.id).toBeDefined();
});
```

## 📊 Coverage Reports

```bash
# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/index.html
```

**Coverage Goals:**
- Overall: 70%+
- Critical paths: 90%+
- UI components: 60%+

## 🔧 Environment Variables

### For Unit Tests
No environment variables needed - all mocked!

### For Local Supabase

Create `.env.local`:

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## 🐛 Debugging Tests

### VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Chrome DevTools

```bash
# Run with inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs
```

## 🎯 Testing Strategy

### What to Test

✅ **Unit Tests (Fast, Isolated)**
- Business logic functions
- Data transformations
- Utility functions
- React hooks
- Form validation

✅ **Integration Tests (Real Database)**
- Database queries
- API endpoints
- Authentication flows
- File uploads
- Real-time subscriptions

✅ **E2E Tests (Full User Flows)**
- User registration → booking → payment
- Video session creation → join → end
- Search → filter → book babalawo

### What NOT to Test

❌ Third-party libraries (React, Supabase, etc.)
❌ Generated types
❌ Configuration files
❌ Static content

## 🚀 CI/CD Integration

Tests run automatically on:
- Every commit (unit tests)
- Every PR (unit + integration tests)
- Before deployment (full test suite)

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)

## 🆘 Troubleshooting

### Tests Fail: "Cannot find module"
```bash
npm install
```

### Supabase Won't Start: "Port already in use"
```bash
supabase stop
docker ps  # Check for running containers
```

### Tests Timeout
Increase timeout in test file:
```typescript
it('long running test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Mock Not Working
Clear mocks between tests:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## 🎉 Best Practices

1. **Keep tests fast** - Use mocks for unit tests
2. **Test behavior, not implementation** - Test what users see
3. **One assertion per test** - Makes failures clear
4. **Descriptive test names** - `it('should show error when email is invalid')`
5. **Arrange-Act-Assert** - Structure tests clearly
6. **Clean up after tests** - Use `afterEach` cleanup

---

Happy Testing! 🧪✨
