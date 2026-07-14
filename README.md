# 캐치캐치 프론트엔드 협업 가이드

의류 이커머스 "캐치캐치" 프론트엔드 작업 규칙입니다. **작업 시작 전에 꼭 한 번 읽어주세요.**

---

## 1. 폴더 구조

```
frontend/
├── css/
│   ├── common.css      ← 전 페이지 공통 스타일 (⚠️ 리더만 수정)
│   ├── main.css        ← 메인페이지 전용
│   ├── admin.css       ← 관리자 페이지 전용
│   └── (페이지명).css   ← 자기 페이지 전용 CSS는 여기에 새로 만들기
├── js/
│   └── auth.js         ← 공통 인증 모듈 (⚠️ 리더만 수정)
├── main.html           ← ★ 메인페이지 (완성, 참고용). index.html 아님! ★
├── _template.html      ← ★ 일반 페이지 만들 때 복사해서 시작 ★
├── _admin-template.html← ★ 관리자 페이지 만들 때 복사해서 시작 ★
└── README.md           ← 이 문서
```

> **메인페이지는 `main.html` 입니다.** (`index.html`은 옛 초안이라 저장소에 없음)
> 홈/로고 링크는 전부 `main.html`로 연결하세요.

## 2. 페이지 담당 & 파일명 (변경 금지!)

파일명은 서로 링크로 연결돼 있어서 **바꾸면 다른 사람 페이지가 깨집니다.**
`js/auth.js`(공통 인증 모듈)와 `css/common.css`는 **리더만 수정**합니다.

### Key — 거래 흐름 + 인증 인프라 + 관리자(최고 권한)

| 담당 | 파일명 | 페이지 | 기능 ID | 받는 파라미터 |
|------|--------|--------|---------|--------------|
| Key | `main.html` | 메인/홈 ✅완성 | U-MAIN-001~006 | — |
| Key | `js/auth.js` | 공통 인증 모듈(토큰 재발급) ✅완성 | U-AUTH-008 | — |
| Key | `checkout.html` | 결제(주문서) | U-ORDER-001~004 | — |
| Key | `orders.html` | 주문 내역/배송추적/구매확정/교환환불 | U-ORDER-005~010 | `?orderId=` |
| Key | `admin-login.html` | 관리자 로그인 | A-AUTH-001 | — |
| Key | `admin-users.html` | 사용자 관리 | A-USER-001 | — |
| Key | `admin-products.html` | 전체 상품 관리(강제 제재·삭제) | A-PROD-001~002 | — |
| Key | `admin-seller-applications.html` | 사업자 등록 승인/반려 | A-SELLER-001~002 | — |
| Key | `admin-sellers.html` | 입점 업체 상태 관리 | A-SELLER-003 | — |
| Key | `admin-coupons.html` | 쿠폰 발행 승인 | A-COUPON-001~002 | — |
| Key | `admin-points.html` | 포인트 강제 조정 | A-POINT-001~002 | — |
| Key | `admin-qna.html` | Q&A 모니터링 | A-QA-001 | — |
| Key | `admin-settlements.html` | 플랫폼 정산 대시보드 | A-SETTLE-001 | — |

> 로그인/회원가입은 팀원 A·B가 각자 진행 중이라 리더 담당에서 제외. 대신 관리자 축 전체(9페이지·13기능)를 정식으로 가져옴 — 권한 상승·관리자 IDOR·강제조정 등 진단 임팩트가 가장 큰 화면들이라 인증/거래 흐름을 설계한 리더가 맡는 게 자연스러움.

### 팀원 A — 상품·구매 프론트 축 (고난이도, 5페이지)

| 담당 | 파일명 | 페이지 | 기능 ID | 받는 파라미터 |
|------|--------|--------|---------|--------------|
| A | `signup.html` | 회원가입 (추가 담당) | U-AUTH-004~007 | — |
| A | `product-list.html` | 상품목록 | U-MAIN-001 연계 | `?cat=카테고리` `?q=검색어` |
| A | `product-detail.html` | 상품상세 | U-PROD-001~007 | `?id=상품번호` |
| A | `cart.html` | 장바구니 | U-CART-001~003 | — |
| A | `review-write.html` | 리뷰 작성 | U-REVIEW-001 | `?orderId=` |
| A | `wishlist.html` | 위시리스트 | U-HEAD-002 | — | 

### 팀원 B — 판매자 입점·상품·주문 축 (7페이지)

| 담당 | 파일명 | 페이지 | 기능 ID |
|------|--------|--------|---------|
| B | `login.html` | 로그인 (추가 담당) | U-AUTH-001~003 |
| B | `seller-login.html` | 판매자 로그인 | S-AUTH-001~002, 005 |
| B | `seller-entry.html` | 입점 신청(서류 업로드) | S-ENTRY-001~002 |
| B | `seller-products.html` | 내 상품 목록 | S-PROD-001, 005 |
| B | `seller-product-form.html` | 상품 등록/수정 | S-PROD-002~004 |
| B | `seller-orders.html` | 주문 관리 | S-ORDER-001~002 |
| B | `shoppingcart.html` | 장바구니 | U-HEAD-003 |
| B | `storeinfo.html` | 매장안내 페이지 | U-HEAD-004 | 

### 팀원 C — 계정·백오피스 조회/관리 축 (신규, 9페이지)

> C는 새로 합류. **A의 유저 계정 계열 + B의 판매자 백오피스 계열**을 넘겨받음.
> 전부 "조회 + 폼/테이블" 패턴이라 하나 만들면 나머지는 복붙 속도가 남 → 신규 합류자에게 적합.

| 담당 | 파일명 | 페이지 | 기능 ID |
|------|--------|--------|---------|
| C | `mypage.html` | 마이페이지 요약 | U-MY-001~003, 006, 008, 009
| C | `points.html` | 포인트 내역 | U-MY-007
| C | `addresses.html` | 배송지 관리 | U-ADDR-001~004
| C | `notifications.html` | 알림 센터 | U-NOTI-001
| C | `seller-dashboard.html` | 판매자 대시보드 + 쿠폰 발행 요청 | S-DASH-001, S-COUPON-001
| C | `seller-sales.html` | 매출/정산 | S-DASH-002~003
| C | `seller-claims.html` | 교환/환불 관리 | S-CLAIM-001~003
| C | `seller-qna.html` | Q&A 관리 | S-QA-001~003

## 3. 새 페이지 만드는 법 (3단계)

1. **`_template.html`을 복사** → 자기 담당 파일명으로 저장 (예: `login.html`)
2. `<title>`과 `<main>` 안의 내용만 작성
3. 페이지 전용 스타일이 필요하면 `css/login.css`처럼 새 파일을 만들어서 `<head>`에 추가:
   ```html
   <link rel="stylesheet" href="css/common.css">
   <link rel="stylesheet" href="css/login.css">
   ```

### ❌ 하지 말 것
- **헤더/푸터 수정 금지** (템플릿에 "수정 금지" 주석 있음) — 수정 필요하면 리더에게 요청
- **`css/common.css` 수정 금지** — 수정 필요하면 리더에게 요청
- **남의 담당 파일 수정 금지** — 이 세 가지만 지키면 충돌(conflict) 안 납니다
- 색상·폰트를 임의로 새로 정하지 말고 `common.css`의 변수 사용:
  `var(--ink)` 글자색, `var(--point)` 포인트 빨강, `var(--mid)` 회색 등

## 4. Git 작업 순서 (매일 이 순서대로)

### 최초 1회만
```bash
git clone https://github.com/qsbit80/rookiesfrontend.git
cd rookiesfrontend
```

### 작업할 때마다
```bash
# ① 시작 전: 최신 내용 받기 (꼭!)
git checkout main
git pull

# ② 페이지 하나 작업할 브랜치 생성 (처음이면 -b 붙여서 생성)
git checkout -b feature/buy-cart

# ③ 작업 후 저장 — 커밋 메시지에 기능 ID를 넣어주세요
git add .
git commit -m "장바구니 목록 조회 UI 구현 (U-CART-001)"

# ④ 올리기
git push origin feature/buy-cart

# main 파일 업데이트 시 중간에 merge하는 방법
git checkout main
git pull origin main

git checkout feature/login
git merge main
```


### ⑤ PR 올리기
1. github.com에서 repo 열기 → 노란 배너 **"Compare & pull request"** 클릭
2. base: `main` ← compare: `feature/본인브랜치` 확인
3. **Create pull request** → 리더가 확인 후 merge
4. **완료된 페이지는 곧바로 PR 올리세요.** 다 만들고 한꺼번에 올리면 충돌이 몰려서 터집니다.

### 브랜치 이름 규칙
`feature/축이름-페이지명` — 페이지 하나 = 브랜치 하나 = PR 하나

| 담당 | 예시 |
|---|---|
| 리더 | `feature/order-checkout`, `feature/order-history`, `feature/admin-products` |
| 팀원 A | `feature/auth-signup`, `feature/buy-product-detail`, `feature/buy-cart` |
| 팀원 B | `feature/auth-login`, `feature/seller-products`, `feature/seller-orders` |

## 5. 내 페이지 확인하는 법

HTML 파일을 더블클릭해서 브라우저로 열면 됩니다.
(VS Code 쓰면 **Live Server** 확장 설치 → 우클릭 → "Open with Live Server" 추천 — 저장하면 자동 새로고침)

## 6. 질문/문제 생기면

- 충돌(conflict) 났다 → 만지지 말고 리더 호출
- 공통 부분(헤더/푸터/common.css) 바꾸고 싶다 → 리더에게 요청
- 그 외 막히면 → 단톡방에 스크린샷과 함께 질문
