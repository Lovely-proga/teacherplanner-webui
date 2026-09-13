// Публичный эндпоинт. Вызывается из приложения конечного пользователя,
// чтобы проверить лицензионный ключ. Отдаёт только минимум информации —
// никогда не возвращает всю базу или чужие ключи.

const { getDatabase, withDatabase } = require("./lib/github");

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

function evaluateKey(entry) {
  if (!entry) return { valid: false, reason: "not_found" };
  if (entry.status === "banned") return { valid: false, reason: "banned" };
  if (entry.status === "disabled") return { valid: false, reason: "disabled" };
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  if (
    entry.maxUses !== null &&
    entry.maxUses !== undefined &&
    (entry.uses || 0) >= entry.maxUses
  ) {
    return { valid: false, reason: "max_uses_reached" };
  }
  return {
    valid: true,
    remainingUses: entry.maxUses != null ? Math.max(entry.maxUses - (entry.uses || 0), 0) : null,
    expiresAt: entry.expiresAt || null,
  };
}
