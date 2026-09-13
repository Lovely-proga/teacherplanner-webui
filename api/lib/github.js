// Все обращения к приватному репозиторию идут ТОЛЬКО отсюда, на сервере Vercel.
// GITHUB_TOKEN никогда не отправляется в браузер пользователя.

const API_BASE = "https://api.github.com";

function env() {
  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_FILE_PATH = "database.json",
    GITHUB_BRANCH = "main",
  } = process.env;

  const missing = [];
  if (!GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!GITHUB_OWNER) missing.push("GITHUB_OWNER");
  if (!GITHUB_REPO) missing.push("GITHUB_REPO");
  if (missing.length) {
    throw new Error(`Не заданы переменные окружения: ${missing.join(", ")}`);
  }

  return { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_FILE_PATH, GITHUB_BRANCH };
}

async function githubRequest(path, options = {}) {
  const { GITHUB_TOKEN } = env();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`GitHub API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Читает database.json из репозитория. Возвращает распарсенный JSON и его sha
// (sha нужен GitHub'у, чтобы разрешить перезапись файла).
async function getDatabase() {
  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_FILE_PATH, GITHUB_BRANCH } = env();
  const data = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(
      GITHUB_FILE_PATH
    )}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
  );

  const content = Buffer.from(data.content, "base64").toString("utf-8");
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error("database.json в репозитории содержит некорректный JSON");
  }
  if (!Array.isArray(json.keys)) json.keys = [];
  return { json, sha: data.sha };
}

// Перезаписывает database.json одним коммитом.
async function saveDatabase(json, sha, message) {
  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_FILE_PATH, GITHUB_BRANCH } = env();
  const content = Buffer.from(JSON.stringify(json, null, 2), "utf-8").toString("base64");

  return githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(GITHUB_FILE_PATH)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || "update database.json",
        content,
        sha,
        branch: GITHUB_BRANCH,
      }),
    }
  );
}

// Читает базу, применяет мутацию к объекту в памяти и сохраняет обратно.
// При конфликте версий (409, кто-то успел записать раньше) повторяет попытку.
async function withDatabase(mutator, message) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { json, sha } = await getDatabase();
    const result = await mutator(json);
    try {
      await saveDatabase(json, sha, message);
      return result;
    } catch (e) {
      lastErr = e;
      if (e.status === 409 && attempt < 3) continue;
      throw e;
    }
  }
  throw lastErr;
}

module.exports = { getDatabase, saveDatabase, withDatabase };
