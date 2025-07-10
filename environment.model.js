// VR Environment Model - Sequelize ORM for PostgreSQL
import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const VREnvironment = sequelize.define('VREnvironment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 255],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  adminId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  assets: {
    type: DataTypes.JSONB,
    defaultValue: [],
    validate: {
      isValidAssets(value) {
        if (!Array.isArray(value)) {
          throw new Error('Assets must be an array');
        }
        value.forEach(asset => {
          if (!asset.type || !asset.url || !asset.checksum || typeof asset.size !== 'number') {
            throw new Error('Invalid asset structure');
          }
          if (!['model', 'texture', 'audio'].includes(asset.type)) {
            throw new Error('Invalid asset type');
          }
        });
      }
    }
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      maxUsers: 50,
      allowInteraction: true,
      quality: '2K'
    },
    validate: {
      isValidSettings(value) {
        if (typeof value.maxUsers !== 'number' || value.maxUsers < 1) {
          throw new Error('maxUsers must be a positive number');
        }
        if (!['4K', '2K', '1080p'].includes(value.quality)) {
          throw new Error('Invalid quality setting');
        }
      }
    }
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '1.0.0',
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft',
    allowNull: false,
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['adminId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['name']
    }
  ]
});
