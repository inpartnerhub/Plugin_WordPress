import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from './_app.js';
import { handleWebRequest } from '../netlify/adapter.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: (IncomingMessage & { query?: Record<string, string | string[]> }) | Request,
  res?: ServerResponse,
): Promise<Response | void> {
  try {
    const app = await getApp();
    if (res && typeof res.setHeader === 'function') {
      const nodeReq = req as IncomingMessage & { query?: Record<string, string | string[]> };
      const segments = Array.isArray(nodeReq.query?.path)
        ? nodeReq.query.path.join('/')
        : (nodeReq.query?.path as string) || '';
      const qs = nodeReq.url && nodeReq.url.includes('?') ? nodeReq.url.slice(nodeReq.url.indexOf('?')) : '';
      nodeReq.url = segments ? `/api/${segments}${qs}` : (nodeReq.url || '/');
      return await new Promise((resolve, reject) => {
        res.on('finish', resolve);
        res.on('close', resolve);
        res.on('error', reject);
        try {
          app(nodeReq, res);
        } catch (e) {
          reject(e);
        }
      });
    }
    return await handleWebRequest(req as Request, app);
  } catch (err) {
    console.error('Vercel Function Error ([...path]):', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (res && typeof res.setHeader === 'function') {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { code: 'internal_error', message: msg } }));
      }
      return;
    }
    return new Response(JSON.stringify({ error: { code: 'internal_error', message: msg } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
