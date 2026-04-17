export type InvoicePdfInput = {
  orderId: string;
  issuedAt: string;
  name: string;
  email: string;
  packageName: string;
  tokens: number;
  amountLabel: string;
  paymentMethod: string;
  statusLabel: string;
  closingLine: string;
};

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function buildPdfLines(lines: Array<{ text: string; size?: number; gap?: number }>) {
  const pageHeight = 842;
  let cursorY = 770;
  const commands: string[] = [];

  for (const line of lines) {
    const size = line.size ?? 12;
    const gap = line.gap ?? 18;
    commands.push(`BT /F1 ${size} Tf 56 ${cursorY} Td (${escapePdfText(line.text)}) Tj ET`);
    cursorY -= gap;
  }

  const content = commands.join("\n");
  const contentLength = content.length;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${contentLength} >> stream\n${content}\nendstream endobj`
  ];

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [0];
  let currentOffset = header.length;

  for (const obj of objects) {
    offsets.push(currentOffset);
    body += `${obj}\n`;
    currentOffset += `${obj}\n`.length;
  }

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([header, body, xref, trailer], { type: "application/pdf" });
}

export function downloadInvoicePdf(input: InvoicePdfInput) {
  const blob = buildPdfLines([
    { text: "EPANET Solver", size: 18, gap: 24 },
    { text: "Bukti Pembayaran", size: 14, gap: 22 },
    { text: `No. Order    : ${input.orderId}` },
    { text: `Tanggal      : ${input.issuedAt}` },
    { text: `Nama         : ${input.name}` },
    { text: `Email        : ${input.email}` },
    { text: `Paket        : ${input.packageName}` },
    { text: `Token        : ${input.tokens} token` },
    { text: `Harga        : ${input.amountLabel}` },
    { text: `Metode       : ${input.paymentMethod}` },
    { text: `Status       : ${input.statusLabel}` },
    { text: "" },
    { text: input.closingLine },
    { text: "" },
    {
      text: "Dokumen ini merupakan bukti pembayaran resmi layanan EPANET Solver.",
      size: 10,
      gap: 16
    },
    {
      text: "Diproses melalui Midtrans Payment Gateway.",
      size: 10,
      gap: 16
    }
  ]);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${input.orderId}-epanet-solver.pdf`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
