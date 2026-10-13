import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const inr = (n) => `INR ${Number(n).toLocaleString('en-IN')}`;

/** Renders a single-page A5 ticket with event details and the QR code. */
export async function renderTicketPdf({ filePath, qrPng, event, venue, seats, booking, holder }) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 36 });
    const out = createWriteStream(filePath);
    out.on('finish', resolve);
    out.on('error', reject);
    doc.on('error', reject);
    doc.pipe(out);

    doc.rect(0, 0, doc.page.width, 64).fill('#14172b');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('TicketHub', 36, 22);

    doc.fillColor('#1b1e2e').fontSize(18).text(event.title, 36, 84, { width: doc.page.width - 72 });
    doc.moveDown(0.4).fontSize(10).font('Helvetica').fillColor('#6b7185');
    doc.text(new Date(event.startsAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }));
    doc.text([venue?.name, event.city].filter(Boolean).join(', '));

    doc.moveDown(1).fillColor('#1b1e2e').font('Helvetica-Bold').fontSize(11).text('Seats');
    doc.font('Helvetica').fontSize(11);
    for (const s of seats) doc.text(`${s.section}  -  Row ${s.row}, Seat ${s.number}  (${s.tier})`);

    doc.moveDown(0.8).fontSize(10).fillColor('#6b7185');
    doc.text(`Holder: ${holder.name}`);
    doc.text(`Total: ${inr(booking.totalAmount)}`);
    doc.text(`Booking ref: ${booking.id}`);

    const qrSize = 130;
    doc.image(qrPng, doc.page.width - qrSize - 36, doc.page.height - qrSize - 56, { width: qrSize });
    doc.fontSize(8).fillColor('#6b7185').text('Scan at entry', doc.page.width - qrSize - 36, doc.page.height - 52, {
      width: qrSize,
      align: 'center',
    });
    doc.end();
  });
}
