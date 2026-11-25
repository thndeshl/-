"""테스트용 PDF 생성 (표준 라이브러리만 사용, 담당 C)

사용법 (프로젝트 루트에서):
    python dev/make_sample_pdf.py 5   dev/sample.pdf
    python dev/make_sample_pdf.py 300 dev/large.pdf
"""
import sys

LINE = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor."


def page_stream(n):
    s = ["BT /F1 48 Tf 72 760 Td (Page %d) Tj ET" % n]
    # 실제 강의자료처럼 본문 글자와 도형을 채운다
    s += ["BT /F1 11 Tf 72 %d Td (%d. %s) Tj ET" % (700 - 16 * i, i + 1, LINE) for i in range(30)]
    s += ["0.2 0.4 0.8 RG 2 w 72 %d m 523 %d l S" % (220 - 8 * i, 160 + 8 * i) for i in range(10)]
    return "\n".join(s)


def make_pdf(count):
    kids = " ".join("%d 0 R" % (4 + 2 * i) for i in range(count))
    objs = ["<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, count),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    for i in range(count):
        s = page_stream(i + 1)
        objs.append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                    "/Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>" % (5 + 2 * i))
        objs.append("<< /Length %d >>\nstream\n%s\nendstream" % (len(s), s))
    out, offsets = b"%PDF-1.4\n", []
    for n, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += ("%d 0 obj\n%s\nendobj\n" % (n, o)).encode()
    xref = len(out)
    out += ("xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)).encode()
    out += "".join("%010d 00000 n \n" % o for o in offsets).encode()
    out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)).encode()
    return out


if __name__ == "__main__":
    count, path = int(sys.argv[1]), sys.argv[2]
    assert count >= 1
    data = make_pdf(count)
    assert data.count(b"/Type /Page ") == count  # 페이지 수 자체 점검
    open(path, "wb").write(data)
    print("%s: %d pages, %d bytes" % (path, count, len(data)))
