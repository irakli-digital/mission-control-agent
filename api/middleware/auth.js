import config from '../config.js';

export function authMiddleware(req, res, next) {
  // Skip auth for health endpoint
  if (req.path === '/api/health') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');

  if (user === config.adminUser && pass === config.adminPass) {
    return next();
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
