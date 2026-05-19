import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Discover from '../components/Discover';
import { TOPIC_TAXONOMY } from '../data/topics';

const totalTopics = TOPIC_TAXONOMY.reduce((n, c) => n + c.items.length, 0);

describe('Discover', () => {
  it('renders the page heading', () => {
    render(<Discover onSelect={vi.fn()} />);
    expect(screen.getByText('Explore History')).toBeInTheDocument();
  });

  it('shows the total topic count', () => {
    render(<Discover onSelect={vi.fn()} />);
    expect(screen.getByText(new RegExp(`${totalTopics} curated`, 'i'))).toBeInTheDocument();
  });

  it('renders all category headers', () => {
    render(<Discover onSelect={vi.fn()} />);
    for (const cat of TOPIC_TAXONOMY) {
      expect(screen.getByText(cat.label)).toBeInTheDocument();
    }
  });

  it('renders all topic cards', () => {
    render(<Discover onSelect={vi.fn()} />);
    for (const cat of TOPIC_TAXONOMY) {
      for (const item of cat.items) {
        expect(screen.getByText(item.label)).toBeInTheDocument();
      }
    }
  });

  it('calls onSelect with correct args when a topic is clicked', async () => {
    const onSelect = vi.fn();
    render(<Discover onSelect={onSelect} />);
    const firstItem = TOPIC_TAXONOMY[0]!.items[0]!;
    await userEvent.click(screen.getByText(firstItem.label));
    expect(onSelect).toHaveBeenCalledWith(firstItem.topic, firstItem.start, firstItem.end);
  });

  it('filters topics by search query', async () => {
    render(<Discover onSelect={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/search topics/i);
    await userEvent.type(searchInput, 'Ancient Greece');
    expect(screen.getByText('Ancient Greece')).toBeInTheDocument();
    // Other topics should be hidden
    expect(screen.queryByText('Western Philosophy')).not.toBeInTheDocument();
  });

  it('shows "no topics match" message for an unmatched search', async () => {
    render(<Discover onSelect={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/search topics/i);
    await userEvent.type(searchInput, 'zzz-no-match-zzz');
    expect(screen.getByText(/no topics match/i)).toBeInTheDocument();
  });

  it('filters by category chip', async () => {
    render(<Discover onSelect={vi.fn()} />);
    const catLabel = TOPIC_TAXONOMY[1]!.label; // e.g. Philosophy
    // The chip buttons are in the filter bar; getAllByRole gets chip + possible heading matches
    const buttons = screen.getAllByRole('button', { name: new RegExp(catLabel, 'i') });
    await userEvent.click(buttons[0]!); // click the chip
    // Topics from the selected category should be visible
    for (const item of TOPIC_TAXONOMY[1]!.items) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
    // Topics from a different category should be gone
    expect(screen.queryByText(TOPIC_TAXONOMY[0]!.items[0]!.label)).not.toBeInTheDocument();
  });

  it('clicking the active category chip again shows all', async () => {
    render(<Discover onSelect={vi.fn()} />);
    const catLabel = TOPIC_TAXONOMY[1]!.label;
    const buttons = screen.getAllByRole('button', { name: new RegExp(catLabel, 'i') });
    await userEvent.click(buttons[0]!); // filter to this category
    await userEvent.click(buttons[0]!); // toggle off
    // All categories should be visible again
    expect(screen.getByText(TOPIC_TAXONOMY[0]!.items[0]!.label)).toBeInTheDocument();
  });
});
