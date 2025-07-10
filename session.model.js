// Session Model - Sequelize ORM for PostgreSQL
import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  environmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'VREnvironments',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'ended', 'error'),
    defaultValue: 'active',
    allowNull: false,
  },
  startTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  connectionData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    validate: {
      isValidConnectionData(value) {
        if (value.ip && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value.ip)) {
          throw new Error('Invalid IP address format');
        }
        if (value.bandwidth && typeof value.bandwidth !== 'number') {
          throw new Error('Bandwidth must be a number');
        }
        if (value.latency && typeof value.latency !== 'number') {
          throw new Error('Latency must be a number');
        }
      }
    }
  },
  metrics: {
    type: DataTypes.JSONB,
    defaultValue: {
      framesRendered: 0,
      droppedFrames: 0,
      avgLatency: 0,
      totalDataTransferred: 0,
      connectionQuality: 'good'
    },
    validate: {
      isValidMetrics(value) {
        const numericFields = ['framesRendered', 'droppedFrames', 'avgLatency', 'totalDataTransferred'];
        numericFields.forEach(field => {
          if (value[field] !== undefined && typeof value[field] !== 'number') {
            throw new Error(`${field} must be a number`);
          }
        });
      }
    }
  },
  streamingNodeId: {
    type: DataTypes.STRING,
    allowNull: true, // Assigned when session starts streaming
  },
  qualityLevel: {
    type: DataTypes.ENUM('4K', '2K', '1080p', '720p'),
    defaultValue: '2K',
    allowNull: false,
  },
  reconnectAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['environmentId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['startTime']
    },
    {
      fields: ['streamingNodeId']
    }
  ]
});
