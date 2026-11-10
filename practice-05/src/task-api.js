import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isTask(value) {
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

function isCategory(value) {
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

  async function getTasks(filters = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query });
    const tasks = readCollection(payload, isTask);
    if (!payload.meta.filters || typeof payload.meta.filters !== "object" || Array.isArray(payload.meta.filters)) {
      throw invalidResponse("Нет фильтров ответа.");
    }
    return { tasks, meta: payload.meta };
  }

  async function getTaskById(id) {
    checkId(id);
    return readTask(await client.requestJson(`/tasks/${id}`));
  }

  async function getCategories() {
    const payload = await client.requestJson("/categories");
    return readCollection(payload, isCategory);
  }

  async function loadInitialData(filters = {}) {
    const [result, categories] = await Promise.all([
      getTasks(filters), getCategories(),
    ]);
    return { tasks: result.tasks, categories, meta: result.meta };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData };
}
