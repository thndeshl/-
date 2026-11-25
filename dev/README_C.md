# 담당 C (PDF 뷰어) 작업 메모: Phase 1 — 페이지 행 일체형(B안)

기준 문서: `pudin_dev_plan_draft.md` (0-3 안건 11, 3-2, 6-1, 6-3, 6-4, 7장 담당 C)

PDF는 연속 스크롤로 보고, 각 페이지 옆에 그 페이지의 메모 슬롯이 붙어 함께 스크롤됩니다. 이전/다음 버튼은 보조 기능입니다.

## B안 약속 (md 6-1 · 6-4와 반드시 같아야 함)

### 고정 영역 ID

`#toolbar`, `#search-box`, `#pdf-viewer` (`#memo-left`, `#memo-right`는 폐지)

- `#toolbar` 안 맨 앞에 C가 `.viewer-nav`(◀ 이전 · `n / N` · 다음 ▶)를 넣습니다. D의 버튼과 B의 `#search-box`는 그 뒤에 둡니다.
- `#pdf-viewer`는 스크롤 컨테이너입니다. `data-document-id`, `data-pdf-url` 속성에서 문서 ID와 PDF 주소를 읽습니다.

### 페이지 행 (C가 페이지 수만큼 만듦)

```html
<div class="page-row" data-page="n">
  <div class="memo-slot" data-side="left"  data-page="n"></div>   <!-- D가 채움 -->
  <div class="page-canvas-wrap"><canvas></canvas></div>            <!-- C가 채움 -->
  <div class="memo-slot" data-side="right" data-page="n"></div>   <!-- D가 채움 -->
</div>
```

- 행 높이 = 해당 PDF 페이지의 표시 높이. 메모가 넘치면 **슬롯 안에서만** 세로 스크롤합니다.
- `.page-canvas-wrap` 안의 `<canvas>`는 화면 근처일 때만 있습니다. 멀어지면 비워집니다. D는 이 안을 건드리지 않습니다.
- 슬롯은 처음부터 끝까지 그대로 있으므로, D가 넣은 메모는 스크롤해도 지워지지 않습니다.

### 이벤트 (`window`에 `CustomEvent`)

| 이벤트 | detail | 발생 시점 |
|---|---|---|
| `pudin:pagesready` | `{ documentId, totalPages }` | 모든 행과 슬롯을 만든 직후 **1번** |
| `pudin:pagechange` | `{ documentId, page, totalPages }` | 처음 열 때(`pagesready` 바로 뒤), 현재 페이지가 바뀔 때. 같은 페이지면 다시 보내지 않음 |

- 현재 페이지 기준: `#pdf-viewer`의 **세로 중앙선에 걸친 행** (행 사이 틈은 위 행에 포함). 맨 위(scrollTop 0)는 1페이지.
- 리스너는 `viewer.js`보다 **먼저** 등록해야 처음 이벤트를 놓치지 않습니다.

### 함수

- `PudinViewer.goToPage(n)`: 해당 행으로 스크롤합니다. 1~`totalPages` 정수가 아니면 무시하고 `false`, 이동하면 `true`. 호출 직후 `getCurrentPage()`가 `n`을 돌려줍니다.
  - 행 위쪽을 화면 위에 맞추고, 행이 화면 절반보다 낮으면 중앙선에 오도록 가운데로 맞춥니다.
- `PudinViewer.getCurrentPage()`: 현재 페이지 번호 (열기 전이면 `0`).

## 사용 예시

### D (메모)

```js
// viewer.js보다 먼저 로드되는 memo.js
window.addEventListener('pudin:pagesready', async (e) => {
  const { documentId } = e.detail;
  const res = await fetch(`/api/documents/${documentId}/memos`);  // page 없이 = 문서 전체
  for (const m of await res.json()) {
    const slot = document.querySelector(
      `.memo-slot[data-page="${m.page_no}"][data-side="${m.side}"]`);
    if (slot) slot.insertAdjacentHTML('beforeend', `<div class="memo">${m.content}</div>`);
  }
});

// 툴바의 [메모 추가]: 현재 페이지에 추가
const page = PudinViewer.getCurrentPage();
```

### B (검색 결과 클릭)

```js
PudinViewer.goToPage(result.page_no);
```

## 파일

| 경로 | 역할 | md 항목 |
|---|---|---|
| `app/static/js/viewer.js` | 빈 행 생성 → `pagesready`, 근처 페이지만 렌더링, 중앙선 기준 `pagechange`, `PudinViewer`, 툴바 이전/다음 | 6-1, 6-4, 7장 C P1 |
| `app/static/css/workspace.css` | 툴바 + 스크롤 컨테이너, 행 단위 3단 배치, 슬롯 내부 스크롤 | 6-1 그림 |
| `dev/viewer_test.html` | 단독 테스트 페이지. D 흉내(가짜 메모), 이벤트·그려진 페이지 표시, `?autotest=1` 자동 검사 | 7장 C P1 |
| `dev/sample.pdf` | 테스트용 5페이지 PDF | |
| `dev/large.pdf` | 300페이지 PDF (1.2MB) | 7장 C P3 |
| `dev/make_sample_pdf.py` | 위 두 PDF를 만드는 스크립트 (표준 라이브러리만 사용) | |

`app/templates/workspace.html`은 아직 만들지 않았습니다 (아래 "남은 일").

## 실행 방법 (Windows 11)

`file://`로 열면 PDF를 불러오지 못하므로 로컬 서버로 엽니다. FastAPI(8000)와 겹치지 않게 8001을 씁니다.

```powershell
cd pudin
python -m http.server 8001
```

- `http://localhost:8001/dev/viewer_test.html?pdf=large.pdf`
- 자동 검사: `http://localhost:8001/dev/viewer_test.html?pdf=large.pdf&autotest=1` → 오른쪽 아래 패널과 콘솔에 PASS/FAIL (20페이지 이상 PDF 필요)
- PDF 다시 만들기: `python dev/make_sample_pdf.py 300 dev/large.pdf`

콘솔 확인:

```js
PudinViewer.goToPage(10); PudinViewer.getCurrentPage();  // 10
PudinViewer.goToPage(999);                               // false, 무시됨
```

그려진 페이지 번호는 테스트 페이지가 바뀔 때마다 콘솔에 `[test] 그려진 페이지 [...]`로 출력합니다.

## PDF.js

- cdnjs `pdf.js` **3.11.174** (UMD 빌드, `<script>` 한 줄로 `window.pdfjsLib` 생성)
- 버전은 HTML의 `<script src>` 한 곳에만 씁니다. `viewer.js`는 `pdfjsLib.version`을 읽어 같은 버전의 worker 주소를 만듭니다.
- 로드 순서: `pdf.min.js` → `memo.js`(D) → `search.js`(B) → `viewer.js`

## 남은 일

1. **`workspace.html`**: A의 `base.html`에 블록(`title`, `head`, `content`, `scripts`)과 `/static` mount가 생겼습니다. 만들기로 정해지면 `viewer_test.html`의 `.workspace` 구조를 `content`에, 스크립트를 `scripts`에 옮기고 data 속성을 `data-document-id="{{ document.id }}" data-pdf-url="/api/documents/{{ document.id }}/file"`로 바꿉니다. 헤더가 생기면 `.workspace { height: 100vh }`를 줄입니다.
2. **A에게 확인**: `/workspace/{document_id}` 라우트가 넘겨 줄 템플릿 변수 이름, 401일 때 `/login`으로 보낼지.
3. **B `/file` 완성 후**: 실제 문서로 열어 오류 문구(401/403/404)를 확인합니다.
4. **실제 브라우저 창 확인**: 지금까지 헤드리스 Chrome으로만 확인했습니다. Chrome·Edge에서 직접 스크롤해 끊김이 없는지 봅니다.
5. **Phase 3**: 이미지가 많은 실제 강의자료 PDF로 `/file`을 거쳐 1초 기준을 측정합니다. `viewer.js`가 `performance.mark('viewer-open-start')`, `performance.mark('viewer-page-rendered', {detail: {page}})`를 남깁니다.

## 열기 실패 시 메시지

| 상황 | 화면 문구 |
|---|---|
| 401 / 403 | 로그인이 필요하거나 권한이 없는 문서입니다. |
| 404 | 문서를 찾을 수 없습니다. |
| PDF가 아닌 파일, 손상된 파일 | PDF 파일이 아니거나 손상된 파일입니다. |
| 암호 PDF | 암호가 걸린 PDF는 열 수 없습니다. |

## 알려진 한계

- 행 크기를 1페이지 크기로 먼저 잡고 그릴 때 실제 크기로 고칩니다. 페이지 크기가 섞인 PDF에서는 그리는 순간 스크롤이 조금 튈 수 있습니다 (`viewer.js`의 `shortcut:` 주석).
- 마지막 페이지도 화면 위로 올릴 수 있도록 맨 아래에 여백(`.viewer-tail`)이 있습니다.
- cdnjs에 연결되어 있어야 PDF.js가 로드됩니다.
- 범위 밖 기능(확대/축소, 키보드 이동, PDF 본문 검색)은 만들지 않았습니다.
