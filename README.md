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

| 담당 | 파일명 | 페이지 | 받는 파라미터 |
|------|--------|--------|--------------|
| 리더 | `index.html` | 메인/홈 ✅완성 | — |
| 리더 | `product-list.html` | 상품목록 | `?cat=카테고리` `?q=검색어` |
| 팀원 A | `product-detail.html` | 상품상세 | `?id=상품번호` |
| 팀원 A | `cart.html` | 장바구니 | — |
| 팀원 A | `checkout.html` | 주문/결제 | — |
| 팀원 B | `login.html` | 로그인 | — |
| 팀원 B | `signup.html` | 회원가입 | — |
| 팀원 B | `mypage.html` | 마이페이지 | — |
| 여유되면 | `search.html`, `wishlist.html`, `faq.html` | 검색/위시/FAQ | `search.html`은 `?q=` |

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
git clone https://github.com/PM아이디/저장소이름.git
cd 저장소이름
```

### 작업할 때마다
```bash
# ① 시작 전: 최신 내용 받기 (꼭!)
git checkout main
git pull

# ② 내 브랜치로 이동 (처음이면 -b 붙여서 생성)
git checkout -b feature/login

# ③ 작업 후 저장
git add .
git commit -m "로그인 페이지 폼 레이아웃 완성"

# ④ 올리기
git push origin feature/login
```

### ⑤ PR 올리기
1. github.com에서 repo 열기 → 노란 배너 **"Compare & pull request"** 클릭
2. base: `main` ← compare: `feature/본인브랜치` 확인
3. **Create pull request** → 리더가 확인 후 merge

### 브랜치 이름 규칙
`feature/페이지명` — 예: `feature/login`, `feature/cart`, `feature/product-detail`

## 5. 내 페이지 확인하는 법

HTML 파일을 더블클릭해서 브라우저로 열면 됩니다.
(VS Code 쓰면 **Live Server** 확장 설치 → 우클릭 → "Open with Live Server" 추천 — 저장하면 자동 새로고침)

## 6. 질문/문제 생기면

- 충돌(conflict) 났다 → 만지지 말고 리더 호출
- 공통 부분(헤더/푸터/common.css) 바꾸고 싶다 → 리더에게 요청
- 그 외 막히면 → 단톡방에 스크린샷과 함께 질문
