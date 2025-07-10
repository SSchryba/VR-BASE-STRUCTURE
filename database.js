import { Sequelize } from 'sequelize';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let sequelize;

export const connectDatabase = async () => {
  try {
    sequelize = new Sequelize(config.database.url, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: config.database.ssl ? {
          require: true,
          rejectUnauthorized: false
        } : false
      },
      logging: config.nodeEnv === 'development' ? 
        (msg) => logger.debug(msg) : false,
      pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      retry: {
        max: 3
      }
    });

    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
};

export const getDatabase = () => {
  if (!sequelize) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return sequelize;
};

export { sequelize };
