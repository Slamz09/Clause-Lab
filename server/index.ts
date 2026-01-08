import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';

// Load .env from server directory first, then fallback to parent
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
// Also try parent directory as fallback
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint (remove in production)
app.get('/debug/env', (req, res) => {
  res.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasSessionSecret: !!process.env.SESSION_SECRET
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Google OAuth callback: http://localhost:${PORT}/auth/callback`);
});
