import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

app.listen(port, '127.0.0.1', () => {
  console.log(`VinUni CineBot API running at http://127.0.0.1:${port}`);
});
