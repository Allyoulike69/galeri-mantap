/* Pages Function: /api/count — dijalankan di runtime Cloudflare Workers. */
import { handleCountRequest } from './_counter.js';

export const onRequest = ({ request, env }) => handleCountRequest(request, env);
