import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Timeline from '../components/Timeline';
import type { TimelineData } from '../types';

const mockTimeline: TimelineData = {
  topic: 'Ancient Greece',
  period: '800 BCE to 146 BCE',
  description: 'A test timeline.',
  events: [
    {
      date: '490 BCE', sortYear: -490, title: 'Battle of Marathon',
      summary: 'Greek victory.', details: 'Details.', significance: 'Sig.',
      figures: ['Miltiades'], location: 'Marathon', tags: ['war'],
    },
  ],
  relatedTopics: ['The Roman Empire', 'The Persian Empire', 'Ancient Egypt'],
};

describe('Related Topics gating', () => {
  it('shows Related Topics section when onRelatedSelect is provided', () => {
    render(<Timeline data={mockTimeline} onReset={vi.fn()} onRelatedSelect={vi.fn()} />);
    expect(screen.getByText('Related Topics')).toBeInTheDocument();
    expect(screen.getByText(/The Roman Empire/)).toBeInTheDocument();
  });

  it('hides Related Topics section when onRelatedSelect is undefined (not signed in)', () => {
    render(<Timeline data={mockTimeline} onReset={vi.fn()} onRelatedSelect={undefined} />);
    expect(screen.queryByText('Related Topics')).not.toBeInTheDocument();
  });

  it('calls onRelatedSelect with the topic name when a chip is clicked', async () => {
    const onRelatedSelect = vi.fn();
    render(<Timeline data={mockTimeline} onReset={vi.fn()} onRelatedSelect={onRelatedSelect} />);
    await userEvent.click(screen.getByText(/The Roman Empire/));
    expect(onRelatedSelect).toHaveBeenCalledWith('The Roman Empire');
  });

  it('does not render related chips for a timeline with no relatedTopics', () => {
    const noRelated: TimelineData = { ...mockTimeline, relatedTopics: [] };
    render(<Timeline data={noRelated} onReset={vi.fn()} onRelatedSelect={vi.fn()} />);
    expect(screen.queryByText('Related Topics')).not.toBeInTheDocument();
  });
});

describe('Quick-start chips from TOPIC_TAXONOMY', () => {
  it('QUICK_CHIPS items all have topic, start, and end properties', async () => {
    // Import dynamically to test the constant directly
    const { TOPIC_TAXONOMY } = await import('../data/topics');
    // Verify each category referenced in QUICK_CHIPS has items at the expected indexes
    expect(TOPIC_TAXONOMY[0]?.items[1]?.topic).toBe('The Roman Empire');
    expect(TOPIC_TAXONOMY[3]?.items[3]?.topic).toBe('The Cold War');
    expect(TOPIC_TAXONOMY[2]?.items[1]?.topic).toBe('The Space Race');
    expect(TOPIC_TAXONOMY[4]?.items[0]?.topic).toBe('The Renaissance');
    expect(TOPIC_TAXONOMY[7]?.items[3]?.topic).toBe('The Napoleonic Wars');
    expect(TOPIC_TAXONOMY[1]?.items[2]?.topic).toBe('The Enlightenment');
  });

  it('all QUICK_CHIPS topics exist in TOPIC_TAXONOMY', async () => {
    const { TOPIC_TAXONOMY } = await import('../data/topics');
    const allTopics = new Set(TOPIC_TAXONOMY.flatMap(c => c.items.map(i => i.topic)));
    const chips = [
      TOPIC_TAXONOMY[0]!.items[1]!,
      TOPIC_TAXONOMY[3]!.items[3]!,
      TOPIC_TAXONOMY[2]!.items[1]!,
      TOPIC_TAXONOMY[4]!.items[0]!,
      TOPIC_TAXONOMY[7]!.items[3]!,
      TOPIC_TAXONOMY[1]!.items[2]!,
    ];
    for (const chip of chips) {
      expect(allTopics.has(chip.topic)).toBe(true);
      expect(chip.start).toBeTruthy();
      expect(chip.end).toBeTruthy();
    }
  });
});
