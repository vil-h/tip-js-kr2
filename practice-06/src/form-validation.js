const PRIORITIES = ["low", "medium", "high"];

export function validateTaskDraft(draft, categories) {
  const title = typeof draft?.title === "string" ? draft.title.trim() : "";
  const priority = draft?.priority;
  const rawCategory = draft?.categoryId;
  const categoryId = typeof rawCategory === "string" || typeof rawCategory === "number"
    ? Number(rawCategory) : NaN;
  const errors = {};

  if (!title || title.length > 100) errors.title = "Введите название от 1 до 100 символов.";
  if (!PRIORITIES.includes(priority)) errors.priority = "Выберите приоритет.";
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0
      || !categories.some((category) => category.id === categoryId)) {
    errors.categoryId = "Выберите существующую категорию.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    value: { title, priority, categoryId },
    errors,
  };
}
