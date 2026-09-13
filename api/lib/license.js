// Общая логика проверки статуса ключа. Используется и публичным /api/validate,
// и защищённой выдачей кода приложения в /api/app-content.

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

module.exports = { evaluateKey };
