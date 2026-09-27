import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { SOURCE_CATALOG, type ResearchRun } from "@/lib/agent/types";

export async function briefToPdf(run: ResearchRun): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const writer = new PdfWriter(pdf, regular, bold);

  writer.line("MERIDIAN", 9, true, rgb(0.55, 0.32, 0.16));
  writer.gap(6);
  writer.line(run.brief.title, 18, true);
  writer.gap(4);
  writer.line(run.query, 10, false, rgb(0.33, 0.3, 0.26));
  writer.line(
    `Confidence ${run.brief.confidence}  ·  ${run.createdAt.slice(0, 16).replace("T", " ")} UTC`,
    9,
    false,
    rgb(0.4, 0.36, 0.3),
  );
  writer.gap(12);
  writer.line("Overview", 13, true);
  writer.gap(4);
  writer.line(run.brief.overview, 11);
  writer.gap(12);
  writer.line("Key points", 13, true);
  writer.gap(4);
  run.brief.keyPoints.forEach((point, index) => {
    writer.line(`${index + 1}. ${point.text} ${point.sourceIds.join(", ")}`, 11);
    writer.gap(3);
  });
  writer.gap(8);
  writer.line("Findings", 13, true);
  writer.gap(4);
  for (const finding of run.brief.findings) {
    writer.line(finding.heading, 12, true);
    writer.gap(2);
    writer.line(`${finding.detail} ${finding.sourceIds.join(", ")}`, 11);
    writer.gap(6);
  }
  writer.line("Actionable insights", 13, true);
  writer.gap(4);
  if (run.brief.actionableInsights.length === 0) {
    writer.line("None drawn from the sources.", 11);
  }
  for (const insight of run.brief.actionableInsights) {
    writer.line(`- ${insight.text} ${insight.sourceIds.join(", ")}`, 11);
    writer.gap(3);
  }
  writer.gap(8);
  writer.line("Gaps", 13, true);
  writer.gap(4);
  if (run.brief.gaps.length === 0) writer.line("No specific gap was flagged.", 11);
  for (const gap of run.brief.gaps) writer.line(`- ${gap}`, 11);
  writer.gap(8);
  writer.line("References", 13, true);
  writer.gap(4);
  for (const reference of run.brief.references) {
    writer.line(
      `${reference.id}  ${reference.title} (${SOURCE_CATALOG[reference.source].label}${reference.cited ? ", cited" : ""})`,
      10,
      true,
    );
    writer.line(reference.url, 9, false, rgb(0.25, 0.32, 0.45));
    writer.gap(3);
  }
  writer.gap(8);
  writer.line("Source selection", 13, true);
  writer.gap(4);
  writer.line(run.plan.whyTheseSources, 11);
  writer.gap(4);
  for (const task of run.plan.tasks) {
    writer.line(`${task.source}: ${task.query} — ${task.purpose}`, 10);
    writer.gap(2);
  }

  return pdf.save();
}

class PdfWriter {
  private page: PDFPage;
  private y: number;
  private readonly margin = 56;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = pdf.addPage([595.28, 841.89]);
    this.y = this.page.getHeight() - this.margin;
  }

  gap(amount: number): void {
    this.y -= amount;
  }

  line(
    text: string,
    size: number,
    bold = false,
    color = rgb(0.16, 0.13, 0.1),
  ): void {
    const font = bold ? this.bold : this.regular;
    const maxWidth = this.page.getWidth() - this.margin * 2;
    const words = pdfSafe(text).split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let current = "";
    for (const word of words.length ? words : [""]) {
      const trial = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(trial, size) > maxWidth) {
        rows.push(current);
        current = word;
      } else {
        current = trial;
      }
    }
    if (current) rows.push(current);
    for (const row of rows) {
      if (this.y - size < this.margin) {
        this.page = this.pdf.addPage([595.28, 841.89]);
        this.y = this.page.getHeight() - this.margin;
      }
      this.page.drawText(row, {
        x: this.margin,
        y: this.y - size,
        size,
        font,
        color,
      });
      this.y -= size + 3;
    }
  }
}

function pdfSafe(value: string): string {
  return value
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2026", "...")
    .replaceAll("\u00a0", " ")
    .replace(/[^\n\r\t\x20-\xff]/g, "");
}
