import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './api/routes/auth.routes.js';
import { config } from './config/index.js';
import { AppError } from './utils/AppError.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Centralized Error Handling
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`🚀 Authentication service running on port ${config.port}`);
});