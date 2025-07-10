import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../../../shared/models/user.model.js';
import { config } from '../config/index.js';
import { redisSet, redisGet, redisDel } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import { sendEmail } from '../utils/email.js';

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessTokenExpiry }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTokenExpiry }
  );

  return { accessToken, refreshToken };
};

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (existingUser) {
      throw new AppError('User with this email or username already exists', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // Create user
    const user = await User.create({
      username,
      email,
      passwordHash,
      role: 'user'
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await redisSet(`email_verification:${verificationToken}`, user.id, 3600); // 1 hour

    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify your VR Streaming account',
      template: 'verify-email',
      data: {
        username,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`
      }
    });

    logger.info(`User registered successfully: ${user.id}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AppError('Please verify your email before logging in', 401);
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token in Redis
    await redisSet(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 3600); // 7 days

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    logger.info(`User logged in successfully: ${user.id}`);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        preferences: user.preferences
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    // Check if token exists in Redis
    const storedToken = await redisGet(`refresh_token:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Find user
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);

    // Update refresh token in Redis
    await redisSet(`refresh_token:${user.id}`, newRefreshToken, 7 * 24 * 3600);

    res.json({
      success: true,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Remove refresh token from Redis
    await redisDel(`refresh_token:${userId}`);

    // Add access token to blacklist
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);
      await redisSet(`blacklisted_token:${token}`, true, expiryTime);
    }

    logger.info(`User logged out successfully: ${userId}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, we\'ve sent a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    await redisSet(`password_reset:${resetToken}`, user.id, 3600); // 1 hour

    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Reset your VR Streaming password',
      template: 'reset-password',
      data: {
        username: user.username,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
      }
    });

    res.json({
      success: true,
      message: 'If an account with that email exists, we\'ve sent a password reset link.'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Verify reset token
    const userId = await redisGet(`password_reset:${token}`);
    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // Update password
    await user.update({ passwordHash });

    // Remove reset token
    await redisDel(`password_reset:${token}`);

    // Invalidate all user sessions
    await redisDel(`refresh_token:${userId}`);

    logger.info(`Password reset successfully: ${userId}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // Verify email token
    const userId = await redisGet(`email_verification:${token}`);
    if (!userId) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Mark email as verified
    await user.update({ emailVerified: true });

    // Remove verification token
    await redisDel(`email_verification:${token}`);

    logger.info(`Email verified successfully: ${userId}`);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// OAuth controllers (placeholder implementations)
export const googleAuth = (req, res, next) => {
  // Implement Google OAuth flow
  res.json({ message: 'Google OAuth not implemented yet' });
};

export const googleCallback = (req, res, next) => {
  // Handle Google OAuth callback
  res.json({ message: 'Google OAuth callback not implemented yet' });
};
