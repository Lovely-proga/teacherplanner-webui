const { checkAdmin } = require("../../../lib/auth");
const { withDatabase } = require("../../../lib/github");

module.exports = async (req, res) => {
  if (!checkAdmin(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  const { key } = req.query;
  const ban = (req.body || {}).ban !== false; // по умолчанию true

  try {
    let updated;
    await withDatabase((db) => {
      const entry = db.keys.find((k) => k.key === key);
      if (!entry) throw Object.assign(new Error("Ключ не найден"), { status: 404 });
      entry.status = ban ? "banned" : "active";
      updated = entry;
    }, `${ban ? "ban" : "unban"} key ${key}`);
    return res.status(200).json({ key: updated });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};
