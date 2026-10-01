// Digital stamps: institutions and staff upload a stamp/signature image; when a student's document is cleared,
// a stamped PDF copy is produced with those marks on every page. The original upload is never changed.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const STAMP_TYPES = ['image/png', 'image/jpeg'];
const MAX_STAMP_BYTES = 1.5 * 1024 * 1024;

// Where a stamp goes on each page: a named edge, the old default corner, or a custom spot (x, y are the stamp's centre as
// fractions of the page, from the top-left). `size` scales the stamp.
const MODES = ['default', 'top', 'bottom', 'left', 'right', 'custom'];
const SIZES = { small: 0.14, medium: 0.2, large: 0.28 };
function normalizePlacement(input = {}) {
  const mode = MODES.includes(input.mode) ? input.mode : 'default';
  const size = Object.hasOwn(SIZES, input.size) ? input.size : 'medium';
  const clamp = (value, fallback) => (Number.isFinite(Number(value)) ? Math.min(0.98, Math.max(0.02, Number(value))) : fallback);
  return { mode, size, x: clamp(input.x, 0.5), y: clamp(input.y, 0.5) };
}
const spot = (placement) => {
  if (placement.mode === 'top') return { x: 0.5, y: 0.1 };
  if (placement.mode === 'bottom') return { x: 0.5, y: 0.9 };
  if (placement.mode === 'left') return { x: 0.1, y: 0.5 };
  if (placement.mode === 'right') return { x: 0.9, y: 0.5 };
  return { x: placement.x, y: placement.y };
};

async function setPlacement({ owner, input, now }) {
  if (!owner.stamp) throw Object.assign(new Error('Upload your stamp first.'), { status: 409 });
  owner.stamp.placement = normalizePlacement(input);
  owner.stamp.updatedAt = now();
  return owner.stamp;
}

// Validates an uploaded stamp and stores it on `owner` (a staff record or an institution user).
async function saveStamp({ files, owner, input, now }) {
  const buffer = Buffer.from(String(input.base64 || ''), 'base64');
  if (!buffer.length) throw Object.assign(new Error('The stamp file is empty.'), { status: 400 });
  // Trust the file itself, not the label the phone gave it: a WebP or HEIC photo labelled "jpeg" cannot be stamped onto a PDF.
  const mimeType = buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : buffer[0] === 0xff && buffer[1] === 0xd8 ? 'image/jpeg' : '';
  if (!mimeType) throw Object.assign(new Error('That image could not be read. Please try a different picture.'), { status: 400 });
  if (buffer.length > MAX_STAMP_BYTES) throw Object.assign(new Error('The stamp must be under 1.5MB.'), { status: 400 });
  const fileId = require('node:crypto').randomUUID();
  await files.put(fileId, buffer);
  if (owner.stamp?.fileId) await files.remove?.(owner.stamp.fileId).catch(() => {});
  owner.stamp = { fileId, mimeType, name: String(input.name || 'stamp').slice(0, 120), size: buffer.length, updatedAt: now(), placement: owner.stamp?.placement || normalizePlacement() };
  return owner.stamp;
}

async function removeStamp({ files, owner }) {
  if (owner.stamp?.fileId) await files.remove?.(owner.stamp.fileId).catch(() => {});
  owner.stamp = null;
}

// Returns a PDF Buffer with `marks` drawn bottom-right on every page, or null when the source cannot be stamped
// (only PDF, PNG and JPG documents can be).
async function stampDocument({ buffer, mimeType, marks, reviewer, date }) {
  let pdf;
  if (mimeType === 'application/pdf') {
    pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } else if (STAMP_TYPES.includes(mimeType)) {
    pdf = await PDFDocument.create();
    const image = mimeType === 'image/png' ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
    pdf.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  } else {
    return null;
  }
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const embedded = [];
  const placements = [];
  for (const mark of marks) {
    // Go by the file's own first bytes, not the label it was uploaded with. A mislabelled stamp is skipped, never fatal.
    try {
      const png = mark.image[0] === 0x89 && mark.image[1] === 0x50;
      const jpg = mark.image[0] === 0xff && mark.image[1] === 0xd8;
      if (!png && !jpg) throw new Error('not a PNG or JPG image');
      embedded.push(png ? await pdf.embedPng(mark.image) : await pdf.embedJpg(mark.image));
      placements.push(normalizePlacement(mark.placement));
    } catch (error) {
      console.error('A stamp image could not be used, stamping without it:', error && error.message ? error.message : error);
    }
  }
  if (!embedded.length) return null;
  const stampedOn = new Date(date || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const caption = `Cleared${reviewer ? ` by ${reviewer}` : ''} - ${stampedOn}`;

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const base = Math.min(width, height);
    const margin = base * 0.04;
    const captionSize = Math.max(6, base * 0.018);
    const captionWidth = font.widthOfTextAtSize(caption, captionSize);
    const floor = margin + captionSize * 1.8; // keep stamps clear of the caption line
    // Stamps with no chosen spot sit side by side in the bottom-right corner, as before.
    let cursor = width - margin;
    embedded.forEach((image, index) => {
      const placement = placements[index];
      const box = base * SIZES[placement.size];
      const scale = Math.min(box / image.width, (box * 0.8) / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      let x; let y;
      if (placement.mode === 'default') {
        cursor -= w;
        x = cursor; y = floor;
        cursor -= margin;
      } else {
        const at = spot(placement);
        x = Math.min(width - margin - w, Math.max(margin, at.x * width - w / 2));
        y = Math.min(height - margin - h, Math.max(floor, (1 - at.y) * height - h / 2));
      }
      page.drawImage(image, { x, y, width: w, height: h, opacity: 0.95 });
    });
    page.drawText(caption, { x: Math.max(margin, width - margin - captionWidth), y: margin, size: captionSize, font, color: rgb(0.28, 0.28, 0.4) });
  }
  return Buffer.from(await pdf.save());
}

module.exports = { saveStamp, removeStamp, setPlacement, normalizePlacement, stampDocument, STAMP_TYPES };
