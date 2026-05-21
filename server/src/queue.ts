/**
 * Enqueues topics for background pre-generation via the Azure Storage Queue.
 * Called fire-and-forget after any timeline is served so related topics and
 * the next era are warm before the user clicks them.
 *
 * The consumer (Azure Function processPregenQueue timer) skips topics with
 * TTL > 1 day, so duplicate enqueues are harmless.
 */
import { QueueServiceClient } from '@azure/storage-queue';
import { getSecret } from './secrets.js';
import type { TimelineData } from './types.js';

const QUEUE_NAME = 'epocha-pregenerate-jobs';

interface TopicJob {
  topic: string;
  startYear: string;
  endYear: string;
  forceRegenerate: boolean;
}

/**
 * Compute the next chronological era using the timeline's sortYear values
 * (already normalised: negative = BCE, positive = CE).
 * Exported for testing.
 */
export function computeNextEra(
  topic: string,
  events: TimelineData['events'],
): TopicJob | null {
  const sortYears = events
    .map(e => e.sortYear)
    .filter((y): y is number => typeof y === 'number');

  if (sortYears.length < 2) return null;

  const minYear = Math.min(...sortYears);
  const maxYear = Math.max(...sortYears);
  const span = Math.max(10, maxYear - minYear);

  if (maxYear + span > 2100) return null;

  const fmt = (y: number) => (y <= 0 ? `${Math.abs(y) || 1} BCE` : `${y} CE`);
  return {
    topic,
    startYear: fmt(maxYear),
    endYear: fmt(maxYear + span),
    forceRegenerate: false,
  };
}

export async function enqueueRelatedTopics(
  timeline: TimelineData,
  _startYear: string,
  _endYear: string,
): Promise<void> {
  const connStr = getSecret('storage-connection-string');
  if (!connStr) return;

  const jobs: TopicJob[] = [];

  // Related topics (no fixed period — LLM picks the canonical era)
  for (const topic of timeline.relatedTopics ?? []) {
    if (topic) jobs.push({ topic, startYear: '', endYear: '', forceRegenerate: false });
  }

  // Next era derived from sortYear values (handles BCE correctly)
  const nextEra = computeNextEra(timeline.topic, timeline.events);
  if (nextEra) jobs.push(nextEra);

  if (jobs.length === 0) return;

  try {
    const queueClient = QueueServiceClient
      .fromConnectionString(connStr)
      .getQueueClient(QUEUE_NAME);

    await Promise.all(jobs.map(j => queueClient.sendMessage(JSON.stringify(j))));
    console.log(`[queue] Enqueued ${jobs.length} related topic(s) for ${timeline.topic}`);
  } catch (err) {
    console.warn('[queue] Failed to enqueue related topics:', err);
  }
}
