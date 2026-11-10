import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) return "Не удалось выполнить операцию.";
  if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  if (error.kind === "network") return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  if (error.kind === "invalid-response") return "Сервер вернул ответ неожиданного формата.";
  if (error.kind === "http" && error.status === 404) return "Запись уже отсутствует на сервере. Обновите список.";
  if (error.kind === "http") return error.message || `Сервер вернул ошибку ${error.status}.`;
  return "Не удалось выполнить операцию.";
}

export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  const apiMethods = ["loadInitialData", "getTasks", "createTask", "updateTask", "setTaskCompleted", "deleteTask", "resetDemoData"];
  const viewMethods = ["setListState", "setTasks", "setCategories", "setTotal", "setFormTask", "showFormErrors", "setMutationPending", "notify"];
  if (apiMethods.some((name) => typeof api?.[name] !== "function")
      || viewMethods.some((name) => typeof view?.[name] !== "function")
      || typeof validateDraft !== "function") {
    throw new TypeError("Нужны API, представление и проверка формы.");
  }

  let tasks = [];
  let categories = [];
  let categoriesLoaded = false;
  let filters = {};
  let editingId = null;
  let activeLoad = null;
  let loadNumber = 0;
  let mutationPending = false;
  let destroyed = false;

  // Загрузка
  async function loadTasks() {
    if (destroyed) return;
    activeLoad?.abort();
    activeLoad = new AbortController();
    const number = ++loadNumber;
    const options = { signal: activeLoad.signal };
    view.setListState("loading");
    try {
      const result = categoriesLoaded
        ? await api.getTasks(filters, options)
        : await api.loadInitialData(filters, options);
      if (destroyed || number !== loadNumber) return;
      if (!categoriesLoaded) {
        categories = result.categories;
        categoriesLoaded = true;
        view.setCategories(categories);
      }
      tasks = result.tasks;
      view.setTasks(tasks, categories);
      view.setTotal(result.meta.total);
      view.setListState(tasks.length ? "ready" : "empty");
      if (mutationPending) view.setMutationPending(true);
    } catch (error) {
      if (destroyed || number !== loadNumber || error.kind === "aborted") return;
      view.setListState("error", messageForError(error));
    }
  }

  function cancelEdit() {
    editingId = null;
    view.setFormTask(null);
    view.showFormErrors({});
  }

  // Изменение данных
  async function mutate(action, message, clearForm = false) {
    if (destroyed || mutationPending) return;
    mutationPending = true;
    view.setMutationPending(true);
    try {
      await action();
      if (destroyed) return;
      if (clearForm) cancelEdit();
      view.notify(message, "success");
      await loadTasks();
    } catch (error) {
      if (!destroyed && error.kind !== "aborted") view.notify(messageForError(error), "error");
    } finally {
      mutationPending = false;
      if (!destroyed) view.setMutationPending(false);
    }
  }

  return {
    start(initialFilters = {}) {
      filters = { ...initialFilters };
      return loadTasks();
    },
    applyFilters(nextFilters) {
      filters = { ...nextFilters };
      return loadTasks();
    },
    refresh: loadTasks,
    async submit(draft) {
      if (mutationPending || destroyed) return;
      const result = validateDraft(draft, categories);
      view.showFormErrors(result.errors);
      if (!result.valid) return;
      const id = editingId;
      await mutate(
        () => id === null ? api.createTask(result.value) : api.updateTask(id, result.value),
        id === null ? "Задача добавлена." : "Изменения сохранены.",
        true,
      );
    },
    beginEdit(id) {
      if (mutationPending || destroyed) return;
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      editingId = id;
      view.showFormErrors({});
      view.setFormTask(task);
    },
    cancelEdit,
    async toggleTask(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      await mutate(() => api.setTaskCompleted(id, !task.completed), "Статус изменён.");
    },
    async deleteTask(id) {
      await mutate(() => api.deleteTask(id), "Задача удалена.", editingId === id);
    },
    async resetData() {
      await mutate(() => api.resetDemoData(), "Исходные данные восстановлены.", true);
    },
    destroy() {
      destroyed = true;
      loadNumber += 1;
      activeLoad?.abort();
    },
  };
}
