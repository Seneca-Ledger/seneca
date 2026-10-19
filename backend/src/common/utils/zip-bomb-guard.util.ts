const EOCD_SIGNATURE = 0x06054b50; // 'PK\x05\x06' little-endian
const CENTRAL_DIR_SIGNATURE = 0x02014b50; // 'PK\x01\x02' little-endian
const LOCAL_FILE_SIGNATURE = 0x04034b50; // 'PK\x03\x04' little-endian
const EOCD_FIXED_SIZE = 22;
const CENTRAL_DIR_RECORD_FIXED_SIZE = 46;
const LOCAL_FILE_HEADER_FIXED_SIZE = 30;
const MAX_EOCD_COMMENT_LENGTH = 0xffff; // the comment-length field is 16-bit
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const ZIP64_EXTRA_FIELD_TAG = 0x0001;
const GENERAL_PURPOSE_DATA_DESCRIPTOR_FLAG = 0x0008;

const DEFAULT_MAX_RATIO = 200; // real XLSX/DOCX worksheet XML typically compresses 5-20:1
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;

/**
 * Scans backward from the end of the buffer for the End Of Central
 * Directory record signature. EOCD is a fixed 22-byte record optionally
 * followed by a comment of up to 65535 bytes, so it isn't necessarily the
 * very last 22 bytes.
 */
function findEndOfCentralDirectory(buffer: Buffer): number | null {
  const searchFloor = Math.max(0, buffer.length - EOCD_FIXED_SIZE - MAX_EOCD_COMMENT_LENGTH);
  for (let offset = buffer.length - EOCD_FIXED_SIZE; offset >= searchFloor; offset--) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return null;
}

/**
 * Throws if a declared compressed/uncompressed size pair is a ZIP64 sentinel
 * (unsupported) or exceeds the per-entry compression ratio cap. `context`
 * identifies which of the two independent size sources (central directory vs
 * local file header — see `assertSafeZipDecompressionRatio`) is being checked.
 */
function assertRatioWithinBounds(
  compressedSize: number,
  uncompressedSize: number,
  maxRatio: number,
  context: string,
): void {
  if (compressedSize === ZIP64_SENTINEL_32 || uncompressedSize === ZIP64_SENTINEL_32) {
    throw new Error(`Unsupported ZIP entry: ZIP64 size format (${context})`);
  }
  if (compressedSize > 0 && uncompressedSize / compressedSize > maxRatio) {
    throw new Error(`ZIP entry compression ratio exceeds ${maxRatio}:1 (${context})`);
  }
}

/**
 * Walks the TLV records of a ZIP "extra field" region looking for a ZIP64
 * Extended Information TLV (type 0x0001). `xlsx.js`'s own `parse_extra_field`
 * applies that TLV's usz/csz as an unconditional override on top of whatever
 * the fixed 32-bit size fields said — regardless of whether those fields
 * were actually the ZIP64 sentinel (confirmed by reading `parse_extra_field`
 * directly: it applies the override on TLV *presence* alone) — so validating
 * only the fixed-size fields isn't enough; an entry can declare small,
 * non-sentinel sizes everywhere this guard reads while a ZIP64 extra field
 * silently overrides the size `xlsx.js` actually uses. Each TLV is
 * `type:u16, size:u16, <size bytes>`, the same layout `parse_extra_field` reads.
 */
function hasZip64ExtraField(
  buffer: Buffer,
  extraFieldOffset: number,
  extraFieldLength: number,
): boolean {
  if (extraFieldLength === 0) {
    return false;
  }
  if (extraFieldOffset + extraFieldLength > buffer.length) {
    throw new Error('Malformed ZIP extra field');
  }

  let cursor = extraFieldOffset;
  const end = extraFieldOffset + extraFieldLength;
  while (cursor + 4 <= end) {
    const tag = buffer.readUInt16LE(cursor);
    const size = buffer.readUInt16LE(cursor + 2);
    if (tag === ZIP64_EXTRA_FIELD_TAG) {
      return true;
    }
    cursor += 4 + size;
  }
  return false;
}

interface CentralDirRecord {
  uncompressedSize: number;
  /** Absolute buffer offset of this entry's local file header. */
  localHeaderOffset: number;
  /** Byte length of this record: fixed header + filename + extra field + comment. */
  recordLength: number;
}

/**
 * Reads and validates one central directory record at `offset`. Throws on
 * anything this guard can't safely reason about (ZIP64) or that individually
 * exceeds `maxRatio`.
 */
function readCentralDirRecord(buffer: Buffer, offset: number, maxRatio: number): CentralDirRecord {
  if (
    offset + CENTRAL_DIR_RECORD_FIXED_SIZE > buffer.length ||
    buffer.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE
  ) {
    // Once a valid EOCD commits us to reading exactly `entryCount` records,
    // anything that doesn't match that expectation (truncated buffer, wrong
    // signature) is adversarial, not "end of data reached" — fail closed.
    throw new Error('Malformed ZIP central directory');
  }

  const compressedSize = buffer.readUInt32LE(offset + 20);
  const uncompressedSize = buffer.readUInt32LE(offset + 24);
  const fileNameLength = buffer.readUInt16LE(offset + 28);
  const extraFieldLength = buffer.readUInt16LE(offset + 30);
  const fileCommentLength = buffer.readUInt16LE(offset + 32);
  const localHeaderOffset = buffer.readUInt32LE(offset + 42);

  if (
    hasZip64ExtraField(
      buffer,
      offset + CENTRAL_DIR_RECORD_FIXED_SIZE + fileNameLength,
      extraFieldLength,
    )
  ) {
    throw new Error('Unsupported ZIP entry: ZIP64 extra field (central directory)');
  }
  assertRatioWithinBounds(compressedSize, uncompressedSize, maxRatio, 'central directory');

  return {
    uncompressedSize,
    localHeaderOffset,
    recordLength:
      CENTRAL_DIR_RECORD_FIXED_SIZE + fileNameLength + extraFieldLength + fileCommentLength,
  };
}

/**
 * Reads and validates the size fields from the local file header at
 * `offset`, returning its declared uncompressed size. See
 * `assertSafeZipDecompressionRatio` for why this must be checked in addition
 * to the central directory's copy of the same entry's sizes.
 */
function readLocalFileHeaderUncompressedSize(
  buffer: Buffer,
  offset: number,
  maxRatio: number,
): number {
  if (
    offset < 0 ||
    offset + LOCAL_FILE_HEADER_FIXED_SIZE > buffer.length ||
    buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE
  ) {
    throw new Error('Malformed ZIP local file header');
  }

  const flags = buffer.readUInt16LE(offset + 6);
  if (flags & GENERAL_PURPOSE_DATA_DESCRIPTOR_FLAG) {
    // Bit 3 ("streaming" mode) means this header's own csz/usz are
    // legitimately 0 and the real sizes only appear in a trailing data
    // descriptor written AFTER the compressed data — but `xlsx.js` reads
    // (and cross-checks) that descriptor only *after* it has already
    // decompressed using these zeroed/unbounded values (confirmed in
    // `parse_local_file`: `_inflateRawSync(blob, _usz)` runs before the
    // `flags & 8` branch that re-reads the real sizes). There is no
    // pre-declared, trustworthy size field for such an entry — reject
    // rather than silently letting it through unchecked.
    throw new Error('Unsupported ZIP entry: streaming (data-descriptor) entries are not supported');
  }

  const compressedSize = buffer.readUInt32LE(offset + 18);
  const uncompressedSize = buffer.readUInt32LE(offset + 22);
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraFieldLength = buffer.readUInt16LE(offset + 28);

  if (
    hasZip64ExtraField(
      buffer,
      offset + LOCAL_FILE_HEADER_FIXED_SIZE + fileNameLength,
      extraFieldLength,
    )
  ) {
    throw new Error('Unsupported ZIP entry: ZIP64 extra field (local file header)');
  }
  assertRatioWithinBounds(compressedSize, uncompressedSize, maxRatio, 'local file header');
  return uncompressedSize;
}

/**
 * Rejects a ZIP-based file (xlsx/docx/...) whose declared decompressed size
 * is implausible relative to its compressed size — a decompression bomb.
 *
 * This must agree with what `xlsx.js` itself actually does, not with the ZIP
 * spec in the abstract — verified by reading `parse_zip`/`parse_local_file`
 * in `node_modules/xlsx/xlsx.js` directly. Two things about that
 * implementation are easy to get wrong and both are checked for explicitly:
 *
 * 1. Entry count: `parse_zip` reads the loop bound from EOCD **offset+8**
 *    ("number of central directory records on this disk"), never from
 *    offset+10 ("total number of central directory records"). A crafted
 *    archive can set these two 16-bit fields differently so that a guard
 *    reading offset+10 walks fewer entries than xlsx.js actually will,
 *    hiding a bomb entry from the guard entirely. A real single-disk
 *    archive (the only kind any real XLSX/DOCX writer produces) always has
 *    them equal, so this guard reads offset+8 (matching xlsx.js) and also
 *    throws if the two fields disagree, rather than silently trusting either
 *    one alone.
 *
 * 2. Size source: `parse_zip` passes the central directory's declared
 *    compressed/uncompressed sizes into `parse_local_file` only as
 *    *expected* values for a post-hoc consistency check. The buffer that
 *    actually gets allocated and decompressed into (`new_unsafe_buf(usz)` in
 *    the pure-JS `inflate()` — the code path this app hits, since nothing in
 *    this codebase calls xlsx's `use_zlib()` to wire up native zlib) is
 *    sized from the **local file header's own** size fields, read
 *    independently a second time by `parse_local_file`. The comparison
 *    against the central directory's values happens only *after* that
 *    allocation and decompression already ran. So a crafted entry can
 *    declare small, benign sizes in the central directory (satisfying a
 *    guard that only reads the central directory) while its local file
 *    header — which is what the allocation size actually comes from —
 *    declares a huge one. This guard therefore reads and validates the size
 *    fields from *both* locations for every entry and uses the larger
 *    declared uncompressed size toward the running total, so neither field
 *    can lie low on its own.
 *
 * 3. Extra fields: even when the fixed-size fields above pass, a ZIP64
 *    "extra field" TLV (type 0x0001) attached to EITHER record unconditionally
 *    overrides the size `xlsx.js` uses, regardless of whether the fixed
 *    fields were the ZIP64 sentinel — so `hasZip64ExtraField` rejects any
 *    entry carrying one rather than trying to also validate its value.
 *
 * 4. Streaming entries: general-purpose flag bit 3 means a local header's own
 *    csz/usz are legitimately 0, with real sizes deferred to a trailing data
 *    descriptor that `xlsx.js` only reads *after* it has already decompressed
 *    using the zeroed (effectively unbounded-growth) values — so there is no
 *    pre-declared, trustworthy size for such an entry, and it's rejected
 *    outright rather than guessed at.
 *
 * An earlier version of this guard instead walked local file headers
 * sequentially from byte 0 (rather than via the central directory at all),
 * which a crafted file can defeat completely: a ZIP's local headers don't
 * have to start at byte 0, so that scan could hit non-matching bytes
 * immediately and report "nothing to check" while the real entries —
 * findable via a correct central-directory walk — decompressed to
 * gigabytes.
 *
 * This must run BEFORE handing the buffer to a ZIP-aware parser: `xlsx`'s
 * `sheetRows` option only skips converting rows into JS objects after an
 * entry has already been fully inflated — it does not bound the
 * decompression itself.
 *
 * Design note after several rounds of review kept finding one more
 * `xlsx.js`-specific field this guard didn't yet account for: the fix here
 * is deliberately an *allowlist*, not one more special case. Rather than
 * trying to enumerate every way a size can be smuggled past a naive check,
 * this guard now rejects every entry shape it doesn't fully understand
 * (ZIP64 sizes, ZIP64 extra fields, streaming/data-descriptor entries,
 * multi-disk archives) and only proceeds for the narrow, fully-modeled case:
 * a single-disk archive of complete (non-streamed), non-ZIP64 entries whose
 * central directory and local file header sizes are both directly readable.
 * Real XLSX/DOCX writers (this app's own `XLSX.write()`, Excel, Google
 * Sheets, LibreOffice) produce exactly that shape for files at the sizes
 * this app accepts (10-25MB compressed caps enforced elsewhere); this
 * guard intentionally declines to support anything else rather than risk
 * validating a field xlsx.js doesn't actually key its allocation off of.
 */
export function assertSafeZipDecompressionRatio(
  buffer: Buffer,
  options: { maxRatio?: number; maxUncompressedBytes?: number } = {},
): void {
  const maxRatio = options.maxRatio ?? DEFAULT_MAX_RATIO;
  const maxUncompressedBytes = options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES;

  if (buffer.length < EOCD_FIXED_SIZE) {
    return; // Too small to contain a ZIP structure — not this guard's concern.
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === null) {
    // Not a ZIP (or one this guard doesn't recognize) — format rejection is
    // a separate concern (the caller's own magic-byte check, or xlsx.read
    // failing on its own).
    return;
  }

  const entryCountThisDisk = buffer.readUInt16LE(eocdOffset + 8);
  const entryCountTotal = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (entryCountThisDisk === ZIP64_SENTINEL_16 || centralDirOffset === ZIP64_SENTINEL_32) {
    throw new Error('Unsupported ZIP: ZIP64 central directory');
  }
  if (entryCountThisDisk !== entryCountTotal) {
    throw new Error('Unsupported ZIP: multi-disk archive (entry count fields disagree)');
  }

  let offset = centralDirOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < entryCountThisDisk; i++) {
    const record = readCentralDirRecord(buffer, offset, maxRatio);
    const localUncompressedSize = readLocalFileHeaderUncompressedSize(
      buffer,
      record.localHeaderOffset,
      maxRatio,
    );

    totalUncompressed += Math.max(record.uncompressedSize, localUncompressedSize);
    if (totalUncompressed > maxUncompressedBytes) {
      throw new Error(`ZIP contents would decompress to more than ${maxUncompressedBytes} bytes`);
    }

    offset += record.recordLength;
  }
}
