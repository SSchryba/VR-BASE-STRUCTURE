// Model associations and database setup
import { User } from './user.model.js';
import { VREnvironment } from './environment.model.js';
import { Session } from './session.model.js';
import { Asset } from './asset.model.js';
import { StreamingNode } from './streaming-node.model.js';

// User associations
User.hasMany(VREnvironment, { foreignKey: 'adminId', as: 'environments' });
User.hasMany(Session, { foreignKey: 'userId', as: 'sessions' });

// VREnvironment associations
VREnvironment.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });
VREnvironment.hasMany(Asset, { foreignKey: 'environmentId', as: 'assets' });
VREnvironment.hasMany(Session, { foreignKey: 'environmentId', as: 'sessions' });

// Session associations
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Session.belongsTo(VREnvironment, { foreignKey: 'environmentId', as: 'environment' });
Session.belongsTo(StreamingNode, { foreignKey: 'streamingNodeId', as: 'streamingNode', targetKey: 'nodeId' });

// Asset associations
Asset.belongsTo(VREnvironment, { foreignKey: 'environmentId', as: 'environment' });

// StreamingNode associations
StreamingNode.hasMany(Session, { foreignKey: 'streamingNodeId', as: 'sessions', sourceKey: 'nodeId' });

export {
  User,
  VREnvironment,
  Session,
  Asset,
  StreamingNode
};

// Database sync function
export const syncDatabase = async (force = false) => {
  try {
    await User.sync({ force });
    await VREnvironment.sync({ force });
    await StreamingNode.sync({ force });
    await Asset.sync({ force });
    await Session.sync({ force });
    
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Database synchronization failed:', error);
    throw error;
  }
};
