// navigation.js — 공통 카테고리 메뉴의 현재 선택 상태를 URL에 맞춰 표시
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("nav.cats");
  if (!nav) return;

  const links = [...nav.querySelectorAll("a")];
  links.forEach((link) => {
    link.classList.remove("on");
    link.removeAttribute("aria-current");
  });

  const page = window.location.pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(window.location.search);
  let activeHref = null;

  if (page === "product-list.html") {
    const category = params.get("cat");
    if (category) {
      activeHref = `product-list.html?cat=${category}`;
    } else if (params.get("view") === "best") {
      activeHref = "product-list.html?view=best";
    } else {
      activeHref = "product-list.html";
    }
  } else if (page === "brand.html") {
    activeHref = "brand.html";
  }

  const activeLink = links.find((link) => link.getAttribute("href") === activeHref);
  if (activeLink) {
    activeLink.classList.add("on");
    activeLink.setAttribute("aria-current", "page");
  }
});
