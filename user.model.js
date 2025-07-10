// User Model - Sequelize ORM for PostgreSQL
import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
    allowNull: false,
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      quality: 'high',
      audioEnabled: true,
      region: 'auto',
    },
  },
  lastLoginAt: {
    type: DataTypes.DATE,
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false, // No 'updatedAt' field as per spec
});