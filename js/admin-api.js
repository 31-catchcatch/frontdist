/* =========================================================
   캐치캐치 admin-api.js — 관리자 페이지 공용 API 호출 헬퍼
   ---------------------------------------------------------
   - 모든 요청 경로는 /api/v1/admin 기준 (예: AdminApi.get("/users"))
   - AdminAuth 토큰을 Authorization 헤더로 자동 부착
   - 응답 봉투 { success, message, data } 를 벗겨 data 만 반환
   - 실패 시 message 로 throw → 페이지에서 catch 해서 안내
   - 401/403(토큰 만료 등) 이면 관리자 로그인으로 이동
   전제: admin-auth.js 가 먼저 로드되어 window.AdminAuth 가 있어야 함.
   ========================================================= */
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
      // 토큰이 있었는데 거부 = 만료/무효 → 재로그인.
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

    /** 목록 조회: PageResponse.content 또는 List 를 배열로 반환 */
    async list(path) {
      const data = await request("GET", path);
      if (data && Array.isArray(data.content)) return data.content;
      return Array.isArray(data) ? data : [];
    },
  };

  global.AdminApi = AdminApi;
})(window);
