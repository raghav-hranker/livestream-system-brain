# Certificate renderer and bundled fonts

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend

## What to build

A deep module that draws the Classic ivory certificate. Its one call is
`renderCertificate({ name, courseTitle, completionDate, code, signatory | null }, { scale })`, and it returns
`{ pdf, png }`. Nothing else in the codebase draws certificates.

- **Template.** One SVG holds design A from
  [`../../../prototypes/certificate-design/index.html`](../../../prototypes/certificate-design/index.html):
  - ivory sheet, double gold border and corner diamonds;
  - the seal (the admin's `vidyagram-logo.png`, embedded);
  - "CERTIFICATE OF COMPLETION", then "This is to certify that";
  - the name over a gold rule;
  - "has successfully completed the course" and the course title;
  - the completion date block on the left, the signature block on the right, and "Certificate no. <code>" at the
    bottom.

  The template carries a `TEMPLATE_VERSION` constant, which the caller stores.
- **Text rules.**
  - English names use Great Vibes. A name containing Devanagari uses Noto Serif Devanagari, because Great Vibes has
    no Devanagari letters.
  - Names shrink at more than 16 and more than 24 characters, as in the prototype.
  - The course title wraps to at most two lines and shrinks if a third line would be needed.
  - The date is printed as "23 October 2026".
  - `signatory: null` drops the signature block and centres the date block.
  - All text is XML-escaped.
- **Output.**
  - `sharp` renders the SVG to a PNG. At `scale: 'print'` it is 3508×2480 (A4 landscape at 300 dpi). At
    `scale: 'preview'` it is about 1123×794, for the claim preview.
  - The PDF is one A4 landscape page from `pdfkit` holding that PNG (or a high-quality JPEG of it) edge to edge.
    Set the PDF title to "Vidyagram Certificate <code>".
- **Fonts.** Bundle the TTFs for Cinzel, Cormorant Garamond, Great Vibes, Noto Serif Devanagari and Inter, all
  under the OFL, with their licence files.
  - Make `sharp`/librsvg use them without depending on system fonts. One way is a fontconfig file the module points
    to through `FONTCONFIG_FILE` before the first render.
  - Record how fonts are found in the report.
- **Proof on Linux.** Add a script that renders the fixtures inside a Debian container matching the box (Node 22),
  and compares them against reference PNGs committed with the tests.

## Acceptance criteria

- [ ] Unit: each fixture renders a one-page PDF of A4 landscape size and a PNG of the expected pixel size. The
      fixtures are: English name; Devanagari name ("राहुल शर्मा"); a 40-character name; the Hindi two-line course
      title "SSC CGL 2026 — गणित फाउंडेशन बैच" combined with a long English title; and no signatory.
- [ ] Unit: each PNG matches its reference image within a small pixel tolerance. A deliberately broken font path
      makes the test fail, so tofu boxes are caught.
- [ ] The Debian container script passes. Its output images are attached to the report, and the Devanagari
      conjuncts (र्मा, क्ष, श्री, द्वि) are visibly correct.
- [ ] A print render takes under 2 s and stays under 300 MB of memory on a laptop. Report the numbers.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 10, 39
