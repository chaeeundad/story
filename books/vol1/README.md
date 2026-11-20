# 아직 생각 중입니다

**AI 시대를 맞이하는 IT 회사 대표이자 세 딸 아빠의 생각**

mino 지음

- [책 전체 읽기](https://mino.co.kr/books/vol1/)
- [통합 원고](manuscript.md): 3부 10장, 111,055자(공백·Markdown 포함)
- [편집 기록](EDITORIAL_REPORT.md)
- [제작 및 검증 기록](PRODUCTION.md)
- [서지 메타데이터](book.json)
- 삽화: `illustrations/`의 SVG 3종

책 웹판은 `src/pages/books/vol1/index.astro`가 원고를 직접 가져와 빌드한다. 원고를 고치면 웹판도 다음 빌드에 함께 반영된다. 기존 열 편의 에세이와 URL, 정렬, 대화 기록, 공감 데이터는 그대로 보존한다.

인쇄용 DOCX는 저자가 제공한 부크크 B5 서식(재단 여백 포함 188×263mm)을 바탕으로 만든다. 실제 재단 크기는 182×257mm이다. 다른 B5 또는 46판 치수로 치환하지 않는다. 안내·어린 왕자 샘플을 제거하고 전체 원고, 목차, 삽화, 판권을 담는다. ISBN과 미확정 출판사 정보는 넣지 않는다.
