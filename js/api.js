(function (global) {
  "use strict";

  const BASE = global.CATCHCATCH_API_BASE_URL || "/api/v1";

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

  async function request(method, path, { body, query } = {}) {
    const url = BASE + path + toQuery(query);

    const opts = { method, headers: {} };
    if (body !== undefined && body !== null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    let response;
    try {
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
