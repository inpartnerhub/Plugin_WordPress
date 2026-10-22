import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from './_app.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const qs = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = `/api/chat${qs}`;
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }));
  }
}

