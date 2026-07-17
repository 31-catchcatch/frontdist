/* =========================================================
   캐치캐치 공통 API 모듈 (js/api.js)
   ---------------------------------------------------------
   일반 사용자(구매자) 화면용 fetch 래퍼.
   admin-api.js 를 일반 사용자용으로 미러링한 것.

   ⚠️ 반드시 auth.js 다음에 로드할 것.
      auth.js 의 전역 fetch 인터셉터가 먼저 설치돼야
      /api/v1/ 요청에 Authorization: Bearer 가 자동으로 붙는다.
      또한 그 인터셉터는 fetch(문자열URL, opts) 형태에서만 동작하므로
      이 모듈은 항상 URL 을 문자열로 넘긴다. (new Request 금지)

   응답 규약:
   - ApiResponse = { success, message, data }  (data 가 null 이면 필드 자체가 없음)
   - PageResponse = { content, page(0-index), size, totalElements, totalPages, last }
     단, QnA 만 content 대신 qnaList 를 쓴다 → page() 가 흡수한다.

   사용법:
     const list = await CatchApi.get("/products", { page:0, size:12, sort:"createdAt,desc" });
     const page = await CatchApi.page("/products", { ... });
   ========================================================= */
(function (global) {
  "use strict";

  // BASE 결정 (1곳에서만) — 더 이상 각 파일이 localhost:8080 을 박을 이유가 없다.
  const BASE = (function () {
    if (global.CATCHCATCH_API_BASE_URL) return global.CATCHCATCH_API_BASE_URL;
    // file:// 직접 열기 또는 Live Server(5500) 프리뷰 → 백엔드 직접 호출
    if (location.protocol === "file:" || location.port === "5500") {
      return "http://localhost:8080/api/v1";
    }
    return "/api/v1"; // nginx 단일 오리진 (기본)
  })();

  // 이미지 없을 때 쓰는 인라인 SVG 플레이스홀더 (외부 요청 0)
  const PLACEHOLDER =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">' +
        '<rect width="400" height="500" fill="#f2f2f2"/>' +
        '<path d="M140 190h120l-14 150a8 8 0 0 1-8 7h-76a8 8 0 0 1-8-7z" fill="#dcdcdc"/>' +
        '<path d="M170 190a30 30 0 0 1 60 0" fill="none" stroke="#dcdcdc" stroke-width="10"/>' +
        '<text x="200" y="420" text-anchor="middle" fill="#b0b0b0" font-family="sans-serif" font-size="18">이미지 준비중</text>' +
      "</svg>"
    );

  class ApiError extends Error {
    constructor(message, status) {
      super(message || "요청 처리 중 오류가 발생했습니다.");
      this.name = "ApiError";
      this.status = status;
    }
  }

  // 쿼리 객체 → "?a=1&b=2" (null/undefined/"" 는 스킵)
  // 값이 배열이면 같은 key 를 여러 번 붙인다 (예: sort=a,desc&sort=id,desc)
  function toQuery(query) {
    if (!query) return "";
    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      const value = query[key];
      if (value === null || value === undefined || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v !== null && v !== undefined && v !== "") params.append(key, v);
        });
      } else {
        params.append(key, value);
      }
    });
    const s = params.toString();
    return s ? "?" + s : "";
  }

  // 코어: ApiResponse 봉투를 벗기고 data 를 반환
  async function request(method, path, { body, query } = {}) {
    const url = BASE + path + toQuery(query);

    const opts = { method, headers: {} };
    if (body !== undefined && body !== null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    let response;
    try {
      // ⚠️ url 은 반드시 문자열 (auth.js 인터셉터 조건)
      response = await fetch(url, opts);
    } catch (networkError) {
      throw new ApiError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      /* 본문이 비어있을 수 있음 (예: 204) */
    }

    if (!response.ok || (payload && payload.success === false)) {
      const message = (payload && payload.message) || "요청이 실패했습니다.";
      throw new ApiError(message, response.status);
    }

    // data 필드가 없으면(=null 이라 JsonInclude 로 빠짐) null 반환
    return payload ? (payload.data !== undefined ? payload.data : null) : null;
  }

  const CatchApi = {
    BASE,
    PLACEHOLDER,
    ApiError,

    get(path, query) {
      return request("GET", path, { query });
    },
    post(path, body, query) {
      return request("POST", path, { body, query });
    },
    del(path, query) {
      return request("DELETE", path, { query });
    },

    // 목록 조회 → PageResponse 를 항상 동일 구조로 정규화.
    // QnA 특례(content 대신 qnaList)와 data:null 을 여기서 한 번에 흡수한다.
    async page(path, query) {
      const data = await request("GET", path, { query });
      const body = data || {};
      const content = Array.isArray(body)
        ? body
        : body.content || body.qnaList || body.list || [];
      const page = body.page || 0;
      const totalPages = body.totalPages || 0;
      return {
        content,
        page,
        size: body.size || content.length,
        totalElements: body.totalElements != null ? body.totalElements : content.length,
        totalPages,
        last: body.last != null ? body.last : page + 1 >= totalPages,
      };
    },

    // HTML escape (admin-ui.js 와 동일 동작)
    escape(value) {
      if (value === null || value === undefined) return "";
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    // 원화 표기 "12,000원"
    won(n) {
      const num = Number(n);
      return Number.isFinite(num) ? num.toLocaleString("ko-KR") + "원" : "-";
    },

    // 이미지 URL → 비어있으면 플레이스홀더
    thumb(url) {
      return url ? url : PLACEHOLDER;
    },
  };

  global.CatchApi = CatchApi;
})(window);
