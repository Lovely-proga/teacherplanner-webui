// Защищённая выдача кода приложения. HTML приложения зашит в
// app-content/teacher-planner.b64.js (base64) и подключается через обычный
// require() — так сборщик Vercel гарантированно включает его в бандл функции,
// без зависимости от includeFiles / чтения файлов с диска в рантайме.
// Файл app-content/teacher-planner.b64.js НЕ лежит в /public — своего
// публичного URL не имеет. Получить его содержимое можно только через этот
// эндпоинт, и только с действительным лицензионным ключом.

const { getDatabase, withDatabase } = require("./lib/github");
const { evaluateKey, recordActivation } = require("./lib/license");
const { getClientIp } = require("./lib/http");
const encodedApp = require("../app-content/teacher-planner.b64.js");

let cachedHtml = null;
function loadAppHtml() {
  if (!cachedHtml) {
    cachedHtml = Buffer.from(encodedApp, "base64").toString("utf-8");
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

    // Строгое сравнение с true: любое иное значение (undefined, false,
    // случайно пришедшая строка и т.п.) трактуется как "тихая проверка",
    // без списания использования. Это именно то, что вызывается при каждой
    // перезагрузке страницы для уже сохранённого на устройстве ключа.
    if (consumeUse === true) {
      const ip = getClientIp(req);
      const userAgent = req.headers["user-agent"] || "unknown";
      await withDatabase((db) => {
        const entry = db.keys.find((k) => k.key === key);
        result = evaluateKey(entry);
        if (result.valid) {
          entry.uses = (entry.uses || 0) + 1;
          recordActivation(entry, ip, userAgent);
          result.remainingUses =
            entry.maxUses != null ? Math.max(entry.maxUses - entry.uses, 0) : null;
        }
      }, `activate app for key ${key} from ${ip}`);
    } else {
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
