import { createClient } from 'redis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let redisClient;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: config.redis.url,
      keyPrefix: config.redis.keyPrefix
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

// Helper functions for common Redis operations
export const redisSet = async (key, value, expiry = null) => {
  try {
    const client = getRedisClient();
    if (expiry) {
      await client.setEx(key, expiry, JSON.stringify(value));
    } else {
      await client.set(key, JSON.stringify(value));
    }
  } catch (error) {
    logger.error('Redis SET error:', error);
    throw error;
  }
};

export const redisGet = async (key) => {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis GET error:', error);
    throw error;
  }
};

export const redisDel = async (key) => {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.error('Redis DEL error:', error);
    throw error;
  }
};

export { redisClient };
