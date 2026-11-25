// 담당 C: PDF 뷰어 — 페이지 행 일체형(B안), md 6-1 · 6-4
// 필요 조건: 이 파일보다 먼저 PDF.js(pdf.min.js)가 로드되어 window.pdfjsLib가 있어야 한다.
// 입력: #pdf-viewer 의 data-document-id, data-pdf-url
// 출력: #pdf-viewer 안의 .page-row 행들, #toolbar 안의 .viewer-nav (C 전용 영역)
//       window 이벤트 'pudin:pagesready' {documentId, totalPages}
//       window 이벤트 'pudin:pagechange' {documentId, page, totalPages}
//       window.PudinViewer.goToPage(n), getCurrentPage()
(function () {
  'use strict';

  var root = document.getElementById('pdf-viewer');  // 스크롤 컨테이너
  if (!root || !window.pdfjsLib) {
    console.error('[viewer] #pdf-viewer 또는 pdfjsLib가 없습니다.');
    return;
  }

  // worker 버전을 로드된 pdf.min.js 버전에 맞춘다 (버전 고정은 HTML의 <script> 한 곳에서만)
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/pdf.worker.min.js';

  var PAGE_SHARE = 0.5;       // 페이지 폭 = 행 폭의 절반, 나머지는 좌우 메모 슬롯
  var MIN_PAGE_WIDTH = 200;

  var state = {
    documentId: Number(root.dataset.documentId),
    pdf: null,
    page: 0,          // 0 = 아직 열리지 않음
    totalPages: 0,
    scale: 1,
    baseWidth: 0,     // 1페이지 크기 (scale 1 기준)
    baseRatio: 0,
    width: 0
  };
  var pages = [];            // pages[n-1] = { n, row, wrap, job, renderedScale }
  var visible = new Set();   // 지금 화면에 걸친 페이지 번호
  var tail = document.createElement('div');  // 마지막 페이지도 맨 위로 올릴 수 있게 하는 여백
  tail.className = 'viewer-tail';

  // #toolbar 안 C 전용 영역: 이전/다음은 goToPage(현재±1)을 부르는 보조 기능
  var nav = document.createElement('div');
  nav.className = 'viewer-nav';
  nav.innerHTML =
    '<button type="button" class="viewer-prev" aria-label="이전 페이지">◀ 이전</button>' +
    '<span class="viewer-status" aria-live="polite">불러오는 중…</span>' +
    '<button type="button" class="viewer-next" aria-label="다음 페이지">다음 ▶</button>';
  var toolbar = document.getElementById('toolbar');
  if (toolbar) toolbar.prepend(nav);
  var prevBtn = nav.querySelector('.viewer-prev');
  var nextBtn = nav.querySelector('.viewer-next');
  var status = nav.querySelector('.viewer-status');
  prevBtn.addEventListener('click', function () { goToPage(state.page - 1); });
  nextBtn.addEventListener('click', function () { goToPage(state.page + 1); });
  prevBtn.disabled = nextBtn.disabled = true;

  root.replaceChildren();

  // ── 현재 페이지 ─────────────────────────────────────────────

  // 페이지 상태 변경의 유일한 입구 (스크롤 감지, goToPage 모두 detectPage → 여기)
  function setPage(n) {
    if (n === state.page) return;  // 같은 페이지면 이벤트를 다시 보내지 않는다
    state.page = n;
    status.textContent = n + ' / ' + state.totalPages;
    prevBtn.disabled = n <= 1;
    nextBtn.disabled = n >= state.totalPages;
    window.dispatchEvent(new CustomEvent('pudin:pagechange', {
      detail: { documentId: state.documentId, page: n, totalPages: state.totalPages }
    }));
  }

  // #pdf-viewer 세로 중앙선에 걸친 행 = 현재 페이지 (행 사이 틈은 위 행에 포함)
  function detectPage() {
    if (!pages.length) return;
    if (root.scrollTop <= 0) return setPage(1);
    var y = root.scrollTop + root.clientHeight / 2;
    var lo = 0, hi = pages.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (pages[mid].row.offsetTop <= y) lo = mid; else hi = mid - 1;
    }
    setPage(lo + 1);
  }

  // 행 위쪽을 화면 위에 맞추되, 행이 화면 절반보다 낮으면 중앙선에 오도록 가운데 맞춤
  function scrollTargetOf(n) {
    var row = pages[n - 1].row;
    var gap = parseFloat(getComputedStyle(root).rowGap) || 0;
    return Math.max(0, Math.min(row.offsetTop - gap / 2,
      row.offsetTop + row.offsetHeight / 2 - root.clientHeight / 2));
  }

  function goToPage(n) {
    n = Number(n);
    if (!Number.isInteger(n) || n < 1 || n > state.totalPages) return false;  // 범위 밖은 무시
    root.scrollTop = scrollTargetOf(n);
    detectPage();  // 바로 반영해 직후 getCurrentPage()가 n을 돌려준다. 뒤따르는 scroll 이벤트는 같은 페이지라 무시됨
    return true;
  }

  function getCurrentPage() {
    return state.page;
  }

  // ── 렌더링: 화면에 보이는 페이지와 앞뒤 1페이지만 그린다 ─────

  function sizeRow(p, w, h) {
    p.wrap.style.width = w + 'px';
    p.wrap.style.height = h + 'px';
    p.row.style.height = h + 'px';   // 행 높이 = 페이지 표시 높이 (슬롯이 넘쳐도 행은 안 커짐)
    if (p.n === state.totalPages) sizeTail();
  }

  function sizeTail() {
    var last = pages[pages.length - 1].row;
    tail.style.height = Math.max(0, root.clientHeight - last.offsetHeight) + 'px';
  }

  function renderPage(p) {
    if (p.job || p.renderedScale === state.scale) return;
    var job = p.job = { scale: state.scale, task: null };
    state.pdf.getPage(p.n).then(function (page) {
      if (p.job !== job) return;  // 그리기 전에 범위에서 벗어남
      var vp = page.getViewport({ scale: job.scale });
      var ratio = window.devicePixelRatio || 1;
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * ratio);
      canvas.height = Math.floor(vp.height * ratio);
      canvas.style.width = Math.floor(vp.width) + 'px';
      canvas.style.height = Math.floor(vp.height) + 'px';
      // shortcut: 자리는 1페이지 크기로 잡고 그릴 때 실제 크기로 고친다, 페이지 크기가 제각각인 PDF에서 스크롤이 튀면 전 페이지 크기를 미리 읽는 방식으로 교체
      sizeRow(p, Math.floor(vp.width), Math.floor(vp.height));
      job.task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: vp,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
      });
      return job.task.promise.then(function () {
        if (p.job !== job) return;
        p.wrap.replaceChildren(canvas);  // 다 그린 뒤 교체해 빈 화면 깜빡임을 줄인다
        p.renderedScale = job.scale;
        performance.mark('viewer-page-rendered', { detail: { page: p.n } });  // Phase 3 측정용
      });
    }).catch(function (err) {
      if (err && err.name === 'RenderingCancelledException') return;
      console.error('[viewer] ' + p.n + '페이지 렌더링 실패', err);
      p.wrap.textContent = p.n + '페이지를 그리지 못했습니다.';
    }).then(function () {
      if (p.job === job) p.job = null;
    });
  }

  function releasePage(p) {
    if (p.job && p.job.task) p.job.task.cancel();
    p.job = null;
    p.renderedScale = 0;
    p.wrap.replaceChildren();
  }

  function updateRendering() {
    if (!visible.size) return;
    var nums = Array.from(visible);
    var lo = Math.min.apply(null, nums) - 1;
    var hi = Math.max.apply(null, nums) + 1;
    pages.forEach(function (p) {
      if (p.n >= lo && p.n <= hi) renderPage(p);
      else if (p.job || p.renderedScale) releasePage(p);
    });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var n = Number(e.target.dataset.page);
      if (e.isIntersecting) visible.add(n); else visible.delete(n);
    });
    updateRendering();
  }, { root: root });

  // 폭에 맞춰 배율과 모든 행 크기를 다시 정한다
  function layout() {
    var cs = getComputedStyle(root);
    var inner = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var w = Math.max(Math.floor(inner * PAGE_SHARE), MIN_PAGE_WIDTH);
    state.width = root.clientWidth;
    state.scale = w / state.baseWidth;
    pages.forEach(function (p) { sizeRow(p, w, Math.floor(w * state.baseRatio)); });
  }

  // 창 크기가 바뀌면 다시 그리고 보던 페이지를 유지한다
  var resizeTimer = 0;
  var resizeObserver = new ResizeObserver(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!state.pdf) return;
      if (root.clientWidth === state.width) return sizeTail();  // 높이만 바뀜
      var keep = state.page;
      pages.forEach(releasePage);
      layout();
      root.scrollTop = scrollTargetOf(keep);
      detectPage();
      updateRendering();
    }, 150);
  });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; detectPage(); });
  }

  // ── 문서 열기 ───────────────────────────────────────────────

  function openErrorMessage(err) {
    var name = err && err.name;
    var code = err && err.status;
    if (code === 401 || code === 403) return '로그인이 필요하거나 권한이 없는 문서입니다.';
    if (name === 'MissingPDFException' || code === 404) return '문서를 찾을 수 없습니다.';
    if (name === 'InvalidPDFException') return 'PDF 파일이 아니거나 손상된 파일입니다.';
    if (name === 'PasswordException') return '암호가 걸린 PDF는 열 수 없습니다.';
    return 'PDF를 열지 못했습니다.';
  }

  function showError(msg, err) {
    status.textContent = msg;
    root.textContent = msg;
    prevBtn.disabled = nextBtn.disabled = true;
    console.error('[viewer]', msg, err || '');
  }

  function el(cls, side, n) {
    var d = document.createElement('div');
    d.className = cls;
    if (side) d.dataset.side = side;
    if (n) d.dataset.page = n;
    return d;
  }

  var url = root.dataset.pdfUrl;
  if (!url) {
    showError('data-pdf-url 이 비어 있습니다.');
  } else {
    performance.mark('viewer-open-start');
    pdfjsLib.getDocument(url).promise.then(function (pdf) {
      state.pdf = pdf;
      state.totalPages = pdf.numPages;
      return pdf.getPage(1);
    }).then(function (first) {
      var vp = first.getViewport({ scale: 1 });
      state.baseWidth = vp.width;
      state.baseRatio = vp.height / vp.width;

      // 1페이지 크기로 전체 페이지의 빈 행을 먼저 만든다 (스크롤 길이 확보)
      var frag = document.createDocumentFragment();
      for (var n = 1; n <= state.totalPages; n++) {
        var row = el('page-row', null, n);
        var wrap = el('page-canvas-wrap');
        row.append(el('memo-slot', 'left', n), wrap, el('memo-slot', 'right', n));
        frag.appendChild(row);
        pages.push({ n: n, row: row, wrap: wrap, job: null, renderedScale: 0 });
      }
      frag.appendChild(tail);
      root.appendChild(frag);
      layout();

      window.dispatchEvent(new CustomEvent('pudin:pagesready', {
        detail: { documentId: state.documentId, totalPages: state.totalPages }
      }));

      pages.forEach(function (p) { observer.observe(p.row); });
      root.addEventListener('scroll', onScroll);
      resizeObserver.observe(root);
      detectPage();  // 처음 열 때 pagechange 1회
    }).catch(function (err) {
      showError(openErrorMessage(err), err);
    });
  }

  window.PudinViewer = { goToPage: goToPage, getCurrentPage: getCurrentPage };
})();
