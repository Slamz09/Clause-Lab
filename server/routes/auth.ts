import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars before anything else
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const router = Router();

// Extend session type
declare module 'express-session' {
  interface SessionData {
    tokens?: {
      access_token: string;
      refresh_token?: string;
      expiry_date?: number;
    };
    user?: {
      email: string;
      name: string;
    };
    spreadsheetId?: string;
    driveFolderId?: string;
  }
}

console.log('Loading OAuth with Client ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/auth/callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Debug: show auth URL without redirecting
router.get('/google/debug', (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ authUrl });
});

// Initiate Google OAuth
router.get('/google', (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.redirect('http://localhost:8080?auth=error&message=No+code+provided');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store in session
    req.session.tokens = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined
    };
    req.session.user = {
      email: userInfo.data.email || '',
      name: userInfo.data.name || ''
    };

    res.redirect('http://localhost:8080?auth=success');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('http://localhost:8080?auth=error&message=OAuth+failed');
  }
});

// Check auth status
router.get('/status', (req: Request, res: Response) => {
  if (req.session.tokens && req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user,
      spreadsheetId: req.session.spreadsheetId || null,
      driveFolderId: req.session.driveFolderId || null
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Get authenticated OAuth client
export function getAuthClient(req: Request) {
  if (!req.session.tokens) {
    return null;
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3001/auth/callback'
  );

  client.setCredentials(req.session.tokens);
  return client;
}

export default router;
