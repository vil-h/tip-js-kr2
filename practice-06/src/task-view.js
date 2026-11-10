const PRIORITY_LABELS = { low: "Низкий", medium: "Средний", high: "Высокий" };

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

// Карточка
export function createTaskElement(task, category) {
  const card = document.createElement("li");
  card.className = "task-card";
  card.classList.toggle("is-completed", task.completed);
  card.dataset.taskId = task.id;

  const title = element("h3", "task-title", task.title);
  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(
    element("span", "task-status", task.completed ? "Выполнена" : "В работе"),
    element("span", "task-priority", `Приоритет: ${PRIORITY_LABELS[task.priority]}`),
    element("span", "task-category", category?.name ?? "Неизвестная категория"),
  );

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const labels = {
    toggle: task.completed ? "Вернуть в работу" : "Завершить",
    edit: "Изменить",
    delete: "Удалить",
  };
  for (const [action, label] of Object.entries(labels)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.setAttribute("aria-label", `${label}: ${task.title}`);
    button.append(element("span", "action-label", label));
    actions.append(button);
  }
  card.append(title, meta, actions);
  return card;
}

export function renderTaskList(list, tasks, categories) {
  const cards = tasks.map((task) => {
    const category = categories.find((item) => item.id === task.categoryId);
    return createTaskElement(task, category);
  });
  list.replaceChildren(...cards);
}
