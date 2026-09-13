// Защищённая выдача кода приложения. Файл app-content/teacher-planner.html
// НЕ лежит в /public — значит он не имеет собственного публичного URL и
// не может быть скачан напрямую. Единственный способ его получить — прислать
// сюда действительный лицензионный ключ; тогда мы читаем файл с диска и
// отдаём его как содержимое ответа.

const fs = require("fs");
const path = require("path");
const { getDatabase, withDatabase } = require("./lib/github");
const { evaluateKey } = require("./lib/license");

const APP_FILE = path.join(process.cwd(), "app-content", "teacher-planner.html");

let cachedHtml = null;
function loadAppHtml() {
  // Кэшируем в памяти "тёплого" инстанса функции, чтобы не читать файл с диска
  // на каждый запрос. При новом деплое кэш всё равно сбросится.
  if (!cachedHtml) {
    cachedHtml = fs.readFileSync(APP_FILE, "utf-8");
  }
  return cachedHtml;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const { key, consumeUse } = req.body || {};
  if (!key || typeof key !== "string") {
    return res.status(400).json({ ok: false, error: "missing_key" });
  }

  try {
    let result;
    if (consumeUse) {
      // Первая активация ключа на устройстве — засчитываем использование.
      await withDatabase((db) => {
        const entry = db.keys.find((k) => k.key === key);
        result = evaluateKey(entry);
        if (result.valid) {
          entry.uses = (entry.uses || 0) + 1;
        }
      }, `activate app for key ${key}`);
    } else {
      // Повторная тихая проверка сохранённого на устройстве ключа —
      // использование не списываем, просто убеждаемся, что ключ ещё активен.
      const { json } = await getDatabase();
      const entry = json.keys.find((k) => k.key === key);
      result = evaluateKey(entry);
    }

    if (!result.valid) {
      return res.status(401).json({ ok: false, error: result.reason });
    }

    const html = loadAppHtml();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
