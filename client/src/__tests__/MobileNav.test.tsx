import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileNav from '../components/MobileNav';
import type { AuthUser } from '../hooks/useAuth';

const mockUser: AuthUser = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  picture: undefined,
  dailyCount: 0,
  dailyLimit: 10,
  remaining: 10,
  xp: 0,
  level: 1,
  activeTheme: 'midnight',
  unlockedThemes: ['midnight'],
};

describe('MobileNav', () => {
  it('renders Home, Discover, and Paths tabs regardless of auth state', () => {
    render(<MobileNav page="home" onNavigate={vi.fn()} user={null} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Paths')).toBeInTheDocument();
  });

  it('hides the Library tab when user is not signed in', () => {
    render(<MobileNav page="home" onNavigate={vi.fn()} user={null} />);
    expect(screen.queryByText('Library')).not.toBeInTheDocument();
  });

  it('shows the Library tab when user is signed in', () => {
    render(<MobileNav page="home" onNavigate={vi.fn()} user={mockUser} />);
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('calls onNavigate with the correct page id when a tab is clicked', async () => {
    const onNavigate = vi.fn();
    render(<MobileNav page="home" onNavigate={onNavigate} user={mockUser} />);
    await userEvent.click(screen.getByText('Discover'));
    expect(onNavigate).toHaveBeenCalledWith('discover');
  });

  it('marks the active tab visually', () => {
    render(<MobileNav page="discover" onNavigate={vi.fn()} user={null} />);
    const discoverBtn = screen.getByText('Discover').closest('button');
    expect(discoverBtn).toHaveClass('text-amber-400');
  });

  it('inactive tabs do not have the active class', () => {
    render(<MobileNav page="discover" onNavigate={vi.fn()} user={null} />);
    const homeBtn = screen.getByText('Home').closest('button');
    expect(homeBtn).not.toHaveClass('text-amber-400');
  });

  it('renders exactly 3 tabs without auth and 4 tabs with auth', () => {
    const { rerender } = render(<MobileNav page="home" onNavigate={vi.fn()} user={null} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    rerender(<MobileNav page="home" onNavigate={vi.fn()} user={mockUser} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});
