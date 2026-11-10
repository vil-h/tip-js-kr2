import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";
import { createApiClient } from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";
import { createAppController } from "../src/app-controller.js";
import { getVariantFilters } from "../src/variant.js";

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const client = createApiClient({ baseUrl: `http://127.0.0.1:${port}/api` });
const api = createTaskApi(client);
const view = {
  state: null, tasks: [], errors: {}, pending: false,
  setListState(value) { this.state = value; },
  setTasks(value) { this.tasks = value; },
  setCategories() {}, setTotal() {}, setFormTask() {}, notify() {},
  showFormErrors(value) { this.errors = value; },
  setMutationPending(value) { this.pending = value; },
};
const app = createAppController({ api, view });
const ids = (result) => result.tasks.map((task) => task.id);

try {
  await app.start();
  assert.equal(view.tasks.length, 12);
  await app.submit({ title: " ", priority: "low", categoryId: "1" });
  assert.ok(view.errors.title);
  assert.equal((await api.getTasks()).tasks.length, 12);
  console.log("OK: неверная форма не создаёт задачу.");

  const draft = { title: "Проверить повторное нажатие", priority: "low", categoryId: "1" };
  await Promise.all([app.submit(draft), app.submit(draft)]);
  assert.equal((await api.getTasks()).tasks.length, 13);
  assert.equal(view.pending, false);
  console.log("OK: два submit одновременно создают одну задачу.");

  app.beginEdit(1);
  await app.submit({ title: "Новое название", priority: "medium", categoryId: "1" });
  assert.equal((await api.getTaskById(1)).completed, true);
  console.log("OK: редактирование сохраняет выполненный статус.");

  await app.applyFilters({ q: "нет такой записи 12345" });
  assert.equal(view.state, "empty");
  assert.equal(view.tasks.length, 0);
  console.log("OK: пустой поиск показывает empty.");

  await app.applyFilters({ completed: false });
  await app.toggleTask(4);
  assert.ok(!view.tasks.some((task) => task.id === 4));
  console.log("OK: завершённая задача исчезает из текущего фильтра.");

  await new Promise((resolve) => server.close(resolve));
  await app.refresh();
  assert.equal(view.state, "error");
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  await app.refresh();
  assert.equal(view.state, "ready");
  console.log("OK: остановка API даёт error, повтор после запуска — ready.");

  const reloaded = createAppController({ api, view });
  await reloaded.start();
  assert.ok(view.tasks.some((task) => task.title === draft.title));
  console.log("OK: новый контроллер получает сохранённую задачу с сервера.");
  reloaded.destroy();

  // Сценарии из таблицы вариантов
  for (let number = 1; number <= 8; number += 1) {
    await api.resetDemoData();
    const filters = getVariantFilters(number);
    const before = await api.getTasks(filters);
    let targetId = before.tasks[0].id;
    if (number === 1) await api.setTaskCompleted(targetId, true);
    if (number === 2) await api.setTaskCompleted(targetId, false);
    if (number === 3) await api.updateTask(targetId, { priority: "medium" });
    if (number === 5) await api.updateTask(targetId, { categoryId: 2 });
    if ([4, 6, 7, 8].includes(number)) {
      const created = await api.createTask({
        title: "Проверить индивидуальный сценарий",
        priority: number === 8 ? "high" : "medium",
        categoryId: 2,
      });
      targetId = created.id;
      assert.ok(ids(await api.getTasks(filters)).includes(targetId));
      if (number === 8) await api.setTaskCompleted(targetId, true);
    }
    const afterIds = ids(await api.getTasks(filters));
    assert.equal(afterIds.includes(targetId), [4, 6, 7].includes(number));
    console.log(`OK: сценарий варианта ${number}; итоговые id: ${afterIds.join(", ")}.`);
  }
} finally {
  app.destroy();
  await new Promise((resolve) => server.close(resolve));
}
