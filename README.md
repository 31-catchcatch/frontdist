# 캐치캐치 프론트엔드 협업 가이드

의류 이커머스 "캐치캐치" 프론트엔드 작업 규칙입니다. **작업 시작 전에 꼭 한 번 읽어주세요.**

---

## 1. 폴더 구조

```
frontend/
├── css/
│   ├── common.css      ← 전 페이지 공통 스타일 (⚠️ 수정 금지, 리더만 수정)
│   ├── main.css        ← 메인페이지 전용
│   └── (페이지명).css   ← 자기 페이지 전용 CSS는 여기에 새로 만들기
├── index.html          ← 메인페이지 (완성, 참고용으로 보세요)
├── _template.html      ← ★ 새 페이지 만들 때 이걸 복사해서 시작 ★
└── README.md           ← 이 문서
```

## 2. 페이지 담당 & 파일명 (변경 금지!)

파일명은 서로 링크로 연결돼 있어서 **바꾸면 다른 사람 페이지가 깨집니다.**
`js/auth.js`(공통 인증 모듈)와 `css/common.css`는 **리더만 수정**합니다.

### 리더 — 거래 흐름 + 인증 인프라 (최고 난이도)

| 담당 | 파일명 | 페이지 | 기능 ID | 받는 파라미터 |
|------|--------|--------|---------|--------------|
| 리더 | `index.html` | 메인/홈 ✅완성 | U-MAIN-001~006 | — |
| 리더 | `login.html` | 로그인 | U-AUTH-001~003 | — |
| 리더 | `signup.html` | 회원가입 | U-AUTH-004~007 | — |
| 리더 | `js/auth.js` | 공통 인증 모듈(토큰 재발급) | U-AUTH-008 | — |
| 리더 | `checkout.html` | 결제(주문서) | U-ORDER-001~004 | — |
| 리더 | `orders.html` | 주문 내역/배송추적/구매확정/교환환불 | U-ORDER-005~010 | `?orderId=` |

### 팀원 A — 상품·장바구니 + 유저 계정

| 담당 | 파일명 | 페이지 | 기능 ID | 받는 파라미터 |
|------|--------|--------|---------|--------------|
| A | `product-list.html` | 상품목록 | U-MAIN-001 연계 | `?cat=카테고리` `?q=검색어` |
| A | `product-detail.html` | 상품상세 | U-PROD-001~007 | `?id=상품번호` |
| A | `cart.html` | 장바구니 | U-CART-001~003 | — |
| A | `review-write.html` | 리뷰 작성 | U-REVIEW-001 | `?orderId=` |
| A | `mypage.html` | 마이페이지 요약 | U-MY-001~003, 006, 008, 009 | — |
| A | `payment-methods.html` | 결제수단 관리 | U-MY-004~005 | — |
| A | `points.html` | 포인트 내역 | U-MY-007 | — |
| A | `addresses.html` | 배송지 관리 | U-ADDR-001~004 | — |
| A | `notifications.html` | 알림 센터 | U-NOTI-001 | — |

### 팀원 B — 판매자 축 전체

| 담당 | 파일명 | 페이지 | 기능 ID |
|------|--------|--------|---------|
| B | `seller-login.html` | 판매자 로그인 | S-AUTH-001~002, 005 |
| B | `seller-signup.html` | 판매자 회원가입 | S-AUTH-003~004 |
| B | `seller-entry.html` | 입점 신청(서류 업로드) | S-ENTRY-001~002 |
| B | `seller-products.html` | 내 상품 목록 | S-PROD-001, 005 |
| B | `seller-product-form.html` | 상품 등록/수정 | S-PROD-002~004 |
| B | `seller-orders.html` | 주문 관리 | S-ORDER-001~002 |
| B | `seller-dashboard.html` | 대시보드 + 쿠폰 발행 요청 | S-DASH-001, S-COUPON-001 |
| B | `seller-sales.html` | 매출/정산 | S-DASH-002~003 |
| B | `seller-claims.html` | 교환/환불 관리 | S-CLAIM-001~003 |
| B | `seller-qna.html` | Q&A 관리 | S-QA-001~003 |

### 3순위 — 관리자 13개 (A-*), 먼저 끝낸 사람이 가져가기

로그인·사용자·상품·입점·쿠폰·포인트·Q&A·정산 관리 페이지. 시간 남으면 진행.

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
| 리더 | `feature/auth-login`, `feature/order-checkout`, `feature/order-history` |
| 팀원 A | `feature/buy-product-detail`, `feature/buy-cart`, `feature/my-addresses` |
| 팀원 B | `feature/seller-login`, `feature/seller-products`, `feature/seller-orders` |

## 5. 내 페이지 확인하는 법

HTML 파일을 더블클릭해서 브라우저로 열면 됩니다.
(VS Code 쓰면 **Live Server** 확장 설치 → 우클릭 → "Open with Live Server" 추천 — 저장하면 자동 새로고침)

## 6. 질문/문제 생기면

- 충돌(conflict) 났다 → 만지지 말고 리더 호출
- 공통 부분(헤더/푸터/common.css) 바꾸고 싶다 → 리더에게 요청
- 그 외 막히면 → 단톡방에 스크린샷과 함께 질문
