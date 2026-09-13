// Простая проверка админ-токена. Панель отправляет его в заголовке
// Authorization: Bearer <ADMIN_TOKEN>. Сравнение через timingSafeEqual,
// чтобы не палить токен через тайминг-атаку.

const crypto = require("crypto");

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkAdmin(req, res) {
  if (!process.env.ADMIN_TOKEN) {
    res.status(500).json({ error: "ADMIN_TOKEN не настроен на сервере" });
    return false;
  }

  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token || !safeEqual(token, process.env.ADMIN_TOKEN)) {
    res.status(401).json({ error: "Неверный или отсутствующий токен администратора" });
    return false;
  }
  return true;
}

module.exports = { checkAdmin };
