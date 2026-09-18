// Minimal store-only (no compression) ZIP writer. No dependencies, no build
// step. Used only by extension pages for the Pro archive export.
(function (global) {
  "use strict";

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeZip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const centralRecords = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
      const crc = crc32(dataBytes);

      const local = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, 0, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      chunks.push(local, dataBytes);
      centralRecords.push({ nameBytes, crc, size: dataBytes.length, offset });
      offset += local.length + dataBytes.length;
    });

    const centralStart = offset;
    const centralChunks = [];

    centralRecords.forEach((record) => {
      const central = new Uint8Array(46 + record.nameBytes.length);
      const view = new DataView(central.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 0, true);
      view.setUint32(16, record.crc, true);
      view.setUint32(20, record.size, true);
      view.setUint32(24, record.size, true);
      view.setUint16(28, record.nameBytes.length, true);
      view.setUint32(42, record.offset, true);
      central.set(record.nameBytes, 46);
      centralChunks.push(central);
      offset += central.length;
    });

    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, centralRecords.length, true);
    endView.setUint16(10, centralRecords.length, true);
    endView.setUint32(12, offset - centralStart, true);
    endView.setUint32(16, centralStart, true);

    return new Blob(chunks.concat(centralChunks, [end]), { type: "application/zip" });
  }

  global.ClipperZip = { makeZip };
})(typeof self !== "undefined" ? self : this);
