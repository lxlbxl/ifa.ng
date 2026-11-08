import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../Header';
import { AuthProvider } from '@/hooks/useAuth';
import { expect } from '@jest/globals';

const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  ...jest.requireActual('@/hooks/useAuth'),
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  },
}));

describe('Header', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
  });

  it('renders the logo and navigation links', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </BrowserRouter>
    );

    // Check for the logo
    (expect(screen.getByText('Ifa Connect')) as any).toBeInTheDocument();

    // Check for navigation links
    (expect(screen.getByText('Find a Babalawo')) as any).toBeInTheDocument();
    (expect(screen.getByText('Sign In')) as any).toBeInTheDocument();
  });

  it('shows the dashboard link when a user is logged in', () => {
    mockUseAuth.mockReturnValue({ user: { id: '123' } });

    render(
      <BrowserRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </BrowserRouter>
    );

    // Check for the dashboard link
    (expect(screen.getByText('Dashboard')) as any).toBeInTheDocument();
  });
});
