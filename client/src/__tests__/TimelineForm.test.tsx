import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimelineForm from '../components/TimelineForm';

describe('TimelineForm', () => {
  it('renders all three input fields', () => {
    render(<TimelineForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^topic$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^from$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^to$/i)).toBeInTheDocument();
  });

  it('calls onSubmit with correct values on form submission', async () => {
    const onSubmit = vi.fn();
    render(<TimelineForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/^topic$/i), 'Ancient Rome');
    await userEvent.type(screen.getByLabelText(/^from$/i), '27 BCE');
    await userEvent.type(screen.getByLabelText(/^to$/i), '476 CE');
    fireEvent.submit(screen.getByRole('button', { name: /generate/i }));

    expect(onSubmit).toHaveBeenCalledWith('Ancient Rome', '27 BCE', '476 CE');
  });

  it('does not call onSubmit with empty fields', () => {
    const onSubmit = vi.fn();
    render(<TimelineForm onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('button', { name: /generate/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('trims whitespace from inputs', async () => {
    const onSubmit = vi.fn();
    render(<TimelineForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/^topic$/i), '  Ancient Rome  ');
    await userEvent.type(screen.getByLabelText(/^from$/i), ' 27 BCE ');
    await userEvent.type(screen.getByLabelText(/^to$/i), ' 476 CE ');
    fireEvent.submit(screen.getByRole('button', { name: /generate/i }));
    expect(onSubmit).toHaveBeenCalledWith('Ancient Rome', '27 BCE', '476 CE');
  });

  it('shows usage bar when remaining and dailyLimit are provided', () => {
    render(<TimelineForm onSubmit={vi.fn()} remaining={7} dailyLimit={10} />);
    expect(screen.getByText(/daily generations/i)).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('disables submit and shows warning text when limit is reached', () => {
    render(<TimelineForm onSubmit={vi.fn()} remaining={0} dailyLimit={10} />);
    const btn = screen.getByRole('button', { name: /daily limit reached/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/resets at midnight/i)).toBeInTheDocument();
  });

  it('does not show usage bar when remaining is undefined', () => {
    render(<TimelineForm onSubmit={vi.fn()} />);
    expect(screen.queryByText(/daily generations/i)).not.toBeInTheDocument();
  });
});
