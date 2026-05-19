import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileBadge from '../components/ProfileBadge';
import type { AuthUser } from '../hooks/useAuth';

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  picture: undefined,
  dailyCount: 2,
  dailyLimit: 10,
  remaining: 8,
  xp: 150,
  level: 2,
  activeTheme: 'midnight',
  unlockedThemes: ['midnight'],
  ...overrides,
});

describe('ProfileBadge', () => {
  it('displays the current level', () => {
    render(<ProfileBadge user={makeUser()} onClick={vi.fn()} />);
    expect(screen.getByText(/Lv\.2/i)).toBeInTheDocument();
  });

  it('displays XP', () => {
    render(<ProfileBadge user={makeUser({ xp: 250 })} onClick={vi.fn()} />);
    expect(screen.getByText(/250 XP/i)).toBeInTheDocument();
  });

  it('shows first letter of name when no picture', () => {
    render(<ProfileBadge user={makeUser({ picture: undefined })} onClick={vi.fn()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders avatar image when picture is provided', () => {
    render(<ProfileBadge user={makeUser({ picture: 'https://example.com/avatar.jpg' })} onClick={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<ProfileBadge user={makeUser()} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows Lv.20 at max level', () => {
    render(<ProfileBadge user={makeUser({ level: 20, xp: 22000 })} onClick={vi.fn()} />);
    expect(screen.getByText(/Lv\.20/i)).toBeInTheDocument();
  });
});
