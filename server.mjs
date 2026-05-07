import path from 'path';
import { startServer, __dirname } from './app-core.mjs';

const PORT = process.env.PORT || 3210;
const HOST = process.env.HOST || '0.0.0.0';

await startServer({
  port: PORT,
  host: HOST,
  staticRoot: path.join(__dirname, 'public')
});

console.log(`AI API tester running at http://${HOST}:${PORT}`);
