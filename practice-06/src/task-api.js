import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

export function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

function normalizeFilters(filters) {
  if (!filters || Object.getPrototypeOf(filters) !== Object.prototype) {
    throw new TypeError("Фильтры должны быть объектом.");
  }
  const result = {};
  for (const [key, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(key)) throw new TypeError("Неизвестный фильтр.");
    if (value === undefined || value === null || value === "") continue;
    if (key === "completed" && typeof value !== "boolean") throw new TypeError("Неверный статус.");
    if (key === "priority" && !ALLOWED_PRIORITIES.has(value)) throw new TypeError("Неверный приоритет.");
    if (key === "categoryId" && !isPositiveSafeInteger(value)) throw new TypeError("Неверная категория.");
    if (key === "q") {
      if (typeof value !== "string" || value.trim().length > 100) throw new TypeError("Неверный поиск.");
      if (value.trim()) result.q = value.trim();
    } else {
      result[key] = value;
    }
  }
  return result;
}

function checkId(id) {
  if (!isPositiveSafeInteger(id)) throw new TypeError("Нужен положительный целый id.");
}

function readTask(payload) {
  if (!isTask(payload?.data)) throw invalidResponse("Неверные данные задачи.");
  return payload.data;
}

function readCollection(payload, checkItem) {
  if (!Array.isArray(payload?.data) || !payload.data.every(checkItem)
      || payload.meta?.total !== payload.data.length) {
    throw invalidResponse("Неверный список или количество записей.");
  }
  const ids = payload.data.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw invalidResponse("Повторяются id.");
  return payload.data;
}

export function createTaskApi(client) {
  if (typeof client?.requestJson !== "function") throw new TypeError("Нужен HTTP-клиент.");

  async function getTasks(filters = {}, options = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query, signal: options.signal });
    const tasks = readCollection(payload, isTask);
    if (!payload.meta.filters || typeof payload.meta.filters !== "object" || Array.isArray(payload.meta.filters)) {
      throw invalidResponse("Нет фильтров ответа.");
    }
    return { tasks, meta: payload.meta };
  }

  async function getTaskById(id, options = {}) {
    checkId(id);
    return readTask(await client.requestJson(`/tasks/${id}`, options));
  }

  async function getCategories(options = {}) {
    const payload = await client.requestJson("/categories", options);
    return readCollection(payload, isCategory);
  }

  async function loadInitialData(filters = {}, options = {}) {
    const [result, categories] = await Promise.all([
      getTasks(filters, options), getCategories(options),
    ]);
    return { tasks: result.tasks, categories, meta: result.meta };
  }

  async function createTask(draft, { signal } = {}) {
    return readTask(await client.requestJson("/tasks", { method: "POST", body: draft, signal }));
  }

  async function updateTask(id, changes, { signal } = {}) {
    checkId(id);
    return readTask(await client.requestJson(`/tasks/${id}`, { method: "PATCH", body: changes, signal }));
  }

  async function setTaskCompleted(id, completed, options) {
    if (typeof completed !== "boolean") throw new TypeError("Нужен логический статус.");
    return updateTask(id, { completed }, options);
  }

  async function deleteTask(id, { signal } = {}) {
    checkId(id);
    const result = await client.requestJson(`/tasks/${id}`, { method: "DELETE", signal });
    if (result !== null) throw invalidResponse("После удаления ожидался пустой ответ.");
    return null;
  }

  async function resetDemoData({ signal } = {}) {
    const payload = await client.requestJson("/debug/reset", { method: "POST", signal });
    if (payload?.data?.reset !== true || !Number.isSafeInteger(payload.data.total) || payload.data.total < 0) {
      throw invalidResponse("Нет подтверждения сброса.");
    }
    return payload.data;
  }

  return { getTasks, getTaskById, getCategories, loadInitialData, createTask, updateTask, setTaskCompleted, deleteTask, resetDemoData };
}
