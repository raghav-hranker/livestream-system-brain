import { createHash } from 'crypto';
import mongoose, { Types } from 'mongoose';
import Class from '../../models/Class';
import Pdf from '../../models/Pdf';
import type { PdfAssetRef } from '../../types/assetRef';
import { CATALOG_COLLECTIONS, isTransientCmsError, SessionLost } from './apxCatalogCapture';
import { ensureImportTaxonomy, IMPORT_LEDGER, ImportTaxonomyIds } from './apxCatalogClassCommit';
import { CLASS_IMPORT_TEACHER, ImportUnit } from './apxCatalogClassImport';
import {
  compareOldest, fileRef, fieldsKey, isPublicPdfHost, NoteSlot, NoteTarget, NoteVariant, orderPublicFirst, PdfField,
  PdfFileKind, PdfFileUnit, PdfImportPlan, PdfSource, RowPdfFields, SkippedPdfRow, versionLabel, versionTitle,
} from './apxCatalogPdfImport';
import { CsvRow, CsvSink, RunAction } from './apxCatalogPdfImportCsv';
import type { CoursePlan } from './apxCatalogPlanner';
import { pdfObjectKey } from './apxPdfAsset';
import { ApxPdfDecryptError, decryptApxPdf, isValidApxPdf } from './apxPdfDecryptService';

type Db = mongoose.mongo.Db;

// --- AppX catalogue PDF import: mirror reads, fetch, commit (appx-tenant-onboarding task 06) ---
//
// Phase 1, per file unit (apxCatalogPdfImport.ts), bounded concurrency, the only AppX calls:
//   A ledger row with a pdfId is not fetched again. Otherwise sign the raw link through the
//   CMS (a public-host file is first tried unsigned), download with the PDF-web Referer, decrypt when the source row says so, require `%PDF`
//   (and the full validity gate for decrypted files), hash the bytes. A file whose sha256 a
//   ledger row already holds reuses that Pdf (no upload); else upload under
//   `781/pdfs/<sha256(fileKey)>.pdf` and create the Pdf under the holding taxonomy, unplaced
//   (no CoursePdf).
// Phase 2, DB only, sequential: per Class with notes (found through the class import's ledger
//   `apxcatalogimports`, else Class.apxAssetKey, both read only), per note slot, attach each
//   distinct Pdf once (guarded). A multi-version slot is attached only once every variant has
//   a Pdf, oldest first, each Pdf retitled "<class> – Notes (<courses>)" and flagged
//   (`multiVersion`, `versionGroup`). No Class yet → `waiting-class`, attached on a rerun.
// The ledger `apxcatalogpdfimports {customerId, fileKey}` records pdfId, sha256, kind, sources
// (course, rowId, field, state), status and error; it is written only when something changed,
// so a rerun is a no-op. CSV rows are appended as each action is decided.
//
// Signer (per AppX account, the 472 bottleneck): one sign at a time at least `signGapMs`
// apart; 5xx and timeouts retried with backoff; a throttled signer (unsigned link echoed back)
// pauses every worker with growing waits instead of failing rows, and stops the run after
// `maxThrottleWaits` waits in a row. SessionLost stops the run at once. Rows not reached stay
// as they were, so a rerun resumes.
//
// Never logs links, signed URLs, encryption keys or cookies: ids, hosts, file refs and counts.

export const PDF_IMPORT_LEDGER = 'apxcatalogpdfimports';

export class SignerThrottled extends Error {
  constructor(message = 'the signer echoed the unsigned link back (account throttled)') {
    super(message);
    this.name = 'SignerThrottled';
  }
}

export class PdfFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfFetchError';
  }
}

// The signer chose not to sign this file tonight (admin sign cap reached, or the admin session
// is gone while student signing goes on). The file is left as a throttled one is: no ledger
// write, picked up by a later run.
export class SignDeferred extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignDeferred';
  }
}

export type Signer = (rawLink: string, file: PdfFileUnit) => Promise<string>;
export type Downloader = (signedUrl: string) => Promise<Buffer>;
export type Uploader = (bytes: Buffer, objectKey: string) => Promise<PdfAssetRef>;

export const withoutUrls = (message: string): string => message.replace(/https?:\/\/\S+/g, '<url>');

const isOn = (v: unknown): boolean => {
  const s = String(v ?? '').trim();
  return s !== '' && s !== '0' && s.toLowerCase() !== 'false';
};
const str = (v: unknown): string => String(v ?? '').trim();

// --- Mirror reads ---

const FIELD_PROJECTION = ['link', 'pdf_link', 'pdf_link2', 'is_pdf_encrypted', 'is_pdf2_encrypted', 'created_at'];

const toFields = (raw: Record<string, any>): RowPdfFields => ({
  link: str(raw.link),
  pdfLink: str(raw.pdf_link),
  pdfLink2: str(raw.pdf_link2),
  encrypted: isOn(raw.is_pdf_encrypted),
  encrypted2: isOn(raw.is_pdf2_encrypted),
  createdAt: str(raw.created_at),
});

// The row behind a placement: its own course's pc4 row, else the row in the course that owns
// it, else its get_content_by_id body (the class import's lookup order).
export const findRow = async (
  db: Db, customerId: string, apxCourseId: string, rowId: string, fields: string[],
): Promise<Record<string, any> | null> => {
  const rows = db.collection(CATALOG_COLLECTIONS.rows);
  const projection = Object.fromEntries([['_id', 0], ...fields.map((f) => [`raw.${f}`, 1])]);
  const row = (await rows.findOne({ customerId, apxCourseId, rowId }, { projection }))
    ?? (await rows.findOne({ customerId, rowId }, { projection }));
  if (row) return row.raw ?? {};
  const content = await db.collection(CATALOG_COLLECTIONS.content).findOne(
    { customerId, rowId },
    { projection: Object.fromEntries([['_id', 0], ...fields.map((f) => [`body.${f}`, 1])]) },
  );
  return content ? content.body ?? {} : null;
};

/** PDF link fields (no keys) of every placement of PDF and Class units, and of excluded rows. */
export const loadRowPdfFields = async (
  db: Db, customerId: string, units: ImportUnit[], plans: CoursePlan[] = [],
): Promise<Map<string, RowPdfFields>> => {
  const wanted = new Map<string, Set<string>>();
  const want = (apxCourseId: string, rowId: string) =>
    wanted.set(apxCourseId, (wanted.get(apxCourseId) ?? new Set()).add(rowId));
  for (const u of units) {
    if (u.action === 'skipped-no-link' && u.kind !== 'PDF') continue;
    for (const p of u.placements) want(p.apxCourseId, p.rowId);
  }
  for (const plan of plans) for (const ex of plan.excluded) want(plan.course.apxCourseId, ex.rowId);
  const out = new Map<string, RowPdfFields>();
  const projection = Object.fromEntries([['_id', 0], ['rowId', 1], ...FIELD_PROJECTION.map((f) => [`raw.${f}`, 1])]);
  for (const [apxCourseId, ids] of wanted) {
    const docs = await db.collection(CATALOG_COLLECTIONS.rows)
      .find({ customerId, apxCourseId, rowId: { $in: [...ids] } }, { projection }).toArray();
    for (const d of docs) out.set(fieldsKey(apxCourseId, String(d.rowId)), toFields(d.raw ?? {}));
    for (const rowId of ids) {
      if (out.has(fieldsKey(apxCourseId, rowId))) continue;
      const raw = await findRow(db, customerId, apxCourseId, rowId, FIELD_PROJECTION);
      if (raw) out.set(fieldsKey(apxCourseId, rowId), toFields(raw));
    }
  }
  return out;
};

const KEY_FIELDS: Record<PdfField, { link: string; key: string; version: string; flag: string }> = {
  link: { link: 'link', key: 'pdf_encryption_key', version: 'pdf_encryption_version', flag: 'is_pdf_encrypted' },
  pdf_link: { link: 'pdf_link', key: 'pdf_encryption_key', version: 'pdf_encryption_version', flag: 'is_pdf_encrypted' },
  pdf_link2: { link: 'pdf_link2', key: 'pdf2_encryption_key', version: 'pdf2_encryption_version', flag: 'is_pdf2_encrypted' },
};

export interface FetchSource {
  rawLink: string;
  encrypted: boolean;
  key: string;
  version: string;
}

// Read the link and its decryption inputs right before the fetch; kept in memory only.
const loadFetchSource = async (db: Db, customerId: string, source: PdfSource): Promise<FetchSource> => {
  const f = KEY_FIELDS[source.field];
  const raw = await findRow(db, customerId, source.apxCourseId, source.rowId, [f.link, f.key, f.version, f.flag]);
  if (!raw || !str(raw[f.link])) throw new PdfFetchError(`row ${source.rowId} has no ${source.field}`);
  return {
    rawLink: str(raw[f.link]),
    encrypted: isOn(raw[f.flag]),
    key: String(raw[f.key] ?? ''),
    version: str(raw[f.version]) || '1',
  };
};

// --- Fetch path ---

const isPdfMagic = (bytes: Buffer): boolean => bytes.length >= 4 && bytes.subarray(0, 4).toString('latin1') === '%PDF';

/** Decrypt when the row says so, then require `%PDF` (and the full validity gate when decrypted). */
export const verifyPdfBytes = (bytes: Buffer, src: Pick<FetchSource, 'encrypted' | 'key' | 'version'>): Buffer => {
  if (!src.encrypted) {
    if (!isPdfMagic(bytes)) throw new PdfFetchError('download is not a PDF (no %PDF header)');
    return bytes;
  }
  // AppX can retain the encrypted flag after publishing clear PDF bytes.
  // Accept only a complete structurally valid document, never header-only bytes.
  if (isValidApxPdf(bytes)) return bytes;
  const plain = decryptApxPdf(bytes, src.key, src.version);
  if (!isPdfMagic(plain) || !isValidApxPdf(plain)) {
    throw new ApxPdfDecryptError('decrypted bytes failed the PDF validity check');
  }
  return plain;
};

export interface FetchControlOptions {
  signer: Signer;
  downloader: Downloader;
  sleep?: (ms: number) => Promise<void>;
  signGapMs?: number; // minimum gap between two sign calls, default 1000
  retryDelaysMs?: number[]; // transient retries for sign and download, default 2 s, 10 s, 30 s
  throttleBaseMs?: number; // first wait after a throttled sign, doubled per repeat, default 60 s
  throttleMaxMs?: number; // cap of one wait, default 15 min
  maxThrottleWaits?: number; // waits in a row before the run stops, default 6
  log?: (message: string) => void;
}

const hostOf = (link: string): string => link.match(/^https?:\/\/([^/?#]+)/i)?.[1]?.toLowerCase() ?? '';

export interface SignerStats {
  unsigned: number; // files downloaded from a public host without a sign
  signs: number;
  throttled: number;
  throttleWaitMs: number;
  transientRetries: number;
  stoppedThrottled: boolean;
}

/**
 * The shared signer gate: serialises signs `signGapMs` apart, retries transient errors and
 * turns a throttled signer into a run-wide pause. One per run, shared by every worker.
 */
export const createFetchControl = (opts: FetchControlOptions) => {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const signGapMs = opts.signGapMs ?? 1000;
  const retryDelays = opts.retryDelaysMs ?? [2000, 10000, 30000];
  const throttleBase = opts.throttleBaseMs ?? 60000;
  const throttleMax = opts.throttleMaxMs ?? 15 * 60000;
  const maxWaits = opts.maxThrottleWaits ?? 6;
  const log = opts.log ?? (() => {});
  const stats: SignerStats = { unsigned: 0, signs: 0, throttled: 0, throttleWaitMs: 0, transientRetries: 0, stoppedThrottled: false };
  let queue: Promise<unknown> = Promise.resolve();
  let lastSignAt = 0;
  let waitsInRow = 0;
  let halted: Error | null = null; // SessionLost or the final throttle: no further AppX calls

  const retrying = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        if (attempt >= retryDelays.length || !isTransientCmsError(err)) throw err;
        stats.transientRetries++;
        log(`${label}: ${withoutUrls(err?.message ?? String(err))}; retry in ${retryDelays[attempt]} ms`);
        await sleep(retryDelays[attempt]);
      }
    }
  };

  // One sign at a time; a throttled answer waits inside the gate, so every worker pauses.
  // A deferred file made no AppX call: it is not a sign and does not hold the next one back.
  const sign = (rawLink: string, file: PdfFileUnit): Promise<string> => {
    const call = async (): Promise<string> => {
      for (;;) {
        if (halted) throw halted;
        const wait = lastSignAt + signGapMs - Date.now();
        if (wait > 0) await sleep(wait);
        let deferred = false;
        try {
          const signed = await retrying('sign', () => opts.signer(rawLink, file));
          waitsInRow = 0;
          return signed;
        } catch (err) {
          if (err instanceof SignDeferred) deferred = true;
          if (err instanceof SessionLost) halted = err;
          if (!(err instanceof SignerThrottled)) throw err;
          stats.throttled++;
          if (waitsInRow >= maxWaits) {
            stats.stoppedThrottled = true;
            halted = err;
            throw err;
          }
          const ms = Math.min(throttleBase * 2 ** waitsInRow, throttleMax);
          waitsInRow++;
          stats.throttleWaitMs += ms;
          log(`signer throttled; waiting ${Math.round(ms / 1000)} s (${waitsInRow}/${maxWaits})`);
          await sleep(ms);
        } finally {
          if (!deferred) {
            stats.signs++;
            lastSignAt = Date.now();
          }
        }
      }
    };
    const result = queue.then(call, call);
    queue = result.catch(() => undefined);
    return result;
  };

  const fetchFile = async (src: FetchSource, file: PdfFileUnit): Promise<Buffer> => {
    if (isPublicPdfHost(hostOf(src.rawLink))) {
      try {
        const bytes = verifyPdfBytes(await retrying('download', () => opts.downloader(src.rawLink)), src);
        stats.unsigned++;
        return bytes;
      } catch (err) {
        if (!(err instanceof PdfFetchError)) throw err;
      }
    }
    const signed = await sign(src.rawLink, file);
    const bytes = await retrying('download', () => opts.downloader(signed));
    return verifyPdfBytes(bytes, src);
  };

  return { fetchFile, stats };
};

// --- Ledger and indexes ---

export type SourceState = 'standalone' | 'attached' | 'waiting-class' | 'pending';
export type FileStatus = 'done' | 'waiting-class' | 'pending' | 'failed';

export interface LedgerSource {
  apxCourseId: string;
  rowId: string;
  field: PdfField;
  kind: PdfFileKind;
  classAssetKey: string | null;
  state: SourceState;
}

/** Ledger indexes and the Pdf.apxAssetKey unique index, before the first write. */
export const ensurePdfImportIndexes = async (db: Db): Promise<void> => {
  const ledger = db.collection(PDF_IMPORT_LEDGER);
  await ledger.createIndex({ customerId: 1, fileKey: 1 }, { unique: true });
  await ledger.createIndex({ customerId: 1, sha256: 1 }, { partialFilterExpression: { sha256: { $type: 'string' } } });
  const pdfs = db.collection('pdfs');
  const existing = await pdfs.indexes().catch(() => [] as any[]);
  const unique = existing.find((i: any) => JSON.stringify(i.key) === JSON.stringify({ apxAssetKey: 1 }) && i.unique);
  if (unique) return; // Pdf.ts declares it (single field, sparse); that is enough
  await pdfs.createIndex(
    { apxAssetKey: 1 },
    { unique: true, name: 'apxAssetKey_1', partialFilterExpression: { apxAssetKey: { $type: 'string' } } },
  );
};

const ledgerSource = (s: PdfSource, state: SourceState): LedgerSource => ({
  apxCourseId: s.apxCourseId, rowId: s.rowId, field: s.field, kind: s.kind, classAssetKey: s.classAssetKey, state,
});
const sourceKey = (s: { apxCourseId: string; rowId: string; field: string }) => `${s.apxCourseId}|${s.rowId}|${s.field}`;

// --- CSV context ---

export interface RunCsv {
  runId: string;
  courseTitles: ReadonlyMap<string, string>;
  run?: CsvSink | null;
  multiVersion?: CsvSink | null;
  now?: () => Date;
}

const hostOfKey = (fileKey: string): string => fileKey.match(/^url:https?:\/\/([^/]+)/)?.[1] ?? '';

const csvRow = (
  csv: RunCsv,
  s: { apxCourseId: string; rowId: string; kind: PdfFileKind; fileName: string; uploadDate: string | null; encrypted: boolean },
  host: string | null,
  rest: CsvRow & { action: RunAction },
): CsvRow => ({
  run_id: csv.runId,
  timestamp: (csv.now ?? (() => new Date()))().toISOString(),
  kind: s.kind,
  apx_course_id: s.apxCourseId,
  course_title: csv.courseTitles.get(s.apxCourseId) ?? '',
  row_id: s.rowId,
  file_name: s.fileName,
  host: host ?? '',
  upload_date: s.uploadDate ?? '',
  encrypted: s.encrypted,
  multi_version: false,
  ...rest,
  reason: rest.reason == null ? '' : withoutUrls(String(rest.reason)),
});

// --- Runs ---

export interface ImportSummary {
  files: number;
  fetched: number;
  created: number;
  reusedSameHash: number;
  fetchSkipped: number; // ledger already had a Pdf
  attached: number;
  multiVersionPdfs: number;
  status: Record<FileStatus, number>;
  ledgerWritten: number;
  failures: { file: string; host: string | null; error: string }[];
  sessionLost: boolean;
  stoppedThrottled: boolean;
  notReached: number;
  leftForLater: number; // the signer deferred them (SignDeferred); nothing written
  signer: SignerStats;
}

export interface CommitPdfOptions extends FetchControlOptions {
  db: Db;
  customerId: string;
  runId: string;
  plan: PdfImportPlan;
  files?: PdfFileUnit[]; // scope and order (--courses, --kind, --limit); default every file in the plan, public hosts first
  uploader: Uploader;
  concurrency?: number;
  csv?: Omit<RunCsv, 'runId'> | null;
  /** After each file of phase 1 (the live sheet's done / planned); a throw here is ignored. */
  onProgress?: (p: { done: number; planned: number }) => void;
}

interface ClassRef {
  id: Types.ObjectId;
  title: string;
}

// The Class a note goes on: the class import's ledger first, else Class.apxAssetKey. `preload`
// resolves many keys in a few queries; a miss is cached for the rest of the run.
const classResolver = (db: Db, customerId: string) => {
  const cache = new Map<string, ClassRef | null>();
  const resolve = async (assetKey: string): Promise<ClassRef | null> => {
    if (!cache.has(assetKey)) await resolve.preload([assetKey]);
    return cache.get(assetKey) ?? null;
  };
  resolve.preload = async (assetKeys: Iterable<string>): Promise<void> => {
    const todo = [...new Set(assetKeys)].filter((k) => !cache.has(k));
    for (let i = 0; i < todo.length; i += 1000) {
      const chunk = todo.slice(i, i + 1000);
      const ledgerRows = await db.collection(IMPORT_LEDGER)
        .find({ customerId, assetKey: { $in: chunk } }, { projection: { assetKey: 1, classId: 1 } }).toArray();
      const idByKey = new Map(ledgerRows.filter((r) => r.classId).map((r) => [String(r.assetKey), String(r.classId)]));
      const byId = new Map((await Class.find({ _id: { $in: [...idByKey.values()] } }).select('_id title').lean())
        .map((c) => [String(c._id), c]));
      const byKey = new Map((await Class.find({ apxAssetKey: { $in: chunk.filter((k) => !idByKey.has(k)) } }).select('_id title apxAssetKey').lean())
        .map((c) => [String(c.apxAssetKey), c]));
      for (const key of chunk) {
        const doc = idByKey.has(key) ? byId.get(idByKey.get(key)!) : byKey.get(key);
        cache.set(key, doc ? { id: doc._id as Types.ObjectId, title: String(doc.title ?? '') } : null);
      }
    }
  };
  return resolve;
};

// Push a Pdf onto a Class once (pdfAssignments + pdfIds, the fields the 472 note port wrote).
// One pipeline update, so the priority is the next free one even with other writers.
const attachToClass = async (classId: Types.ObjectId, pdfId: Types.ObjectId): Promise<boolean> => {
  const assignments = { $ifNull: ['$pdfAssignments', []] };
  const ids = { $ifNull: ['$pdfIds', []] };
  const res = await Class.collection.updateOne(
    { _id: classId, 'pdfAssignments.pdfId': { $ne: pdfId } },
    [{
      $set: {
        pdfAssignments: { $concatArrays: [assignments, [{
          _id: new Types.ObjectId(), pdfId, priority: { $add: [{ $size: assignments }, 1] }, isFree: false,
        }]] },
        pdfIds: { $concatArrays: [ids, { $cond: [{ $in: [pdfId, ids] }, [], [pdfId]] }] },
      },
    }],
  );
  return res.modifiedCount > 0;
};

const statusOf = (sources: LedgerSource[]): FileStatus => {
  if (sources.some((s) => s.state === 'pending')) return 'pending';
  if (sources.some((s) => s.state === 'waiting-class')) return 'waiting-class';
  return 'done';
};

// Bounded worker pool that stops picking new items once `stopped()` is true.
const pool = async <T>(items: T[], concurrency: number, stopped: () => boolean, work: (item: T) => Promise<void>) => {
  let next = 0;
  const worker = async () => {
    while (!stopped() && next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return items.length - next;
};

// Serialise work per key (one sha256 → one Pdf even when two workers hold the same bytes).
const keyedLock = () => {
  const tails = new Map<string, Promise<unknown>>();
  return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = tails.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    return run;
  };
};

export const sha256Of = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

export const commitPdfImport = async (opts: CommitPdfOptions): Promise<ImportSummary> => {
  const { db, customerId, runId, plan, uploader } = opts;
  const log = opts.log ?? (() => {});
  const files = opts.files ?? orderPublicFirst(plan.files);
  const ledger = db.collection(PDF_IMPORT_LEDGER);
  const csv: RunCsv = { runId, courseTitles: new Map(), ...(opts.csv ?? {}) };
  const appendRun = (rows: CsvRow[]) => csv.run?.append(rows);
  await ensurePdfImportIndexes(db);
  const taxonomy: ImportTaxonomyIds = await ensureImportTaxonomy();
  const resolveClass = classResolver(db, customerId);
  const control = createFetchControl({ ...opts, log });
  const lock = keyedLock();

  const summary: ImportSummary = {
    files: files.length, fetched: 0, created: 0, reusedSameHash: 0, fetchSkipped: 0, attached: 0, multiVersionPdfs: 0,
    status: { done: 0, 'waiting-class': 0, pending: 0, failed: 0 },
    ledgerWritten: 0, failures: [], sessionLost: false, stoppedThrottled: false, notReached: 0, leftForLater: 0,
    signer: control.stats,
  };
  let stop = false;

  // Phase 1: one Pdf per file, merged by content hash.
  const fetchOne = async (file: PdfFileUnit) => {
    const prior = await ledger.findOne({ customerId, fileKey: file.fileKey }, { projection: { pdfId: 1 } });
    if (prior?.pdfId) {
      summary.fetchSkipped++;
      return;
    }
    const hasNotes = file.sources.some((s) => s.kind === 'note');
    const record = async (pdfId: Types.ObjectId, sha: string | null, size: number | null, origin: 'created' | 'reused_same_hash') => {
      await ledger.updateOne(
        { customerId, fileKey: file.fileKey },
        {
          $set: {
            pdfId, sha256: sha, sizeBytes: size, origin, kind: file.kind,
            sources: file.sources.map((s) => ledgerSource(s, s.kind === 'standalone' ? 'standalone' : 'pending')),
            status: hasNotes ? 'pending' : 'done', error: null, runId, updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      summary.ledgerWritten++;
      if (origin === 'created') summary.created++;
      else summary.reusedSameHash++;
      appendRun(file.sources.filter((s) => s.kind === 'standalone').map((s) => csvRow(csv, s, file.urlHost, {
        action: origin, pdf_id: String(pdfId), sha256: sha ?? '', size_bytes: size ?? '',
        reason: origin === 'reused_same_hash' ? 'same sha256 as an earlier file' : '',
      })));
    };
    try {
      const byKey = await Pdf.findOne({ apxAssetKey: file.fileKey }).select('_id pdfAsset').lean();
      if (byKey) {
        await record(byKey._id as Types.ObjectId, byKey.pdfAsset?.sha256 ?? null, byKey.pdfAsset?.sizeBytes ?? null, 'created');
        return;
      }
      const src = await loadFetchSource(db, customerId, file.sources[0]);
      const bytes = await control.fetchFile(src, file);
      summary.fetched++;
      const sha = sha256Of(bytes);
      await lock(sha, async () => {
        const twin = await ledger.findOne({ customerId, sha256: sha, pdfId: { $ne: null } }, { projection: { pdfId: 1 } });
        if (twin) {
          await record(twin.pdfId as Types.ObjectId, sha, bytes.length, 'reused_same_hash');
          return;
        }
        const pdfAsset = await uploader(bytes, pdfObjectKey(file.fileKey));
        let pdfId: Types.ObjectId;
        try {
          pdfId = (await Pdf.create({
            title: file.title,
            pdfAsset: { ...pdfAsset, sha256: pdfAsset.sha256 ?? sha },
            teacherName: CLASS_IMPORT_TEACHER,
            mainCategory: taxonomy.mainCategory,
            category: taxonomy.category,
            section: taxonomy.section,
            topic: null,
            status: file.active ? 1 : 0,
            isFree: false,
            isDownloadable: true,
            apxAssetKey: file.fileKey,
          }))._id as Types.ObjectId;
        } catch (err: any) {
          const raced = err?.code === 11000 ? await Pdf.findOne({ apxAssetKey: file.fileKey }).select('_id').lean() : null;
          if (!raced) throw err;
          pdfId = raced._id as Types.ObjectId;
        }
        await record(pdfId, sha, bytes.length, 'created');
      });
    } catch (err: any) {
      if (err instanceof SignDeferred) {
        summary.leftForLater++;
        return;
      }
      if (err instanceof SessionLost) {
        summary.sessionLost = true;
        stop = true;
        log(`session lost: ${withoutUrls(err.message)}; run stopped`);
        return;
      }
      if (err instanceof SignerThrottled) {
        summary.stoppedThrottled = true;
        stop = true;
        log('signer still throttled after the last wait; run stopped');
        return;
      }
      const error = withoutUrls(err?.message ?? String(err));
      summary.failures.push({ file: fileRef(file.fileKey), host: file.urlHost, error });
      await ledger.updateOne(
        { customerId, fileKey: file.fileKey },
        {
          $set: { kind: file.kind, status: 'failed', error, runId, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date(), pdfId: null, sources: [] },
        },
        { upsert: true },
      );
      appendRun(file.sources.map((s) => csvRow(csv, s, file.urlHost, { action: 'failed', reason: error })));
      log(`FAILED ${fileRef(file.fileKey)}: ${error}`);
    }
  };
  let done = 0;
  summary.notReached = await pool(files, opts.concurrency ?? 2, () => stop, async (file) => {
    await fetchOne(file);
    done++;
    try {
      opts.onProgress?.({ done, planned: files.length });
    } catch {
      // progress is for the live sheet only
    }
  });

  // Phase 2: attach notes, DB only.
  const fileByKey = new Map(plan.files.map((f) => [f.fileKey, f]));
  const scope = new Set(files.map((f) => f.fileKey));
  const targets = plan.noteTargets.filter((t) => t.slots.some((sl) => sl.variants.some((v) => scope.has(v.fileKey))));
  const keys = new Set([...scope, ...targets.flatMap((t) => t.slots.flatMap((sl) => sl.variants.map((v) => v.fileKey)))]);
  const rows = new Map((await ledger.find({ customerId, fileKey: { $in: [...keys] } }).toArray()).map((r) => [String(r.fileKey), r]));

  interface NoteOutcome { state: SourceState; action: RunAction; reason: string; classRef: ClassRef | null; multi: boolean; label: string }
  const outcomes = new Map<string, NoteOutcome>(); // `${fileKey}#${sourceKey}`
  const multiFlags = new Map<string, string>(); // fileKey → versionGroup
  const outcomeKey = (fileKey: string, s: PdfSource) => `${fileKey}#${sourceKey(s)}`;

  await resolveClass.preload(targets.map((t) => t.classAssetKey));
  for (const t of targets) {
    const classRef = await resolveClass(t.classAssetKey);
    for (const sl of t.slots) {
      const srcs = sl.variants.flatMap((v) => (fileByKey.get(v.fileKey)?.sources ?? [])
        .filter((s) => s.kind === 'note' && s.classAssetKey === t.classAssetKey && s.field === sl.slot)
        .map((s) => ({ fileKey: v.fileKey, s })));
      const set = (list: typeof srcs, o: Omit<NoteOutcome, 'classRef'>) => {
        for (const { fileKey, s } of list) outcomes.set(outcomeKey(fileKey, s), { ...o, classRef });
      };
      if (!classRef) {
        set(srcs, { state: 'waiting-class', action: 'waiting_class', reason: 'the class is not imported yet', multi: false, label: '' });
        continue;
      }
      const missing = sl.variants.filter((v) => !rows.get(v.fileKey)?.pdfId);
      if (missing.length) {
        set(srcs, { state: 'pending', action: 'failed', reason: `${missing.length} version(s) of this note not fetched yet`, multi: false, label: '' });
        continue;
      }
      // Distinct Pdfs (equal hashes already share one), oldest upload first.
      const groups = new Map<string, { pdfId: Types.ObjectId; variants: NoteVariant[] }>();
      for (const v of sl.variants) {
        const pdfId = rows.get(v.fileKey)!.pdfId as Types.ObjectId;
        const g = groups.get(String(pdfId)) ?? { pdfId, variants: [] };
        g.variants.push(v);
        groups.set(String(pdfId), g);
      }
      const ordered = [...groups.values()].map((g) => ({ ...g, variants: [...g.variants].sort(compareOldest) }))
        .sort((a, b) => compareOldest(a.variants[0], b.variants[0]));
      const multi = ordered.length > 1;
      for (const g of ordered) {
        const fileKeys = new Set(g.variants.map((v) => v.fileKey));
        const mine = srcs.filter((x) => fileKeys.has(x.fileKey))
          .sort((a, b) => (a.s.uploadDate ?? '9999').localeCompare(b.s.uploadDate ?? '9999') || a.s.createdAt.localeCompare(b.s.createdAt));
        const courseIds = [...new Set(mine.map((x) => x.s.apxCourseId))];
        const label = multi ? versionLabel(courseIds.map((c) => csv.courseTitles.get(c) ?? `Course ${c}`)) : '';
        if (multi && [...fileKeys].every((fk) => fileByKey.get(fk)?.kind === 'note')) {
          const title = versionTitle(classRef.title, sl.slot, label);
          await Pdf.updateOne({ _id: g.pdfId, title: { $ne: title } }, { $set: { title } });
        }
        const modified = await attachToClass(classRef.id, g.pdfId);
        if (modified) summary.attached++;
        mine.forEach((x, i) => outcomes.set(outcomeKey(x.fileKey, x.s), {
          state: 'attached', action: modified && i === 0 ? 'attached' : 'already_attached',
          reason: multi ? `one of ${ordered.length} versions on this class` : '', classRef, multi, label,
        }));
        if (!multi) continue;
        const newlyFlagged = [...fileKeys].some((fk) => !rows.get(fk)?.multiVersion);
        for (const fk of fileKeys) multiFlags.set(fk, t.classAssetKey);
        summary.multiVersionPdfs++;
        if (newlyFlagged) {
          const r = rows.get(g.variants[0].fileKey)!;
          csv.multiVersion?.append([{
            class_id: String(classRef.id), class_title: classRef.title, version_label: label,
            source_courses: courseIds.map((c) => `${c} ${csv.courseTitles.get(c) ?? ''}`.trim()).join(' | '),
            upload_date: g.variants[0].uploadDate ?? '', sha256: r.sha256 ?? '', size_bytes: r.sizeBytes ?? '', pdf_id: String(g.pdfId),
          }]);
        }
      }
    }
  }

  // Ledger: final source states, status and flags, written only when they changed.
  for (const fileKey of keys) {
    const file = fileByKey.get(fileKey);
    const prior = rows.get(fileKey);
    if (!file || !prior?.pdfId) {
      if (prior?.status === 'failed' && scope.has(fileKey)) summary.status.failed++;
      continue;
    }
    const priorStates = new Map<string, SourceState>((prior.sources ?? []).map((s: LedgerSource) => [sourceKey(s), s.state]));
    const runRows: CsvRow[] = [];
    const sources = file.sources.map((s) => {
      if (s.kind === 'standalone') {
        if (!priorStates.has(sourceKey(s))) {
          runRows.push(csvRow(csv, s, file.urlHost, {
            action: 'created', pdf_id: String(prior.pdfId), sha256: prior.sha256 ?? '', size_bytes: prior.sizeBytes ?? '',
            reason: 'new placement of an existing Pdf',
          }));
        }
        return ledgerSource(s, 'standalone');
      }
      const o = outcomes.get(outcomeKey(fileKey, s));
      if (!o) return ledgerSource(s, priorStates.get(sourceKey(s)) ?? 'pending');
      if (priorStates.get(sourceKey(s)) !== o.state || o.action === 'attached') {
        runRows.push(csvRow(csv, s, file.urlHost, {
          action: o.action, class_id: o.classRef ? String(o.classRef.id) : '', class_title: o.classRef?.title ?? '',
          pdf_id: String(prior.pdfId), sha256: prior.sha256 ?? '', size_bytes: prior.sizeBytes ?? '',
          reason: [o.reason, prior.origin === 'reused_same_hash' ? 'same sha256 as an earlier file' : ''].filter(Boolean).join('; '),
          multi_version: o.multi, version_label: o.label,
        }));
      }
      return ledgerSource(s, o.state);
    });
    const status = statusOf(sources);
    if (scope.has(fileKey)) summary.status[status]++;
    const group = multiFlags.get(fileKey) ?? prior.versionGroup ?? null;
    const multiVersion = Boolean(group);
    appendRun(runRows);
    if (prior.status === status && JSON.stringify(prior.sources ?? []) === JSON.stringify(sources)
      && Boolean(prior.multiVersion) === multiVersion && (prior.versionGroup ?? null) === group) continue;
    await ledger.updateOne(
      { customerId, fileKey },
      { $set: { sources, status, multiVersion, versionGroup: group, updatedAt: new Date() } },
    );
    summary.ledgerWritten++;
  }
  return summary;
};

export interface FetchCheckResult {
  fileKey: string; // in memory only; print fileRef
  file: string; // fileRef
  kind: string;
  host: string | null;
  encrypted: boolean;
  ok: boolean;
  degraded: boolean; // AppX 5xx / timeout after the retries: AppX was degraded, not the file
  bytes: number | null;
  sha256: string | null;
  ms: number;
  error: string | null;
}

/** Sign, download and decrypt `files` in memory. Uploads nothing, writes nothing. */
export const fetchCheck = async (
  opts: FetchControlOptions & { db: Db; customerId: string; files: PdfFileUnit[] },
): Promise<{ results: FetchCheckResult[]; sessionLost: boolean; stoppedThrottled: boolean; signer: SignerStats }> => {
  const control = createFetchControl(opts);
  const results: FetchCheckResult[] = [];
  for (const file of opts.files) {
    const started = Date.now();
    const base = { fileKey: file.fileKey, file: fileRef(file.fileKey), kind: file.kind, host: file.urlHost };
    try {
      const src = await loadFetchSource(opts.db, opts.customerId, file.sources[0]);
      const bytes = await control.fetchFile(src, file);
      results.push({ ...base, encrypted: src.encrypted, ok: true, degraded: false, bytes: bytes.length, sha256: sha256Of(bytes), ms: Date.now() - started, error: null });
    } catch (err: any) {
      results.push({ ...base, encrypted: file.encrypted, ok: false, degraded: isTransientCmsError(err), bytes: null, sha256: null, ms: Date.now() - started, error: withoutUrls(err?.message ?? String(err)) });
      if (err instanceof SessionLost) return { results, sessionLost: true, stoppedThrottled: false, signer: control.stats };
      if (err instanceof SignerThrottled) return { results, sessionLost: false, stoppedThrottled: true, signer: control.stats };
    }
  }
  return { results, sessionLost: false, stoppedThrottled: false, signer: control.stats };
};

/**
 * The CSV rows a commit would write, from the plan and the DB (read only): standalone files
 * `created`, notes `attached` or `waiting_class`, multi-version slots labelled per file (before
 * hashing: equal hashes merge at commit), excluded rows `skipped_hidden`. `fetched` fills the
 * hash and size of fetch-checked files.
 */
export const plannedCsvRows = async (
  db: Db, customerId: string, plan: PdfImportPlan, files: PdfFileUnit[], skipped: SkippedPdfRow[],
  csv: RunCsv, fetched: ReadonlyMap<string, FetchCheckResult> = new Map(),
): Promise<{ run: CsvRow[]; multiVersion: CsvRow[] }> => {
  const resolveClass = classResolver(db, customerId);
  const targets = new Map(plan.noteTargets.map((t) => [t.classAssetKey, t]));
  await resolveClass.preload(plan.noteTargets.map((t) => t.classAssetKey));
  const run: CsvRow[] = [];
  const multiVersion: CsvRow[] = [];
  const mvSeen = new Set<string>();
  for (const file of files) {
    const f = fetched.get(file.fileKey);
    const hash = f ? { sha256: f.sha256 ?? '', size_bytes: f.bytes ?? '' } : {};
    const failed = f && !f.ok ? { action: 'failed' as const, reason: f.error ?? '' } : null;
    for (const s of file.sources) {
      if (s.kind === 'standalone') {
        run.push(csvRow(csv, s, file.urlHost, { ...hash, ...(failed ?? { action: 'created', reason: 'planned' }) }));
        continue;
      }
      const t = s.classAssetKey ? targets.get(s.classAssetKey) : undefined;
      const classRef = t ? await resolveClass(t.classAssetKey) : null;
      const cls = { class_id: classRef ? String(classRef.id) : '', class_title: classRef?.title ?? t?.title ?? '' };
      if (!classRef) {
        run.push(csvRow(csv, s, file.urlHost, { ...hash, ...cls, action: 'waiting_class', reason: 'the class is not imported yet' }));
        continue;
      }
      const slot = t!.slots.find((x) => x.slot === s.field);
      const multi = (slot?.variants.length ?? 0) > 1;
      const courseIds = [...new Set(file.sources.filter((x) => x.classAssetKey === s.classAssetKey && x.field === s.field).map((x) => x.apxCourseId))];
      const label = multi ? versionLabel(courseIds.map((c) => csv.courseTitles.get(c) ?? `Course ${c}`)) : '';
      run.push(csvRow(csv, s, file.urlHost, {
        ...hash, ...cls, ...(failed ?? { action: 'attached', reason: multi ? `planned: one of ${slot!.variants.length} versions; equal hashes merge at commit` : 'planned' }),
        multi_version: multi, version_label: label,
      }));
      const mvKey = `${t!.classAssetKey}|${s.field}|${file.fileKey}`;
      if (multi && !mvSeen.has(mvKey)) {
        mvSeen.add(mvKey);
        multiVersion.push({
          class_id: cls.class_id, class_title: cls.class_title, version_label: versionTitle(cls.class_title, s.field as NoteSlot, label),
          source_courses: courseIds.map((c) => `${c} ${csv.courseTitles.get(c) ?? ''}`.trim()).join(' | '),
          upload_date: s.uploadDate ?? '', sha256: f?.sha256 ?? '', size_bytes: f?.bytes ?? '', pdf_id: '',
        });
      }
    }
  }
  for (const k of skipped) {
    run.push(csvRow(csv, { ...k, uploadDate: null, encrypted: false }, k.host, { action: 'skipped_hidden', reason: k.reason }));
  }
  return { run, multiVersion };
};

/** Dry-run state of the plan against the DB: ledger statuses and note targets with no Class yet. */
export const dryRunState = async (db: Db, customerId: string, plan: PdfImportPlan) => {
  const resolveClass = classResolver(db, customerId);
  let waitingClass = 0;
  await resolveClass.preload(plan.noteTargets.map((t) => t.classAssetKey));
  const classTitles = new Map<string, string>();
  for (const t of plan.noteTargets) {
    const ref = await resolveClass(t.classAssetKey);
    if (ref) classTitles.set(t.classAssetKey, ref.title);
    else waitingClass++;
  }
  const ledgerStatus: Record<string, number> = {};
  const rows = await db.collection(PDF_IMPORT_LEDGER).find({ customerId }, { projection: { status: 1 } }).toArray();
  for (const r of rows) ledgerStatus[String(r.status)] = (ledgerStatus[String(r.status)] ?? 0) + 1;
  return { waitingClassTargets: waitingClass, ledgerStatus, classTitles };
};
