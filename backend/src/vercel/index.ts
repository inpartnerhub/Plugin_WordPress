import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from './_app.js';
import { HttpError, createErrorResponse, sendError } from '../lib/http.js';
import { handleWebRequest } from '../netlify/adapter.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: IncomingMessage | Request,
  res?: ServerResponse,
): Promise<Response | void> {
  try {
    const app = await getApp();
    if (res && typeof res.setHeader === 'function') {
      const nodeReq = req as IncomingMessage;
      const qs = nodeReq.url && nodeReq.url.includes('?') ? nodeReq.url.slice(nodeReq.url.indexOf('?')) : '';
      nodeReq.url = `/api/index${qs}`;
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
    console.error(JSON.stringify({ level: 'error', event: 'vercel_handler_error', route: '/api/index', error: err instanceof Error ? err.name : 'unknown' }));
    const httpErr = new HttpError(500, 'internal_error', 'An internal error occurred.');
    if (res && typeof res.setHeader === 'function') {
      sendError(res, httpErr);
      return;
    }
    return createErrorResponse(httpErr);
  }
}

