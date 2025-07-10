// Streaming Node Model - Tracks available streaming servers
import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const StreamingNode = sequelize.define('StreamingNode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nodeId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  hostname: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIP: true,
    }
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'maintenance', 'overloaded'),
    defaultValue: 'offline',
    allowNull: false,
  },
  capabilities: {
    type: DataTypes.JSONB,
    defaultValue: {
      maxConcurrentSessions: 100,
      supportedQualities: ['4K', '2K', '1080p', '720p'],
      gpuCount: 1,
      cpuCores: 16,
      memoryGB: 64,
      encodingFormats: ['H264', 'H265', 'VP9']
    }
  },
  currentLoad: {
    type: DataTypes.JSONB,
    defaultValue: {
      activeSessions: 0,
      cpuUsage: 0,
      gpuUsage: 0,
      memoryUsage: 0,
      networkBandwidth: 0
    }
  },
  lastHeartbeat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '1.0.0',
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['nodeId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['region']
    },
    {
      fields: ['lastHeartbeat']
    }
  ]
});
