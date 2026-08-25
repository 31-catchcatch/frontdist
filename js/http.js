(function (global) {
  "use strict";

  if (global.CatchHttp) return;

  const nativeFetch = global.fetch.bind(global);

  const CSRF_COOKIE = "XSRF-TOKEN";
  const CSRF_HEADER = "X-XSRF-TOKEN";
  const SAFE_METHODS = ["GET", "HEAD", "OPTIONS", "TRACE"];

  const HINT_KEYS = ["catchcatch.loggedIn", "catchcatch.adminLoggedIn"];
  const TYPE_KEYS = ["catchcatch.loginType"];


  function apiBase() {
    return global.CATCHCATCH_API_BASE_URL || "/api/v1";
  }


  function apiPath(url) {
    try {
      const abs = new URL(url, location.href);
      const base = new URL(apiBase(), location.href);
      if (abs.origin !== base.origin) return "";
      return abs.pathname.indexOf("/api/v1/") === 0 ? abs.pathname : "";
    } catch (_) {
      return "";
    }
  }

  function isSafeMethod(method) {
    return SAFE_METHODS.indexOf(String(method || "GET").toUpperCase()) >= 0;
  }

  function readStored(key) {
    let v = null;
    try { v = localStorage.getItem(key); } catch (_) {  }
    if (v) return v;
    try { v = sessionStorage.getItem(key); } catch (_) {  }
    return v;
  }

  function removeStored(key) {
    try { localStorage.removeItem(key); } catch (_) {  }
    try { sessionStorage.removeItem(key); } catch (_) {  }
  }

  function hasSessionHint() {
    return HINT_KEYS.some(function (k) { return readStored(k) === "true"; });
  }

  function clearSessionHints() {
    HINT_KEYS.concat(TYPE_KEYS).forEach(removeStored);
  }

  function readCsrfToken() {
    const m = document.cookie.match(new RegExp("(?:^|;\s*)" + CSRF_COOKIE + "=([^;]*)"));
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
  }

  let csrfAttempted = false;
  let csrfInFlight = null;

  function primeCsrf() {
    if (csrfInFlight) return csrfInFlight;
    if (csrfAttempted) return Promise.resolve();
    csrfAttempted = true;
    csrfInFlight = nativeFetch(apiBase() + "/auth/csrf", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .catch(function () {  })
      .then(function () { csrfInFlight = null; });
    return csrfInFlight;
  }

  let refreshInFlight = null;
  let refreshGen = 0;

  function refresh() {
    if (refreshInFlight) return refreshInFlight;

    const headers = new Headers({ Accept: "application/json" });
    const csrf = readCsrfToken();
    if (csrf) headers.set(CSRF_HEADER, csrf);

    refreshInFlight = nativeFetch(apiBase() + "/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: headers,
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) clearSessionHints();
        return res.ok;
      })
      .catch(function () { return false; })
      .then(function (ok) {
        if (ok) refreshGen += 1;
        refreshInFlight = null;
        return ok;
      });

    return refreshInFlight;
  }


  const NO_RETRY_PATHS = [
    "/api/v1/auth/refresh",
    "/api/v1/auth/user/login",
    "/api/v1/auth/seller/login",
    "/api/v1/auth/user/logout",
  ];

  function isNoRetry(path, method) {
    if (NO_RETRY_PATHS.indexOf(path) >= 0) return true;
    return path === "/api/v1/admin/users" && method === "POST";
  }

  async function apiFetch(url, opts, path) {
    const method = String(opts.method || "GET").toUpperCase();

    opts.credentials = "include";


    const headers = new Headers(opts.headers || {});

    if (!isSafeMethod(method)) {
      let csrf = readCsrfToken();
      if (!csrf) {
        await primeCsrf();
        csrf = readCsrfToken();
      }
      if (csrf) headers.set(CSRF_HEADER, csrf);
    }
    opts.headers = headers;

    const genAtSend = refreshGen;

    const res = await nativeFetch(url, opts);

    if (res.status !== 401) return res;
    if (opts.skipAuthRetry || opts._retried) return res;
    if (isNoRetry(path, method)) return res;
    if (!hasSessionHint()) return res;


    if (refreshGen === genAtSend) await refresh();

    const retryOpts = Object.assign({}, opts, { _retried: true });
    const retryHeaders = new Headers(headers);
    if (!isSafeMethod(method)) {
      const csrf = readCsrfToken();
      if (csrf) retryHeaders.set(CSRF_HEADER, csrf);
    }
    retryOpts.headers = retryHeaders;


    return nativeFetch(url, retryOpts);
  }

  global.fetch = function (input, init) {

    const stringish =
      typeof input === "string" || (typeof URL !== "undefined" && input instanceof URL);
    if (!stringish) return nativeFetch(input, init);

    const url = String(input);
    const path = apiPath(url);
    if (!path) return nativeFetch(input, init);

    return apiFetch(url, init ? Object.assign({}, init) : {}, path);
  };

  global.CatchHttp = {
    apiBase: apiBase,
    apiPath: apiPath,
    hasSessionHint: hasSessionHint,
    clearSessionHints: clearSessionHints,
    readCsrfToken: readCsrfToken,
    primeCsrf: primeCsrf,
    refresh: refresh,
    raw: nativeFetch,
  };
})(window);
