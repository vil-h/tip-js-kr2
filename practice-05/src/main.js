import { ApiError, buildUrl, createApiClient } from "./api-client.js";
import { createTaskApi } from "./task-api.js";
import { variantFilters, variantNumber } from "./variant.js";

const baseUrl = process.env.API_URL ?? "http://127.0.0.1:5505/api";
const client = createApiClient({ baseUrl });
const api = createTaskApi(client);

function showError(error) {
  if (error instanceof ApiError) {
    console.error(`Ошибка: ${error.kind}; ${error.message}`);
    if (error.status !== null) console.error(`HTTP ${error.status}; код: ${error.code}`);
  } else {
    console.error(error.message);
  }
}

async function showTasks(label, filters) {
  console.log(label);
  console.log("URL:", buildUrl(baseUrl, "/tasks", filters));
  const { tasks, categories, meta } = await api.loadInitialData(filters);
  console.log("Количество:", meta.total);
  console.table(tasks.map((task) => ({
    id: task.id,
    title: task.title,
    completed: task.completed,
    priority: task.priority,
    category: categories.find((category) => category.id === task.categoryId)?.name,
  })));
  console.table(categories);
}

try {
  await showTasks("Общий сценарий", { completed: false, priority: "high" });
  try {
    await api.getTaskById(999);
  } catch (error) {
    showError(error);
  }
  if (variantNumber !== null) {
    await showTasks(`Вариант ${variantNumber}`, variantFilters);
  } else {
    console.log("Индивидуальный вариант пока не указан в src/variant.js.");
  }
} catch (error) {
  showError(error);
  process.exitCode = 1;
}
