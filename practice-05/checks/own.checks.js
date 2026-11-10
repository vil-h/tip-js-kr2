import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";
import { createApiClient } from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";
import { getVariantFilters } from "../src/variant.js";

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
const client = createApiClient({ baseUrl });
const api = createTaskApi(client);

try {
  // Своя комбинация
  const result = await api.getTasks({ completed: false, categoryId: 2, q: "  фильтры API  " });
  assert.deepEqual(result.tasks.map((task) => task.id), [28]);
  assert.equal(result.meta.total, 1);
  console.log("OK: три фильтра вместе — id 28.");

  // Неизвестный адрес
  await assert.rejects(() => client.requestJson("/unknown-resource"), (error) => {
    assert.equal(error.kind, "http");
    assert.equal(error.status, 404);
    assert.ok(error.code);
    return true;
  });
  console.log("OK: неизвестный адрес — HTTP 404.");

  // Отмена до запроса
  let calls = 0;
  const fakeClient = createApiClient({ baseUrl, fetchFn: async () => { calls += 1; } });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => fakeClient.requestJson("/tasks", { signal: controller.signal }),
    (error) => error.kind === "aborted");
  assert.equal(calls, 0);
  console.log("OK: заранее отменённый запрос не вызывает fetch.");

  const expected = [[4, 7, 13, 19, 22, 28, 34], [1, 10, 16, 25, 31], [4, 13, 16, 25, 34],
    [1, 10, 19, 28], [1, 7, 13], [4, 16, 22, 25, 28, 34], [7, 16], [4, 34]];
  for (let number = 1; number <= 8; number += 1) {
    const { tasks, meta } = await api.getTasks(getVariantFilters(number));
    assert.deepEqual(tasks.map((task) => task.id), expected[number - 1]);
    assert.equal(meta.total, expected[number - 1].length);
    console.log(`OK: фильтр варианта ${number} — id ${tasks.map((task) => task.id).join(", ")}.`);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
