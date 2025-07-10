import { Router } from 'express';
import { login, refresh, getProfile } from '../../controllers/auth.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js'; // Placeholder for JWT validation

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', login);

// POST /api/auth/refresh
authRouter.post('/refresh', refresh);

// GET /api/auth/profile
authRouter.get('/profile', authMiddleware, getProfile);

// POST /api/auth/logout - Note: Logout is typically handled client-side by deleting tokens.
authRouter.post('/logout', (req, res) => {
  // Optional: Add token to a blacklist in Redis
  res.status(200).json({ message: 'Logged out successfully' });
});