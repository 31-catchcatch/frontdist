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

  const CatchAuth = {
    // 로그인 상태인지 확인
    isLoggedIn() {
      return (
        sessionStorage.getItem(KEY_FLAG) === "true" ||
        Boolean(sessionStorage.getItem(KEY_TOKEN)) ||
        Boolean(localStorage.getItem(KEY_TOKEN))
      );
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
      location.href = "index.html";
    },
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
