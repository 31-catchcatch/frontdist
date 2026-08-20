(function (global) {
  "use strict";

  const BASE = "/api/v1/admin";

  async function request(method, path, body) {
    const headers = Object.assign({ Accept: "application/json" }, AdminAuth.authorizationHeader());
    const options = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(BASE + path, options);

    if (response.status === 401 || response.status === 403) {
      if (AdminAuth.getToken()) {
        AdminAuth.logout();
      }
      throw new Error("관리자 인증이 필요합니다. 다시 로그인해 주세요.");
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok || (payload && payload.success === false)) {
      throw new Error((payload && payload.message) || "요청을 처리하지 못했습니다.");
    }
    return payload ? payload.data : null;
  }

  const AdminApi = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body ?? {}),
    put: (path, body) => request("PUT", path, body ?? {}),
    patch: (path, body) => request("PATCH", path, body ?? {}),
    del: (path) => request("DELETE", path),

    async list(path) {
      const data = await request("GET", path);
      if (data && Array.isArray(data.content)) return data.content;
      return Array.isArray(data) ? data : [];
    },
  };

  global.AdminApi = AdminApi;
})(window);
