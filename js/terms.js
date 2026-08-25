(() => {
  const terms = {
    "user-terms": ["이용약관", "서비스 이용과 회원의 권리·의무에 관한 기본 약관입니다."],
    "seller-terms": ["판매자 이용약관", "판매자 서비스 이용과 상품 판매에 관한 기본 약관입니다."],
    privacy: ["개인정보 수집·이용 동의", "회원가입과 서비스 제공에 필요한 개인정보의 수집·이용 항목을 안내합니다."],
    settlement: ["정산·수수료 정책", "판매 수수료와 정산 절차에 관한 안내입니다."],
    marketing: ["마케팅 정보 수신 동의", "이벤트와 혜택 안내 수신에 관한 선택 동의입니다."]
  };
  const selected = terms[new URLSearchParams(location.search).get("type")] || ["약관 안내", "선택한 약관 정보를 확인해 주세요."];
  document.title = selected[0] + " — 캐치캐치";
  document.getElementById("termsTitle").textContent = selected[0];
  document.getElementById("termsHeading").textContent = selected[0];
  document.getElementById("termsBody").textContent = selected[1] + "\n\n세부 약관은 서비스 운영 정책 확정 후 이 화면에 게시됩니다.";
})();
