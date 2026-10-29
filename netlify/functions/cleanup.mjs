// Every hour: delete the hashed-IP counters older than their window, requests older than 30 days and daily totals
// older than 13 months — so what the privacy policy promises holds even when nobody visits or signs in.
import { purgeCounters, COUNTERS, listRequests, readStats } from '../lib/store.mjs';

export default async () => {
  await Promise.all(COUNTERS.map(([family, ttl]) => purgeCounters(family, ttl)));
  await listRequests(); // drops requests past the retention window as it reads
  await readStats(1); // drops daily totals past 400 days as it reads
};

export const config = { schedule: '@hourly' };
