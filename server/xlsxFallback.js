// A forgiving .xlsx reader used when the main spreadsheet library cannot open a file. It reads the first worksheet's cells
// straight from the zip and copes with the things that trip up stricter readers: prefixed XML tags (<x:row>), plain-text
// "inline" cells, an empty shared-strings table, Excel table parts and absolute relationship targets.
const JSZip = require('jszip');

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text) => String(text).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
  const lower = entity.toLowerCase();
  if (NAMED[lower]) return NAMED[lower];
  const code = lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
  return Number.isFinite(code) ? String.fromCodePoint(code) : match;
});
// Removes namespace prefixes from tag names only (<x:row> -> <row>), leaving attributes such as r:id alone.
const plain = (xml) => xml.replace(/^﻿/, '').replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, '<$1');
const attributes = (text) => Object.fromEntries([...text.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
const textOf = (fragment) => [...String(fragment).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decode(match[1])).join('');
const columnNumber = (reference) => [...String(reference).replace(/[^A-Za-z]/g, '').toUpperCase()].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);

async function read(zip, name) {
  const entry = zip.file(name);
  return entry ? plain(await entry.async('string')) : null;
}

async function firstSheetPath(zip) {
  const workbook = await read(zip, 'xl/workbook.xml');
  const rels = await read(zip, 'xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const sheet = /<sheet\b([^>]*?)\/?>/.exec(workbook);
    const id = sheet && attributes(sheet[1])['r:id'];
    const rel = id && [...rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)].map((match) => attributes(match[1])).find((item) => item.Id === id);
    if (rel?.Target) {
      const target = rel.Target.replace(/^\/+/, '');
      return zip.file(target) ? target : zip.file(`xl/${target}`) ? `xl/${target}` : null;
    }
  }
  return Object.keys(zip.files).filter((name) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name)).sort()[0] || null;
}

// Returns an object shaped like the part of an exceljs worksheet the importer uses: getRow(n).values and eachRow().
async function readSheetLoosely(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedXml = await read(zip, 'xl/sharedStrings.xml');
  const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1])) : [];
  const path = await firstSheetPath(zip);
  if (!path) throw new Error('The spreadsheet is empty.');
  const sheetXml = await read(zip, path);
  const rows = new Map();
  let autoRow = 0;
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    autoRow += 1;
    const number = Number(attributes(rowMatch[1]).r) || autoRow;
    const cells = [];
    let autoColumn = 0;
    for (const cellMatch of (rowMatch[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      autoColumn += 1;
      const attrs = attributes(cellMatch[1]);
      const column = attrs.r ? columnNumber(attrs.r) : autoColumn;
      const inner = cellMatch[2] || '';
      const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
      let value = '';
      if (attrs.t === 'inlineStr') value = textOf(inner);
      else if (attrs.t === 's') value = shared[Number(raw?.[1])] ?? '';
      else if (attrs.t === 'b') value = raw?.[1] === '1' ? 'TRUE' : 'FALSE';
      else if (raw) value = decode(raw[1]);
      while (cells.length <= column) cells.push('');
      cells[column] = value;
    }
    rows.set(number, cells);
  }
  if (!rows.size) throw new Error('The spreadsheet is empty.');
  const get = (number) => rows.get(number) || [''];
  return {
    getRow: (number) => ({ values: get(number) }),
    eachRow: (callback) => { for (const number of [...rows.keys()].sort((a, b) => a - b)) callback({ getCell: (index) => ({ value: get(number)[index] ?? '' }) }, number); },
  };
}

module.exports = { readSheetLoosely };
