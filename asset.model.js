// Asset Model for VR Environment Assets
import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Asset = sequelize.define('Asset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  environmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'VREnvironments',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('model', 'texture', 'audio', 'script', 'animation'),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isUrl: true,
    }
  },
  cdnUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true,
    }
  },
  checksum: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [32, 128], // Support MD5, SHA256, etc.
    }
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: false,
    validate: {
      min: 0,
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  compressionType: {
    type: DataTypes.ENUM('none', 'gzip', 'brotli', 'custom'),
    defaultValue: 'none',
  },
  loadPriority: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    validate: {
      min: 1,
      max: 1000,
    }
  },
  status: {
    type: DataTypes.ENUM('uploading', 'processing', 'ready', 'error'),
    defaultValue: 'uploading',
    allowNull: false,
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['environmentId']
    },
    {
      fields: ['type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['loadPriority']
    }
  ]
});
