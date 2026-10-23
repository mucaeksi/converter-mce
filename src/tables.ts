import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';

type Value = string | number | boolean | null;
type Table = { columns: string[]; rows: Value[][] };
const MAX_CELLS = 50_000;
const scalar = (value: unknown): value is Value => value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)));

function validate(table: Table) {
  if (!table.columns.length || table.columns.length > 100 || table.rows.length > 10_000 || (table.rows.length + 1) * table.columns.length > MAX_CELLS) throw new Error('En fazla 100 sütun, 10.000 veri satırı ve başlıklar dahil 50.000 hücre desteklenir.');
  if (table.columns.some(c => !c.trim()) || new Set(table.columns).size !== table.columns.length) throw new Error('Başlıklar boş olmamalı ve birbirinden farklı olmalı.');
  if (table.rows.some(row => row.length !== table.columns.length || row.some(v => !scalar(v)))) throw new Error('Satırlar aynı sayıda hücre içermeli; iç içe nesneler ve güvenli aralık dışındaki sayılar desteklenmez.');
  return table;
}

async function workbook(file: File) {
  // Bound decompression before the workbook parser sees any XML.
  let total = 0, entries = 0;
  const parts = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter(entry) {
    total += Math.max(entry.originalSize, entry.size); entries++;
    if (!Number.isSafeInteger(total) || total > 32 * 1024 * 1024 || entries > 1000) throw new Error('Excel açılmış boyutu 32 MB veya 1.000 parça sınırını aşıyor.');
    if (/vbaProject|externalLinks/i.test(entry.name)) throw new Error('Makro veya dış bağlantı içeren Excel desteklenmiyor.');
    return true;
  } });
  if (!parts['xl/workbook.xml']) throw new Error('Geçerli bir XLSX seçin. Eski XLS biçimi desteklenmiyor.');
  const safe = zipSync(parts, { level: 0 });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength) as ArrayBuffer);
  return book;
}

export async function inspectSheets(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Tablo dosyası en fazla 5 MB olabilir.');
  const book = await workbook(file);
  return book.worksheets.map(sheet => sheet.name);
}

async function readTable(file: File, sheetName: string, delimiter: string): Promise<Table> {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Boş olmayan, en fazla 5 MB bir tablo seçin.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') {
    const book = await workbook(file);
    const sheet = book.getWorksheet(sheetName);
    if (!sheet) throw new Error('Excel çalışma sayfasını seçin.');
    if (!sheet.rowCount || sheet.rowCount > 10_001 || sheet.columnCount > 100 || sheet.rowCount * sheet.columnCount > MAX_CELLS) throw new Error('Excel sayfası 50.000 hücre sınırını aşıyor veya boş.');
    const rows: Value[][] = [];
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row: Value[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        let value: unknown = sheet.getCell(r, c).value;
        if (value instanceof Date) value = value.toISOString();
        else if (value && typeof value === 'object') {
          if ('formula' in value || 'sharedFormula' in value) throw new Error('Formüllü Excel hücreleri desteklenmiyor. Önce değerlerden oluşan bir kopya oluşturun.');
          else if ('richText' in value) value = (value as ExcelJS.CellRichTextValue).richText.map(t => t.text).join('');
          else if ('text' in value) value = (value as ExcelJS.CellHyperlinkValue).text;
          else throw new Error('Excel hata veya desteklenmeyen hücre türü içeriyor.');
        }
        if (!scalar(value)) throw new Error('Desteklenmeyen hücre değeri veya güvenli aralık dışındaki sayı.');
        row.push(value);
      }
      rows.push(row);
    }
    const header = rows.shift()!;
    return validate({ columns: header.map(v => v === null ? '' : String(v)), rows });
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '');
  if (extension === 'json') {
    const records: unknown = JSON.parse(text);
    if (!Array.isArray(records) || !records.length || records.length > 10_000 || records.some(r => !r || Array.isArray(r) || typeof r !== 'object')) throw new Error('JSON, nesnelerden oluşan bir dizi olmalı: [{"ad":"Ada"}].');
    const columns = [...new Set(records.flatMap(r => Object.keys(r)))];
    if (columns.length > 100) throw new Error('En fazla 100 sütun desteklenir.');
    return validate({ columns, rows: records.map(r => columns.map(c => Object.hasOwn(r, c) ? r[c] : null)) });
  }
  if (extension !== 'csv' && extension !== 'tsv') throw new Error('CSV, TSV, JSON veya XLSX seçin.');
  const parsed = Papa.parse<string[]>(text, { delimiter: extension === 'tsv' ? '\t' : delimiter, skipEmptyLines: true });
  if (parsed.errors.some(e => e.code !== 'UndetectableDelimiter')) throw new Error('CSV tırnakları veya satır yapısı geçersiz.');
  const [columns = [], ...rows] = parsed.data;
  return validate({ columns, rows });
}

export async function convertTable(file: File, format: string, sheet: string, delimiter: string) {
  if (!['csv', 'tsv', 'json', 'xlsx'].includes(format) || ![',', ';', '\t'].includes(delimiter)) throw new Error('Geçersiz tablo seçeneği.');
  const table = await readTable(file, sheet, delimiter);
  let blob: Blob;
  if (format === 'xlsx') {
    const book = new ExcelJS.Workbook();
    const target = book.addWorksheet('Veri');
    target.addRow(table.columns); target.addRows(table.rows);
    blob = new Blob([new Uint8Array(await book.xlsx.writeBuffer())], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } else if (format === 'json') {
    blob = new Blob([JSON.stringify(table.rows.map(row => Object.fromEntries(table.columns.map((c, i) => [c, row[i]]))), null, 2)], { type: 'application/json' });
  } else {
    const text = Papa.unparse([table.columns, ...table.rows], { delimiter: format === 'tsv' ? '\t' : delimiter, escapeFormulae: true });
    blob = new Blob(['\uFEFF', text], { type: format === 'tsv' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8' });
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error('Çıktı 10 MB sınırını aşıyor.');
  return { blob, name: `${file.name.replace(/\.[^.]+$/, '')}.${format}`, detail: `${table.rows.length} veri satırı · ${table.columns.length} sütun` };
}
