import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeaturedTimelines from '../components/FeaturedTimelines';
import type { TimelineData } from '../types';

const mockTimeline = (topic: string): TimelineData => ({
  topic,
  period: '100 BCE to 100 CE',
  description: `A great timeline about ${topic}.`,
  events: Array.from({ length: 8 }, (_, i) => ({
    date: `${i * 10} CE`,
    sortYear: i * 10,
    title: `Event ${i + 1}`,
    summary: 'Summary',
    details: 'Details',
    significance: 'Significance',
    figures: [],
    location: 'Somewhere',
    tags: [],
  })),
  relatedTopics: [],
});

describe('FeaturedTimelines', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('Roman')) {
        return { ok: true, json: async () => ({ cached: true, timeline: mockTimeline('The Roman Empire') }) } as Response;
      }
      if (urlStr.includes('Space')) {
        return { ok: true, json: async () => ({ cached: true, timeline: mockTimeline('The Space Race') }) } as Response;
      }
      if (urlStr.includes('French')) {
        return { ok: true, json: async () => ({ cached: true, timeline: mockTimeline('The French Revolution') }) } as Response;
      }
      if (urlStr.includes('Artificial')) {
        return { ok: true, json: async () => ({ cached: true, timeline: mockTimeline('History of Artificial Intelligence') }) } as Response;
      }
      return { ok: false } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when all fetches fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    const { container } = render(<FeaturedTimelines onSelect={vi.fn()} />);
    // Component returns null when previews is empty — give it a moment
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders up to 4 featured timeline cards', async () => {
    render(<FeaturedTimelines onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('The Roman Empire')).toBeInTheDocument();
    });
    const cards = screen.getAllByRole('button');
    expect(cards.length).toBeLessThanOrEqual(4);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows event count badge on each card', async () => {
    render(<FeaturedTimelines onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('The Roman Empire')).toBeInTheDocument();
    });
    // Each mock timeline has 8 events
    const badges = screen.getAllByText('8');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows the period and description for a loaded card', async () => {
    render(<FeaturedTimelines onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('The Roman Empire')).toBeInTheDocument();
    });
    // Multiple cards share the same mocked period; at least one should appear
    expect(screen.getAllByText('100 BCE to 100 CE').length).toBeGreaterThan(0);
    expect(screen.getByText(/great timeline about The Roman Empire/i)).toBeInTheDocument();
  });

  it('calls onSelect with correct topic/years when a card is clicked', async () => {
    const onSelect = vi.fn();
    render(<FeaturedTimelines onSelect={onSelect} />);
    await waitFor(() => {
      expect(screen.getByText('The Roman Empire')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('The Roman Empire').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('The Roman Empire', '27 BCE', expect.any(String));
  });
});
