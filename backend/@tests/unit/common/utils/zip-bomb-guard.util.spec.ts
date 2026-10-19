import * as XLSX from 'xlsx';
import { assertSafeZipDecompressionRatio } from '@/common/utils/zip-bomb-guard.util';

interface FakeEntry {
  compressedSize: number;
  uncompressedSize: number;
  fileName?: string;
  /**
   * The local file header's own declared sizes, independent of the central
   * directory's copy of the same entry. Defaults to matching
   * compressedSize/uncompressedSize (the normal, non-adversarial case) —
   * pass these explicitly to simulate a central directory and local header
   * that disagree.
   */
  localCompressedSize?: number;
  localUncompressedSize?: number;
  /** General-purpose flag bits on the local file header (bit 3 = streaming/data-descriptor). */
  localFlags?: number;
  /** Raw extra-field bytes to attach to the local file header. */
  localExtraField?: Buffer;
  /** Raw extra-field bytes to attach to the central directory record. */
  centralExtraField?: Buffer;
}

/** Builds a single ZIP64 Extended Information extra-field TLV (type 0x0001). */
function buildZip64ExtraField(uncompressedSize: number, compressedSize: number): Buffer {
  const data = Buffer.alloc(16);
  data.writeUInt32LE(uncompressedSize, 0);
  data.writeUInt32LE(0, 4); // high 32 bits of usz
  data.writeUInt32LE(compressedSize, 8);
  data.writeUInt32LE(0, 12); // high 32 bits of csz
  const tlv = Buffer.alloc(4);
  tlv.writeUInt16LE(0x0001, 0);
  tlv.writeUInt16LE(16, 2);
  return Buffer.concat([tlv, data]);
}

/**
 * Builds a minimal, structurally valid ZIP: a local file header per entry,
 * followed by a central directory (one record per entry, pointing back at
 * its local header via the "relative offset of local header" field —
 * exactly what xlsx.js's parse_zip follows), followed by a correct EOCD.
 */
function buildMinimalZip(entries: FakeEntry[], leadingBytes: Buffer = Buffer.alloc(0)): Buffer {
  let cursor = leadingBytes.length;
  const localHeaderChunks: Buffer[] = [];
  const localHeaderOffsets: number[] = [];

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName ?? 'x.xml', 'ascii');
    const localCompressedSize = entry.localCompressedSize ?? entry.compressedSize;
    const localUncompressedSize = entry.localUncompressedSize ?? entry.uncompressedSize;
    const localExtraField = entry.localExtraField ?? Buffer.alloc(0);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(entry.localFlags ?? 0, 6); // general purpose flag
    header.writeUInt16LE(8, 8); // compression method (deflate)
    header.writeUInt16LE(0, 10); // time
    header.writeUInt16LE(0, 12); // date
    header.writeUInt32LE(0, 14); // crc-32
    header.writeUInt32LE(localCompressedSize, 18);
    header.writeUInt32LE(localUncompressedSize, 22);
    header.writeUInt16LE(fileName.length, 26);
    header.writeUInt16LE(localExtraField.length, 28); // extra field length

    localHeaderOffsets.push(cursor);
    const chunk = Buffer.concat([header, fileName, localExtraField]);
    localHeaderChunks.push(chunk);
    cursor += chunk.length;
  }

  const centralDirOffset = cursor;

  const centralDirRecords = entries.map((entry, i) => {
    const fileName = Buffer.from(entry.fileName ?? 'x.xml', 'ascii');
    const centralExtraField = entry.centralExtraField ?? Buffer.alloc(0);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); // central file header signature
    record.writeUInt16LE(20, 4); // version made by
    record.writeUInt16LE(20, 6); // version needed
    record.writeUInt16LE(0, 8); // general purpose flag
    record.writeUInt16LE(8, 10); // compression method (deflate)
    record.writeUInt16LE(0, 12); // time
    record.writeUInt16LE(0, 14); // date
    record.writeUInt32LE(0, 16); // crc-32
    record.writeUInt32LE(entry.compressedSize, 20);
    record.writeUInt32LE(entry.uncompressedSize, 24);
    record.writeUInt16LE(fileName.length, 28);
    record.writeUInt16LE(centralExtraField.length, 30); // extra field length
    record.writeUInt16LE(0, 32); // file comment length
    record.writeUInt16LE(0, 34); // disk number start
    record.writeUInt16LE(0, 36); // internal file attributes
    record.writeUInt32LE(0, 38); // external file attributes
    record.writeUInt32LE(localHeaderOffsets[i], 42); // relative offset of local header
    return Buffer.concat([record, fileName, centralExtraField]);
  });

  const centralDirectory = Buffer.concat(centralDirRecords);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with CD start
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirectory.length, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([leadingBytes, ...localHeaderChunks, centralDirectory, eocd]);
}

describe('assertSafeZipDecompressionRatio', () => {
  it('does not reject a real XLSX workbook built by the xlsx library', () => {
    const workbook = XLSX.utils.book_new();
    const data = [
      ['Date', 'Amount'],
      ...Array.from({ length: 50 }, (_, i) => [`2024-01-${(i % 28) + 1}`, i * 10]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    expect(() => assertSafeZipDecompressionRatio(buffer)).not.toThrow();
  });

  it('rejects an entry whose declared ratio exceeds the configured maximum', () => {
    // 100 bytes compressed claiming to inflate to 50MB — a 500,000:1 ratio,
    // comfortably under the absolute-size cap so this isolates the ratio check.
    const buffer = buildMinimalZip([{ compressedSize: 100, uncompressedSize: 50 * 1024 * 1024 }]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/ratio/);
  });

  it('rejects total declared uncompressed size over the absolute cap even with a modest ratio', () => {
    // 10:1 ratio (well under the default 200:1 cap) but 260MB uncompressed,
    // over the default 250MB absolute cap.
    const buffer = buildMinimalZip([
      { compressedSize: 26 * 1024 * 1024, uncompressedSize: 260 * 1024 * 1024 },
    ]);

    expect(() =>
      assertSafeZipDecompressionRatio(buffer, { maxUncompressedBytes: 250 * 1024 * 1024 }),
    ).toThrow(/decompress to more than/);
  });

  it('sums the declared size across many small entries, each individually under the per-entry thresholds', () => {
    // 5,000 entries at 60KB declared each (well under any single-entry
    // ratio/size trip) still add up to 300MB total, over the 250MB cap —
    // proves the running total isn't fooled by splitting a bomb into pieces.
    const entries = Array.from({ length: 5000 }, (_, i) => ({
      compressedSize: 1000,
      uncompressedSize: 60 * 1024,
      fileName: `f${i}.xml`,
    }));
    const buffer = buildMinimalZip(entries);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/decompress to more than/);
  });

  it('rejects a ZIP64-sized entry rather than misreading the sentinel as a real size', () => {
    const buffer = buildMinimalZip([
      { compressedSize: 0xffffffff, uncompressedSize: 0xffffffff },
    ]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/ZIP64/);
  });

  it('does nothing for a non-ZIP buffer (format rejection is a separate concern)', () => {
    const buffer = Buffer.from('%PDF-1.4\nnot a zip');
    expect(() => assertSafeZipDecompressionRatio(buffer)).not.toThrow();
  });

  it('accepts a small legitimate entry within default thresholds', () => {
    const buffer = buildMinimalZip([{ compressedSize: 1000, uncompressedSize: 8000 }]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).not.toThrow();
  });

  it('regression: a bomb entry is still caught when byte 0 is not a local file header signature', () => {
    // This is exactly the bypass a sequential local-header-from-offset-0 scan
    // misses: the file doesn't start with PK\x03\x04 (here, arbitrary
    // prefix bytes standing in for anything — a self-extractor stub, junk,
    // or a deliberately-placed decoy), yet it's a perfectly valid ZIP whose
    // EOCD/central directory correctly describe a bomb entry. A guard that
    // gives up at the first non-signature byte would silently pass this
    // through; the EOCD-anchored walk must not.
    const decoyPrefix = Buffer.from('NOT-A-ZIP-LOCAL-HEADER-PREFIX-BYTES', 'ascii');
    const buffer = buildMinimalZip(
      [{ compressedSize: 50, uncompressedSize: 20 * 1024 * 1024 }],
      decoyPrefix,
    );

    expect(buffer.readUInt32LE(0)).not.toBe(0x04034b50); // sanity: not a local file header at offset 0
    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/ratio/);
  });

  it('fails closed when the EOCD declares more entries than the buffer actually contains', () => {
    // A well-formed EOCD claiming 5 entries (consistently, in both the
    // "entries on this disk" and "total entries" fields) but only 1 central
    // directory record actually follows — malformed/adversarial, must reject
    // rather than silently checking only what happens to be present.
    const buffer = buildMinimalZip([{ compressedSize: 100, uncompressedSize: 200 }]);
    const entriesOnDiskOffset = buffer.length - 22 + 8;
    buffer.writeUInt16LE(5, entriesOnDiskOffset); // "entries on this disk"
    buffer.writeUInt16LE(5, entriesOnDiskOffset + 2); // "total entries" — kept consistent

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/Malformed/);
  });

  it('regression: an entry hidden by a mismatched "entries on this disk" vs "total entries" EOCD field is still caught', () => {
    // xlsx.js's parse_zip reads its loop bound from EOCD offset+8 ("entries
    // on this disk"), never from offset+10 ("total entries") — verified by
    // reading node_modules/xlsx/xlsx.js directly. A guard that trusted
    // offset+10 instead could be made to walk fewer entries than xlsx.js
    // actually will, by setting the two fields differently: here, 2 real
    // entries exist (one benign, one a bomb), but offset+10 is tampered down
    // to 1 after the fact. A guard reading only offset+10 would check just
    // the first (benign) entry and report "safe" while xlsx.js still walks
    // and inflates the second (bomb) entry per offset+8's true count of 2.
    const buffer = buildMinimalZip([
      { compressedSize: 100, uncompressedSize: 200 },
      { compressedSize: 100, uncompressedSize: 200 * 1024 * 1024 },
    ]);
    const totalEntriesOffset = buffer.length - 22 + 10;
    buffer.writeUInt16LE(1, totalEntriesOffset); // lies: "only 1 entry total"

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/disagree/);
  });

  it('regression: a bomb declared only in the local file header (not the central directory) is still caught', () => {
    // xlsx.js's parse_local_file sizes its actual decompression buffer from
    // the LOCAL file header's own size fields, read independently a second
    // time — it only compares those against the central directory's values
    // *after* already allocating and inflating (verified in
    // node_modules/xlsx/xlsx.js: parse_local_file calls
    // _inflateRawSync(blob, _usz) using its own freshly-read _usz, then only
    // afterward does `if (_usz != usz) warn_or_throw(...)`). A guard that
    // only reads central-directory sizes would see this entry's benign
    // 200-byte central-directory declaration and report "safe" while the
    // local file header — what actually drives the allocation — declares
    // 200MB.
    const buffer = buildMinimalZip([
      {
        compressedSize: 100,
        uncompressedSize: 200,
        localCompressedSize: 100,
        localUncompressedSize: 200 * 1024 * 1024,
      },
    ]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/ratio/);
  });

  it('regression: a ZIP64 extra field on the local file header is rejected outright, not trusted or ignored', () => {
    // xlsx.js's parse_extra_field applies a 0x0001 TLV's usz/csz as an
    // unconditional override on top of the fixed-size fields it already
    // read — regardless of whether those fixed fields were the ZIP64
    // sentinel. Both the fixed fields here declare a benign 100/200 (would
    // otherwise pass trivially); the attached extra field is what actually
    // drives xlsx.js's real allocation, and this guard never reads that
    // override value at all, so it must reject on the TLV's mere presence.
    const buffer = buildMinimalZip([
      {
        compressedSize: 100,
        uncompressedSize: 200,
        localCompressedSize: 100,
        localUncompressedSize: 200,
        localExtraField: buildZip64ExtraField(200 * 1024 * 1024, 100),
      },
    ]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/ZIP64 extra field/);
  });

  it('regression: a ZIP64 extra field on the central directory record is rejected outright', () => {
    const buffer = buildMinimalZip([
      {
        compressedSize: 100,
        uncompressedSize: 200,
        centralExtraField: buildZip64ExtraField(200 * 1024 * 1024, 100),
      },
    ]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/ZIP64 extra field/);
  });

  it('regression: a streaming (data-descriptor) entry is rejected outright rather than left unchecked', () => {
    // Bit 3 of the general-purpose flag means the local header's own
    // csz/usz are legitimately 0, with real sizes deferred to a trailing
    // data descriptor xlsx.js only reads AFTER it has already decompressed
    // using those zeroed (effectively unbounded) values. There is no
    // pre-declared, trustworthy size anywhere for such an entry.
    const buffer = buildMinimalZip([
      {
        compressedSize: 100,
        uncompressedSize: 200,
        localCompressedSize: 0,
        localUncompressedSize: 0,
        localFlags: 0x0008,
      },
    ]);

    expect(() => assertSafeZipDecompressionRatio(buffer)).toThrow(/streaming/);
  });
});
