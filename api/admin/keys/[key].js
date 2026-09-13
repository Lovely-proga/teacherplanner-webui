const { checkAdmin } = require("../../lib/auth");
const { withDatabase } = require("../../lib/github");

const EDITABLE_FIELDS = ["status", "expiresAt", "maxUses", "notes", "product", "owner", "uses"];

module.exports = async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { key } = req.query;

  if (req.method === "PUT") {
    const updates = req.body || {};
    try {
      let updated;
      await withDatabase((db) => {
        const entry = db.keys.find((k) => k.key === key);
        if (!entry) throw Object.assign(new Error("Ключ не найден"), { status: 404 });
        for (const field of EDITABLE_FIELDS) {
          if (field in updates) {
            entry[field] =
              (field === "maxUses" || field === "uses") &&
              updates[field] !== null &&
              updates[field] !== ""
                ? Number(updates[field])
                : updates[field];
          }
        }
        updated = entry;
      }, `update key ${key}`);
      return res.status(200).json({ key: updated });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      let existed = false;
      await withDatabase((db) => {
        const before = db.keys.length;
        db.keys = db.keys.filter((k) => k.key !== key);
        existed = db.keys.length !== before;
      }, `delete key ${key}`);
      if (!existed) return res.status(404).json({ error: "Ключ не найден" });
      return res.status(200).json({ deleted: true });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Метод не поддерживается" });
};
