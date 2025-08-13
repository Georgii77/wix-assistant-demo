import {type RedisClientType, createClient} from "redis";


const redisClient: RedisClientType = createClient({
    socket: {
        host: 'redis-14159.c283.us-east-1-4.ec2.redns.redis-cloud.com',
        port: 14159
    },
    username: process.env.REDIS_AUTH_USERNAME || 'default',
    password: process.env.REDIS_AUTH_PASSWORD || '',
});
redisClient.on('error', err => console.log('Redis Client Error', err));

await redisClient.connect();

let messageHistory = await getMessageHistory(redisClient);

console.log

async function getMessageHistory(redisClient: RedisClientType): Promise<Record<string, string | null>> {
  try {

     let cursor = '0';
     const messageHistory: Record<string, string | null> = {};

     do {
   
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor);
    cursor = nextCursor;

    if (Array.isArray(keys) && keys.length > 0 && keys.every(k => typeof k === 'string')) {
      const values = await redisClient.mGet(keys);
      keys.forEach((value, idx) => {
        messageHistory[value] = values[idx];
      });
    }
  } while (cursor !== '0');
 

    return messageHistory;
    
  } catch (error) {
    console.error('Error retrieving message history from Redis:', error);
    throw error;
  }
}