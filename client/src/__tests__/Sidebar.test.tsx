import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../components/Sidebar';
import { TOPIC_TAXONOMY } from '../data/topics';
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

const defaultProps = {
  onSelect: vi.fn(),
  activeTopic: undefined,
  isOpen: true,
  onClose: vi.fn(),
  user: null,
  onSignIn: vi.fn(),
  history: [],
};

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sidebar', () => {
  it('renders the Browse Topics header', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/browse topics/i)).toBeInTheDocument();
  });

  it('renders category labels from TOPIC_TAXONOMY', () => {
    render(<Sidebar {...defaultProps} />);
    for (const cat of TOPIC_TAXONOMY) {
      expect(screen.getByText(cat.label)).toBeInTheDocument();
    }
  });

  it('expands a section and shows topic items when clicked', async () => {
    const closedCat = TOPIC_TAXONOMY.find(c => c.label !== 'Philosophy' && c.label !== 'Science & Technology')!;
    render(<Sidebar {...defaultProps} />);
    const header = screen.getByText(closedCat.label);
    await userEvent.click(header.closest('button')!);
    expect(screen.getByText(closedCat.items[0]!.label)).toBeInTheDocument();
  });

  it('calls onSelect and onClose when a topic item is clicked', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    // Open Philosophy (it's in openSections by default)
    const cat = TOPIC_TAXONOMY.find(c => c.label === 'Philosophy')!;
    render(<Sidebar {...defaultProps} onSelect={onSelect} onClose={onClose} />);
    const item = cat.items[0]!;
    await userEvent.click(screen.getByText(item.label));
    expect(onSelect).toHaveBeenCalledWith(item.topic, item.start, item.end);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Collections header', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Collections')).toBeInTheDocument();
  });

  it('shows sign-in prompt when user is null', () => {
    render(<Sidebar {...defaultProps} user={null} />);
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('does not show sign-in prompt when user is logged in', () => {
    render(<Sidebar {...defaultProps} user={mockUser} />);
    // "Sign in" text only appears in the unauthenticated state
    expect(screen.queryByText(/^Sign in$/)).not.toBeInTheDocument();
  });

  it('shows recent history entries when history is provided', () => {
    const history = [
      { topic: 'Ancient Rome', title: 'The Roman Empire', start: '27 BCE', end: '476 CE', viewedAt: Date.now() },
    ];
    render(<Sidebar {...defaultProps} history={history} />);
    expect(screen.getByText(/recent/i)).toBeInTheDocument();
    expect(screen.getByText(/The Roman Empire/)).toBeInTheDocument();
  });

  it('shows trending section when API returns data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.toString().includes('trending')) {
        return {
          ok: true,
          json: async () => [
            { topic: 'Hot Topic', startYear: '2020', endYear: '2024', period: '2020–2024' },
          ],
        } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });

    render(<Sidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Hot Topic')).toBeInTheDocument();
    });
    expect(screen.getByText(/trending/i)).toBeInTheDocument();
  });

  it('hides overlay on large screens (sidebar always visible)', () => {
    const { container } = render(<Sidebar {...defaultProps} isOpen={false} />);
    // The overlay div only renders when isOpen=true
    const overlay = container.querySelector('.bg-black\\/60');
    expect(overlay).toBeNull();
  });
});
