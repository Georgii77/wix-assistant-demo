import logger from '../utils/logger.ts';
import { createClient, type RedisClientType } from 'redis'


const redisInit = async (): Promise<RedisClientType> => {

    if (!process.env.REDIS_URL) {
        throw new Error('Missing REDIS_URL');
        }
    const url = process.env.REDIS_URL;
    
    
    logger.info("Initializing Redis Client for SMS conversation caching");

    const redisClient: RedisClientType = createClient({
        url,
        socket: {
        connectTimeout: 5000,
            reconnectStrategy: (retries) => Math.min(retries * 100, 2000),
            },
            });
    redisClient.on('error', (err) => {
            logger.error({ err }, 'Redis client Initialization error');
            });

    try{
        logger.info('Connecting to Redis for Authentication');
        redisClient.on('connect', () => {
            logger.info('Redis connected — conversation caching established');
            });
        await redisClient.connect();

        return redisClient;
    }
    catch(error)
    {
        logger.error({err: error}, "Redis client failed to initialize");
        throw error;
    }

}

export default redisInit;