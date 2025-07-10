import jwt from 'jsonwebtoken';
import { User } from '../../../shared/models/user.model.js';
import { config } from '../config/index.js';
import { redisGet } from '../config/redis.js';
import { AppError } from '../utils/AppError.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted
    const isBlacklisted = await redisGet(`blacklisted_token:${token}`);
    if (isBlacklisted) {
      throw new AppError('Token is blacklisted', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    if (decoded.type !== 'access') {
      throw new AppError('Invalid token type', 401);
    }

    // Find user
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    // Check if user is active
    if (user.status === 'inactive') {
      throw new AppError('Account is inactive', 401);
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

export const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }
  next();
};

export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    
    if (decoded.type === 'access') {
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['passwordHash'] }
      });
      
      if (user && user.status !== 'inactive') {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // Ignore auth errors in optional middleware
  }
  
  next();
};
