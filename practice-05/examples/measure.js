import { createApiServer } from "../api/server.mjs";
import { createApiClient } from "../src/api-client.js";

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const client = createApiClient({ baseUrl: `http://127.0.0.1:${server.address().port}/api` });
const delay = () => client.requestJson("/debug/delay", { query: { ms: 150 } });

try {
  const results = [];
  for (let run = 1; run <= 3; run += 1) {
    let start = performance.now();
    await delay();
    await delay();
    const sequential = performance.now() - start;
    start = performance.now();
    await Promise.all([delay(), delay()]);
    results.push({ run, sequential: +sequential.toFixed(1), parallel: +(performance.now() - start).toFixed(1) });
  }
  console.table(results);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
