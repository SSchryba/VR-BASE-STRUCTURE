import { v4 as uuidv4 } from 'uuid';
import { VRRenderer } from './VRRenderer.js';
import { QualityController } from './QualityController.js';
import { logger } from '../utils/logger.js';
import { redisSet, redisGet, redisDel } from '../config/redis.js';

export class StreamingManager {
  constructor(options = {}) {
    this.vrRenderer = options.vrRenderer;
    this.networkController = options.networkController;
    this.qualityController = options.qualityController;
    this.maxSessions = options.maxSessions || 100;
    
    this.activeSessions = new Map();
    this.sessionMetrics = new Map();
    this.totalSessionCount = 0;
    
    this.isShuttingDown = false;
    
    // Start metrics collection
    this.startMetricsCollection();
  }

  async createSession(options) {
    try {
      const { userId, environmentId, quality = '2K' } = options;
      
      // Check if we can handle more sessions
      if (this.activeSessions.size >= this.maxSessions) {
        throw new Error('Maximum concurrent sessions reached');
      }

      // Check if user already has an active session
      const existingSession = Array.from(this.activeSessions.values())
        .find(session => session.userId === userId);
      
      if (existingSession) {
        throw new Error('User already has an active session');
      }

      const sessionId = uuidv4();
      
      // Load environment data
      const environmentData = await this.loadEnvironment(environmentId);
      
      // Create VR rendering context
      const renderingContext = await this.vrRenderer.createRenderingContext({
        sessionId,
        environmentData,
        quality,
        userId
      });

      // Set up network connection
      const networkConnection = await this.networkController.createConnection({
        sessionId,
        quality
      });

      // Create session object
      const session = {
        id: sessionId,
        userId,
        environmentId,
        quality,
        status: 'initializing',
        createdAt: new Date(),
        renderingContext,
        networkConnection,
        metrics: {
          framesRendered: 0,
          droppedFrames: 0,
          latencyMeasurements: [],
          bandwidthUsage: 0,
          qualityChanges: 0
        }
      };

      // Store session
      this.activeSessions.set(sessionId, session);
      this.sessionMetrics.set(sessionId, {
        startTime: Date.now(),
        frameCount: 0,
        lastFrameTime: Date.now()
      });
      
      this.totalSessionCount++;

      // Cache session in Redis
      await redisSet(`session:${sessionId}`, {
        userId,
        environmentId,
        quality,
        status: 'active',
        nodeId: process.env.NODE_ID || 'node-1'
      }, 3600); // 1 hour TTL

      // Start rendering loop
      this.startRenderingLoop(sessionId);

      // Update session status
      session.status = 'active';
      
      logger.info(`Session created successfully: ${sessionId} for user: ${userId}`);

      return {
        id: sessionId,
        status: session.status,
        streamingUrl: networkConnection.streamingUrl,
        webrtcConfig: networkConnection.webrtcConfig,
        quality: quality
      };
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  async endSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Update status
      session.status = 'ending';

      // Stop rendering
      await this.vrRenderer.destroyRenderingContext(session.renderingContext);

      // Close network connection
      await this.networkController.closeConnection(session.networkConnection);

      // Clean up session data
      this.activeSessions.delete(sessionId);
      this.sessionMetrics.delete(sessionId);
      
      // Remove from Redis
      await redisDel(`session:${sessionId}`);

      logger.info(`Session ended successfully: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to end session:', error);
      throw error;
    }
  }

  async changeSessionQuality(sessionId, newQuality) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.quality === newQuality) {
        return; // No change needed
      }

      logger.info(`Changing session ${sessionId} quality from ${session.quality} to ${newQuality}`);

      // Update rendering context
      await this.vrRenderer.updateRenderingQuality(session.renderingContext, newQuality);

      // Update network connection
      await this.networkController.updateConnectionQuality(session.networkConnection, newQuality);

      // Update session
      session.quality = newQuality;
      session.metrics.qualityChanges++;

      // Update cache
      const sessionData = await redisGet(`session:${sessionId}`);
      if (sessionData) {
        sessionData.quality = newQuality;
        await redisSet(`session:${sessionId}`, sessionData, 3600);
      }

      logger.info(`Session quality changed successfully: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to change session quality:', error);
      throw error;
    }
  }

  startRenderingLoop(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    const renderFrame = async () => {
      try {
        if (!this.activeSessions.has(sessionId) || this.isShuttingDown) {
          return; // Session ended or shutting down
        }

        const startTime = performance.now();

        // Render frame
        const frameData = await this.vrRenderer.renderFrame(session.renderingContext);
        
        // Send frame via network
        await this.networkController.sendFrame(session.networkConnection, frameData);

        // Update metrics
        const renderTime = performance.now() - startTime;
        this.updateSessionMetrics(sessionId, renderTime);

        // Schedule next frame
        const targetFrameTime = 1000 / 90; // 90 FPS
        const nextFrameDelay = Math.max(0, targetFrameTime - renderTime);
        
        setTimeout(renderFrame, nextFrameDelay);
      } catch (error) {
        logger.error(`Rendering error for session ${sessionId}:`, error);
        
        // End session on critical errors
        await this.endSession(sessionId);
      }
    };

    // Start rendering
    renderFrame();
  }

  updateSessionMetrics(sessionId, renderTime) {
    const session = this.activeSessions.get(sessionId);
    const metrics = this.sessionMetrics.get(sessionId);
    
    if (!session || !metrics) {
      return;
    }

    // Update frame metrics
    session.metrics.framesRendered++;
    metrics.frameCount++;
    metrics.lastFrameTime = Date.now();

    // Track render time
    if (renderTime > 11.1) { // More than 11.1ms for 90fps
      session.metrics.droppedFrames++;
    }

    // Adaptive quality adjustment
    if (session.metrics.framesRendered % 100 === 0) { // Every 100 frames
      this.qualityController.analyzePerformance(sessionId, {
        averageRenderTime: renderTime,
        droppedFrameRate: session.metrics.droppedFrames / session.metrics.framesRendered,
        networkLatency: this.getAverageLatency(sessionId)
      });
    }
  }

  async loadEnvironment(environmentId) {
    try {
      // This would typically load from database or cache
      // For now, return mock environment data
      return {
        id: environmentId,
        name: 'Default Environment',
        assets: [],
        settings: {
          lighting: 'natural',
          physics: true,
          interaction: true
        }
      };
    } catch (error) {
      logger.error('Failed to load environment:', error);
      throw error;
    }
  }

  // Metrics and monitoring methods
  getActiveSessionCount() {
    return this.activeSessions.size;
  }

  getTotalSessionCount() {
    return this.totalSessionCount;
  }

  getSessionsByQuality() {
    const qualityCount = {};
    for (const session of this.activeSessions.values()) {
      qualityCount[session.quality] = (qualityCount[session.quality] || 0) + 1;
    }
    return qualityCount;
  }

  getAverageLatency(sessionId = null) {
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.metrics.latencyMeasurements.length > 0) {
        return session.metrics.latencyMeasurements.reduce((a, b) => a + b) / 
               session.metrics.latencyMeasurements.length;
      }
      return 0;
    }

    // Average across all sessions
    let totalLatency = 0;
    let measurementCount = 0;

    for (const session of this.activeSessions.values()) {
      if (session.metrics.latencyMeasurements.length > 0) {
        totalLatency += session.metrics.latencyMeasurements.reduce((a, b) => a + b);
        measurementCount += session.metrics.latencyMeasurements.length;
      }
    }

    return measurementCount > 0 ? totalLatency / measurementCount : 0;
  }

  getAverageFrameRate() {
    let totalFrameRate = 0;
    let sessionCount = 0;

    for (const [sessionId, metrics] of this.sessionMetrics.entries()) {
      const timeDiff = Date.now() - metrics.startTime;
      if (timeDiff > 1000) { // At least 1 second of data
        const frameRate = (metrics.frameCount * 1000) / timeDiff;
        totalFrameRate += frameRate;
        sessionCount++;
      }
    }

    return sessionCount > 0 ? totalFrameRate / sessionCount : 0;
  }

  getDroppedFrameCount() {
    let totalDropped = 0;
    for (const session of this.activeSessions.values()) {
      totalDropped += session.metrics.droppedFrames;
    }
    return totalDropped;
  }

  startMetricsCollection() {
    setInterval(() => {
      const metrics = {
        timestamp: new Date().toISOString(),
        activeSessions: this.getActiveSessionCount(),
        averageLatency: this.getAverageLatency(),
        averageFrameRate: this.getAverageFrameRate(),
        droppedFrames: this.getDroppedFrameCount(),
        sessionsByQuality: this.getSessionsByQuality()
      };

      // Store metrics in Redis for monitoring service
      redisSet('streaming_metrics', metrics, 60); // 1 minute TTL
    }, 5000); // Every 5 seconds
  }

  async shutdown() {
    this.isShuttingDown = true;
    
    logger.info('Shutting down streaming manager...');
    
    // End all active sessions
    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.all(sessionIds.map(id => this.endSession(id)));
    
    logger.info('All sessions ended');
  }
}
