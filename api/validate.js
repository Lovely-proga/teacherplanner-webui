// Публичный эндпоинт. Вызывается из приложения конечного пользователя,
// чтобы проверить лицензионный ключ. Отдаёт только минимум информации —
// никогда не возвращает всю базу или чужие ключи.

const { getDatabase, withDatabase } = require("./lib/github");
const { evaluateKey } = require("./lib/license");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ valid: false, error: "Метод не поддерживается" });
  }

  const { key, consumeUse } = req.body || {};
  if (!key || typeof key !== "string") {
    return res.status(400).json({ valid: false, error: "Не передан ключ" });
  }

  try {
    if (consumeUse) {
      let result;
      await withDatabase((db) => {
        const entry = db.keys.find((k) => k.key === key);
        result = evaluateKey(entry);
        if (result.valid) {
          entry.uses = (entry.uses || 0) + 1;
          result.remainingUses =
            entry.maxUses != null ? Math.max(entry.maxUses - entry.uses, 0) : null;
        }
      }, `validate+use key ${key}`);
      return res.status(200).json(result);
    }

    const { json } = await getDatabase();
    const entry = json.keys.find((k) => k.key === key);
    return res.status(200).json(evaluateKey(entry));
  } catch (e) {
    return res.status(500).json({ valid: false, error: e.message });
  }
};
