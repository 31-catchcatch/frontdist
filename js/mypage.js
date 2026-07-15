// mypage.js — 회원 유형에 맞는 회원정보 수정 페이지로 연결
document.addEventListener("DOMContentLoaded", () => {
  const accountEditLink = document.querySelector('[data-role="account-edit-link"]');
  if (!accountEditLink) return;

  const loginType = sessionStorage.getItem("catchcatch.loginType");
  accountEditLink.href = loginType === "seller"
    ? "seller-mypage-edit.html"
    : "mypage-edit.html";
});
