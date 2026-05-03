const DEFAULT_API_URL = "http://localhost:4000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getApiBaseUrl() {
  const configuredUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL);

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  try {
    const apiUrl = new URL(configuredUrl);
    const currentHost = window.location.hostname;

    if (isLoopbackHost(apiUrl.hostname) && !isLoopbackHost(currentHost)) {
      apiUrl.hostname = currentHost;
      return trimTrailingSlash(apiUrl.toString());
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
}
