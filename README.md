# КР2 — JavaScript

Мукаев Вильдан Рустамович, ЭФБО-06-25.

- [ПР5 — HTTP и асинхронность](practice-05/README.md)
- [ПР6 — клиент API](practice-06/README.md)

Вариант 1: невыполненные задачи (`completed: false`).
Индивидуальный сценарий ПР6: http://127.0.0.1:5506/?dataset=variant.

## Запуск

Нужен Node.js 24 и npm. Дополнительные пакеты не нужны.
На этом Mac Node.js установлен в `~/Documents/Codex/Tools/node-v24.22.2-darwin-arm64`.
Перед запуском в терминале выполните:

```sh
export PATH="$HOME/Documents/Codex/Tools/node-v24.22.2-darwin-arm64/bin:$PATH"
```

```sh
cd practice-06
npm start
```

Приложение: http://127.0.0.1:5506/
Проверки: http://127.0.0.1:5506/checks.html

## Проверки

11.11.2026: ПР5 — 57/57, ПР6 — 70/70; собственные проверки обеих работ пройдены.
ПР6 в браузере: 14/14, ошибок нет. Исправлено ожидание карточки в браузерном тесте:
`querySelector` позволяет дождаться ответа API вместо немедленного исключения.

Основа — заготовки [adyshkins/TIP-JS](https://github.com/adyshkins/TIP-JS),
версия `37fd64e6f09e728e60e6304d50eda07c398bbd1c`.
