const { checkAdmin } = require("../lib/auth");
const { getDatabase, withDatabase } = require("../lib/github");
const crypto = require("crypto");

function generateKey() {
  const segment = () => crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req, res)) return;

  if (req.method === "GET") {
    try {
      const { json } = await getDatabase();
      return res.status(200).json({ keys: json.keys });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const newKey = {
      key: (body.key && String(body.key).trim()) || generateKey(),
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresAt || null,
      maxUses: body.maxUses === "" || body.maxUses == null ? null : Number(body.maxUses),
      uses: 0,
      notes: body.notes || "",
      product: body.product || "",
      owner: body.owner || "",
    };

    try {
      await withDatabase((db) => {
        if (db.keys.some((k) => k.key === newKey.key)) {
          throw Object.assign(new Error("Ключ с таким значением уже существует"), {
            status: 400,
          });
        }
        db.keys.push(newKey);
      }, `add key ${newKey.key}`);
      return res.status(201).json({ key: newKey });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Метод не поддерживается" });
};
