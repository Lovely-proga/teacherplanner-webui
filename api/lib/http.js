// Извлекает IP-адрес клиента из заголовков запроса. На Vercel реальный IP
// приходит в x-forwarded-for (может быть списком через запятую — берём первый).

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = { getClientIp };
