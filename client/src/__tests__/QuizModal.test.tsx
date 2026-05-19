import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizModal from '../components/QuizModal';

const MOCK_QUESTIONS = [
  { question: 'Who founded Rome?', options: ['Romulus', 'Caesar', 'Augustus', 'Nero'], correct: 0, explanation: 'Romulus is the legendary founder.' },
  { question: 'When did the Roman Empire fall?', options: ['410', '476', '510', '395'], correct: 1, explanation: 'The Western Roman Empire fell in 476 CE.' },
  { question: 'What language did Romans speak?', options: ['Greek', 'Latin', 'Italian', 'Etruscan'], correct: 1, explanation: 'Latin was the official language.' },
  { question: 'Which hill was Rome founded on?', options: ['Aventine', 'Palatine', 'Capitoline', 'Quirinal'], correct: 1, explanation: 'Rome was traditionally founded on the Palatine Hill.' },
  { question: 'What was the Roman senate?', options: ['Army', 'Governing body', 'Temple', 'Market'], correct: 1, explanation: 'The senate was the main governing body.' },
];

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ questions: MOCK_QUESTIONS }),
  });
});

describe('QuizModal', () => {
  it('shows loading state initially', () => {
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    expect(screen.getByText(/generating questions/i)).toBeInTheDocument();
  });

  it('displays the first question after loading', async () => {
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('Who founded Rome?')).toBeInTheDocument());
  });

  it('shows all 4 options for the first question', async () => {
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Who founded Rome?'));
    expect(screen.getByText('Romulus')).toBeInTheDocument();
    expect(screen.getByText('Caesar')).toBeInTheDocument();
    expect(screen.getByText('Augustus')).toBeInTheDocument();
    expect(screen.getByText('Nero')).toBeInTheDocument();
  });

  it('shows explanation after selecting an answer', async () => {
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Who founded Rome?'));
    await userEvent.click(screen.getByText('Romulus'));
    expect(screen.getByText('Romulus is the legendary founder.')).toBeInTheDocument();
  });

  it('advances to the next question after clicking Next', async () => {
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Who founded Rome?'));
    await userEvent.click(screen.getByText('Romulus'));
    await userEvent.click(screen.getByRole('button', { name: /next question/i }));
    expect(screen.getByText('When did the Roman Empire fall?')).toBeInTheDocument();
  });

  it('calls onClose when the × button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={onClose} onComplete={vi.fn()} />
    );
    await userEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows error state when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Not found' }) });
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument());
  });

  it('shows progress bar with correct number of segments', async () => {
    render(
      <QuizModal topic="Rome" startYear="27" endYear="476" onClose={vi.fn()} onComplete={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Who founded Rome?'));
    // 5 progress segments (one per question)
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
  });
});
