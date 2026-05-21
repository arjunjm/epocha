import Redis from 'ioredis';
const redis = new Redis('rediss://:ytdKdAE4CYPoE043NtBYR8i7ocLEvMHhLAzCaKw1eYI=@redis-timelineapp-dev.redis.cache.windows.net:6380', { tls: {}, connectTimeout: 8000 });
await redis.del('epocha:admin:running', 'epocha:admin:job-pending', 'epocha:admin:job-total', 'epocha:admin:job-log');
console.log('Redis admin state cleared');
redis.disconnect();
