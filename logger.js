import winston from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'vr-streaming',
    version: process.env.SERVICE_VERSION || '1.0.0',
    nodeId: process.env.NODE_ID || 'unknown'
  },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Console transport for development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Create performance logger for metrics
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/performance.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Helper functions for structured logging
export const loggers = {
  // Authentication events
  auth: {
    login: (userId, ip, userAgent) => logger.info('User login', { 
      event: 'user_login', userId, ip, userAgent 
    }),
    logout: (userId, sessionDuration) => logger.info('User logout', { 
      event: 'user_logout', userId, sessionDuration 
    }),
    failed: (email, ip, reason) => logger.warn('Login failed', { 
      event: 'login_failed', email, ip, reason 
    }),
    tokenRefresh: (userId) => logger.info('Token refreshed', { 
      event: 'token_refresh', userId 
    })
  },
  
  // Session events
  session: {
    created: (sessionId, userId, environmentId, quality) => logger.info('Session created', {
      event: 'session_created', sessionId, userId, environmentId, quality
    }),
    ended: (sessionId, duration, reason) => logger.info('Session ended', {
      event: 'session_ended', sessionId, duration, reason
    }),
    qualityChanged: (sessionId, oldQuality, newQuality, trigger) => logger.info('Quality changed', {
      event: 'quality_changed', sessionId, oldQuality, newQuality, trigger
    }),
    error: (sessionId, error, context) => logger.error('Session error', {
      event: 'session_error', sessionId, error: error.message, context
    })
  },
  
  // Performance events
  performance: {
    frameRate: (sessionId, fps, target) => performanceLogger.info('Frame rate', {
      event: 'frame_rate', sessionId, fps, target, timestamp: Date.now()
    }),
    latency: (sessionId, latency, target) => performanceLogger.info('Latency', {
      event: 'latency', sessionId, latency, target, timestamp: Date.now()
    }),
    bandwidth: (sessionId, bandwidth, quality) => performanceLogger.info('Bandwidth', {
      event: 'bandwidth', sessionId, bandwidth, quality, timestamp: Date.now()
    }),
    resourceUsage: (nodeId, cpu, memory, gpu) => performanceLogger.info('Resource usage', {
      event: 'resource_usage', nodeId, cpu, memory, gpu, timestamp: Date.now()
    })
  },
  
  // Security events
  security: {
    suspiciousActivity: (userId, activity, ip, details) => logger.warn('Suspicious activity', {
      event: 'suspicious_activity', userId, activity, ip, details
    }),
    rateLimitExceeded: (ip, endpoint, limit) => logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded', ip, endpoint, limit
    }),
    authenticationFailed: (attempts, ip, timeWindow) => logger.warn('Multiple auth failures', {
      event: 'auth_failures', attempts, ip, timeWindow
    })
  },
  
  // Business events
  business: {
    userRegistration: (userId, source) => logger.info('User registered', {
      event: 'user_registration', userId, source
    }),
    environmentCreated: (environmentId, adminId, assets) => logger.info('Environment created', {
      event: 'environment_created', environmentId, adminId, assetCount: assets.length
    }),
    paymentProcessed: (userId, amount, currency, subscriptionType) => logger.info('Payment processed', {
      event: 'payment_processed', userId, amount, currency, subscriptionType
    })
  }
};

// Performance monitoring middleware
export const performanceMiddleware = (serviceName) => {
  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      logger.info('Request completed', {
        event: 'request_completed',
        service: serviceName,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    });
    
    next();
  };
};

// Error logging helper
export const logError = (error, context = {}) => {
  logger.error('Application error', {
    event: 'application_error',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  });
};

// Graceful shutdown logger
export const logShutdown = (signal, reason) => {
  logger.info('Application shutdown', {
    event: 'application_shutdown',
    signal,
    reason,
    timestamp: new Date().toISOString()
  });
};
