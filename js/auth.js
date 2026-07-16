/* =========================================================
   캐치캐치 공통 인증 모듈 (js/auth.js) — U-AUTH-008
   ---------------------------------------------------------
   ⚠️ 리더만 수정합니다. 팀원은 가져다 쓰기만 하세요.

   로그인 상태 규칙 (login.html에서 로그인 성공 시 저장):
   - sessionStorage 'catchcatch.loggedIn'    = 'true'
   - sessionStorage/localStorage 'catchcatch.accessToken' = 토큰문자열

   페이지에서 쓰는 법:
   1) <head>나 </body> 앞에  <script src="js/auth.js"></script>  추가
   2) 로그인 필요한 페이지 맨 위에서:  CatchAuth.requireLogin();
   3) 로그인 여부 확인:  if (CatchAuth.isLoggedIn()) { ... }
   ========================================================= */
(function (global) {
  "use strict";

  const KEY_FLAG = "catchcatch.loggedIn";
  const KEY_TOKEN = "catchcatch.accessToken";
  const KEY_REFRESH = "catchcatch.refreshToken";

  // 저장된 액세스 토큰을 꺼낸다 (session 우선, 없으면 local).
  function readToken() {
    return sessionStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_TOKEN);
  }

  const CatchAuth = {
    // 로그인 상태인지 확인
    isLoggedIn() {
      return (
        sessionStorage.getItem(KEY_FLAG) === "true" ||
        Boolean(sessionStorage.getItem(KEY_TOKEN)) ||
        Boolean(localStorage.getItem(KEY_TOKEN))
      );
    },

    // 저장된 액세스 토큰 반환 (없으면 null)
    getToken() {
      return readToken();
    },

    // 로그인 응답의 data({ accessToken, refreshToken })를 저장한다.
    // login.js 외에 다른 로그인 경로(판매자/관리자)에서도 재사용 가능.
    saveTokens(data) {
      if (!data) return;
      if (data.accessToken) localStorage.setItem(KEY_TOKEN, data.accessToken);
      if (data.refreshToken) localStorage.setItem(KEY_REFRESH, data.refreshToken);
      sessionStorage.setItem(KEY_FLAG, "true");
    },

    // 로그인 필요한 페이지에서 호출 — 비로그인 시 로그인 페이지로 보냄
    requireLogin() {
      if (!this.isLoggedIn()) {
        const here = location.pathname.split("/").pop() + location.search;
        location.href = "login.html?redirect=" + encodeURIComponent(here);
        return false;
      }
      return true;
    },

    // 로그아웃 — 저장된 상태 비우고 메인으로
    logout() {
      sessionStorage.removeItem(KEY_FLAG);
      sessionStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_REFRESH);
      location.href = "index.html";
    },
  };

  // === 전역 fetch 인터셉터 ===
  // 모든 페이지가 이 auth.js를 (페이지별 스크립트보다 먼저) 로드하므로,
  // 여기서 window.fetch를 한 번 감싸두면 각 페이지 코드를 수정하지 않아도
  // 백엔드(/api/v1/...)로 가는 요청에 자동으로 Authorization: Bearer 헤더가 붙는다.
  // - 같은 백엔드 경로 요청에만 적용 (외부 URL은 건드리지 않음)
  // - 이미 Authorization을 직접 설정한 요청(checkout.js 등)은 덮어쓰지 않음
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const opts = init ? { ...init } : {};
    let url = "";
    try {
      url = typeof input === "string" ? input : (input && input.url) || "";
    } catch (_) { /* noop */ }

    const isApiCall = url.indexOf("/api/v1/") !== -1;
    const token = readToken();

    if (isApiCall && token && typeof input === "string") {
      const headers = new Headers(opts.headers || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", "Bearer " + token);
        opts.headers = headers;
        return originalFetch(input, opts);
      }
    }
    return originalFetch(input, init);
  };

  // 헤더 공통 처리: 페이지 로드 시 자동 실행
  document.addEventListener("DOMContentLoaded", () => {
    const loggedIn = CatchAuth.isLoggedIn();

    // 마이페이지 아이콘: 비로그인 시 로그인 페이지로 우회
    const mypageLink = document.getElementById("mypageLink");
    if (mypageLink) {
      mypageLink.addEventListener("click", (e) => {
        if (!loggedIn) {
          e.preventDefault();
          location.href = "login.html?redirect=mypage.html";
        }
      });
    }

    // 상단 로그인/회원가입 ↔ 로그아웃 전환 (CSS가 body 클래스로 처리)
    if (loggedIn) document.body.classList.add("is-member");

    // 상단 유틸리티 메뉴: 비회원은 로그인/회원가입, 회원은 마이페이지/로그아웃을 표시
    document.querySelectorAll("[data-auth-guest]").forEach((el) => {
      el.hidden = loggedIn;
    });
    document.querySelectorAll("[data-auth-member]").forEach((el) => {
      el.hidden = !loggedIn;
    });

    // 판매자로 로그인했을 때만 상단 카테고리에 '판매 관리' 노출
    const isSeller = loggedIn && sessionStorage.getItem("catchcatch.loginType") === "seller";
    document.querySelectorAll("[data-seller-only]").forEach((el) => {
      el.hidden = !isSeller;
    });

    // 로그아웃 버튼(있으면) 연결
    document.querySelectorAll("[data-logout]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        CatchAuth.logout();
      });
    });
  });

  global.CatchAuth = CatchAuth;
})(window);
