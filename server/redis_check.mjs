import Redis from 'ioredis';
const redis = new Redis('rediss://:ytdKdAE4CYPoE043NtBYR8i7ocLEvMHhLAzCaKw1eYI=@redis-timelineapp-dev.redis.cache.windows.net:6380', { tls: {}, connectTimeout: 8000 });
const running = await redis.get('epocha:admin:running');
const pending = await redis.get('epocha:admin:job-pending');
const total = await redis.get('epocha:admin:job-total');
const logs = await redis.lrange('epocha:admin:job-log', -5, -1);
console.log('running:', running, '| pending:', pending, '| total:', total);
console.log('last 5 logs:', logs);
redis.disconnect();
