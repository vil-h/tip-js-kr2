export class ApiError extends Error {
  constructor(message, {
    kind,
    status = null,
    code = null,
    details = null,
    url = null,
    cause,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

function checkBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string") throw new TypeError("Нужен адрес API.");
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash) {
    throw new TypeError("Нужен HTTP-адрес без параметров и якоря.");
  }
  return url.href.replace(/\/+$/, "");
}

// Адрес запроса
export function buildUrl(baseUrl, path, query = {}) {
  const base = checkBaseUrl(baseUrl);
  if (typeof path !== "string" || !path.trim() || /^[a-z][a-z0-9+.-]*:/i.test(path)
      || path.startsWith("//") || /[?#\\]/.test(path)) {
    throw new TypeError("Нужен относительный путь без параметров.");
  }
  if (!query || Object.getPrototypeOf(query) !== Object.prototype) {
    throw new TypeError("Параметры должны быть обычным объектом.");
  }
  const url = new URL(base + "/" + path.replace(/^\/+|\/+$/g, ""));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url.href;
}

function checkTimeout(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("Время ожидания должно быть положительным целым числом.");
  }
}

export function createApiClient({ baseUrl, fetchFn = globalThis.fetch, timeoutMs = 2000 } = {}) {
  const base = checkBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") throw new TypeError("Нужна функция fetch.");
  checkTimeout(timeoutMs);

  async function requestJson(path, { query = {}, signal, timeoutMs: waitMs = timeoutMs } = {}) {
    checkTimeout(waitMs);
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      throw new TypeError("Нужен AbortSignal.");
    }
    const url = buildUrl(base, path, query);
    const headers = { Accept: "application/json" };

    const timer = AbortSignal.timeout(waitMs);
    const combined = signal ? AbortSignal.any([signal, timer]) : timer;

    function connectionError(cause) {
      if (cause instanceof ApiError) return cause;
      if (combined.aborted) {
        const external = signal?.aborted && combined.reason === signal.reason;
        return new ApiError(external ? "Запрос отменён." : "Истекло время ожидания.", {
          kind: external ? "aborted" : "timeout", url, cause,
        });
      }
      return new ApiError("Нет соединения с сервером.", { kind: "network", url, cause });
    }

    // Получение ответа
    let response;
    try {
      combined.throwIfAborted();
      response = await fetchFn(url, { method: "GET", headers, signal: combined });
    } catch (cause) {
      throw connectionError(cause);
    }
    if (!(response instanceof Response)) {
      throw new ApiError("Ожидался HTTP-ответ.", { kind: "invalid-response", url });
    }

    // Ошибка сервера
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        // Статус сохраняется даже без JSON.
      }
      const error = payload?.error;
      throw new ApiError(typeof error?.message === "string" ? error.message : `HTTP ${response.status}`, {
        kind: "http", status: response.status,
        code: typeof error?.code === "string" ? error.code : null,
        details: error?.details ?? null, url,
      });
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new ApiError("Ожидался JSON.", { kind: "invalid-response", url });
    }
    try {
      return await response.json();
    } catch (cause) {
      if (combined.aborted) throw connectionError(cause);
      throw new ApiError("Не удалось прочитать JSON.", { kind: "invalid-response", url, cause });
    }
  }

  return { requestJson };
}
