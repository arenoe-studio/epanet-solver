function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getPythonApiBaseUrl(requestUrl: string) {
  const env = process.env.PYTHON_API_URL?.trim();
  if (env) {
    return stripTrailingSlash(env);
  }
  return stripTrailingSlash(new URL(requestUrl).origin);
}

export function buildPythonApiUrl(requestUrl: string, path: string) {
  const base = getPythonApiBaseUrl(requestUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
