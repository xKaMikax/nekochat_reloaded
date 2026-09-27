// Browser port of the theme system (main.js / ThemeManager.swift / MsStylesImporter.swift /
// ZipReader.swift): built-in prebuilt themes, the online catalog, imported .msstyles, .theme,
// theme.css and .zip files. Installed themes live in IndexedDB; their rendered images are
// served to the pages as blob: URLs, which same-origin frames can load.
(() => {
  const CATALOG_ROOT = 'https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main';
  const RESERVED_IDS = new Set(['Current', 'Luna', 'Embedded', 'Royale']);
  const IMPORTER_VERSION = 4;
  const THEME_STATE_KEY = 'nkweb.theme';
  const DISPLAY_STATE_KEY = 'nkweb.display';

  class ThemeError extends Error {}
  const now = () => Date.now();
  const readStored = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const writeStored = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  // ---- IndexedDB: installed theme sources and their rendered output ------------------------
  let database;
  function db() {
    database ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('nekochat-web', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('themes', { keyPath: 'id' }); request.result.createObjectStore('rendered', { keyPath: 'id' }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }
  async function store(name, mode, action) {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const transaction = connection.transaction(name, mode);
      const request = action(transaction.objectStore(name));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new ThemeError('Theme storage is unavailable.'));
    });
  }
  const dbGet = (name, key) => store(name, 'readonly', objects => objects.get(key));
  const dbAll = name => store(name, 'readonly', objects => objects.getAll());
  const dbPut = (name, value) => store(name, 'readwrite', objects => objects.put(value));
  const dbDelete = (name, key) => store(name, 'readwrite', objects => objects.delete(key));

  // ---- ZIP (stored + deflate), a port of readZipEntries/extractZip -------------------------
  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readZip(buffer) {
    const bytes = new Uint8Array(buffer);
    const u16 = offset => bytes[offset] | bytes[offset + 1] << 8;
    const u32 = offset => (u16(offset) | u16(offset + 2) << 16) >>> 0;
    let eocd = -1;
    for (let index = bytes.length - 22; index >= 0 && index >= bytes.length - 22 - 0xFFFF; index -= 1) if (u32(index) === 0x06054B50) { eocd = index; break; }
    if (eocd < 0) throw new ThemeError('Invalid ZIP file: end of central directory not found.');
    const files = {};
    let offset = u32(eocd + 16);
    for (let count = u16(eocd + 10); count > 0; count -= 1) {
      if (offset + 46 > bytes.length || u32(offset) !== 0x02014B50) throw new ThemeError('Invalid ZIP file: corrupt central directory.');
      const nameLength = u16(offset + 28);
      const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).replace(/\\/g, '/');
      const method = u16(offset + 10); const compressedSize = u32(offset + 20); const header = u32(offset + 42);
      offset += 46 + nameLength + u16(offset + 30) + u16(offset + 32);
      if (name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').includes('..')) throw new ThemeError('Theme.ZIP contains an unsafe path.');
      if (name.endsWith('/')) continue;
      if (header + 30 > bytes.length || u32(header) !== 0x04034B50) throw new ThemeError('Invalid ZIP file: corrupt local header.');
      const start = header + 30 + u16(header + 26) + u16(header + 28);
      if (start + compressedSize > bytes.length) throw new ThemeError('Invalid ZIP file: truncated entry.');
      const compressed = bytes.slice(start, start + compressedSize);
      if (method === 0) files[name.replace(/^\.\//, '')] = compressed;
      else if (method === 8) files[name.replace(/^\.\//, '')] = compressedSize ? await inflateRaw(compressed) : new Uint8Array(0);
      else throw new ThemeError(`Unsupported ZIP compression method: ${method}.`);
    }
    return files;
  }

  // ---- Images (straight, non-premultiplied RGBA) --------------------------------------------
  class Picture {
    constructor(width, height, pixels) { this.width = width; this.height = height; this.pixels = pixels || new Uint8ClampedArray(width * height * 4); }
    crop(left, top, right, bottom) {
      const l = Math.min(Math.max(0, left), this.width), t = Math.min(Math.max(0, top), this.height);
      const r = Math.min(Math.max(l, right), this.width), b = Math.min(Math.max(t, bottom), this.height);
      if (r <= l || b <= t) return new Picture(1, 1);
      const result = new Picture(r - l, b - t);
      for (let y = 0; y < b - t; y += 1) result.pixels.set(this.pixels.subarray(((t + y) * this.width + l) * 4, ((t + y) * this.width + r) * 4), y * result.width * 4);
      return result;
    }
    // Pillow's alpha_composite: draws other over this image at (x, y).
    composite(other, x, y) {
      for (let row = 0; row < other.height; row += 1) for (let column = 0; column < other.width; column += 1) {
        const tx = x + column, ty = y + row;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        const s = (row * other.width + column) * 4, d = (ty * this.width + tx) * 4;
        const sa = other.pixels[s + 3] / 255, da = this.pixels[d + 3] / 255, oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        for (let channel = 0; channel < 3; channel += 1) this.pixels[d + channel] = Math.round((other.pixels[s + channel] * sa + this.pixels[d + channel] * da * (1 - sa)) / oa);
        this.pixels[d + 3] = Math.round(oa * 255);
      }
    }
  }
  function canvasOf(width, height) {
    if (globalThis.OffscreenCanvas) return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
  }
  async function pngBlob(picture) {
    const canvas = canvasOf(picture.width, picture.height);
    canvas.getContext('2d').putImageData(new ImageData(picture.pixels, picture.width, picture.height), 0, 0);
    return canvas.convertToBlob ? canvas.convertToBlob({ type: 'image/png' }) : new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
  async function decodeImage(bytes, type) {
    const bitmap = await createImageBitmap(new Blob([bytes], { type }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const canvas = canvasOf(bitmap.width, bitmap.height); const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0); bitmap.close?.();
    return new Picture(canvas.width, canvas.height, context.getImageData(0, 0, canvas.width, canvas.height).data);
  }

  // ---- PE resources -----------------------------------------------------------------------
  class PeFile {
    constructor(bytes) {
      this.bytes = bytes; this.sections = []; this.resourceOffset = -1;
      if (bytes.length <= 0x40 || this.u16(0) !== 0x5A4D) throw new ThemeError('Not a PE file');
      const pe = this.u32(0x3C);
      if (pe + 24 >= bytes.length || this.u32(pe) !== 0x00004550) throw new ThemeError('Not a PE file');
      const sectionCount = this.u16(pe + 6), optionalSize = this.u16(pe + 20), optional = pe + 24;
      const directories = optional + (this.u16(optional) === 0x20B ? 112 : 96);
      const resourceRva = this.u32(directories + 16);
      let section = optional + optionalSize;
      for (let index = 0; index < sectionCount; index += 1, section += 40) this.sections.push({ address: this.u32(section + 12), virtualSize: this.u32(section + 8), raw: this.u32(section + 20), rawSize: this.u32(section + 16) });
      this.resourceOffset = resourceRva === 0 ? -1 : this.rvaToOffset(resourceRva);
    }
    u16(offset) { return this.bytes[offset] | this.bytes[offset + 1] << 8; }
    u32(offset) { return (this.u16(offset) | this.u16(offset + 2) << 16) >>> 0; }
    rvaToOffset(rva) {
      const section = this.sections.find(item => rva >= item.address && rva < item.address + Math.max(item.virtualSize, item.rawSize));
      return section ? rva - section.address + section.raw : rva;
    }
    children(directoryOffset = 0) {
      if (this.resourceOffset < 0) return [];
      const base = this.resourceOffset + directoryOffset;
      const count = this.u16(base + 12) + this.u16(base + 14);
      return Array.from({ length: count }, (_, index) => {
        const entry = base + 16 + index * 8;
        const nameField = this.u32(entry), target = this.u32(entry + 4);
        const named = (nameField & 0x80000000) !== 0;
        let name = null;
        if (named) {
          const at = this.resourceOffset + (nameField & 0x7FFFFFFF);
          name = String.fromCharCode(...Array.from({ length: this.u16(at) }, (__, unit) => this.u16(at + 2 + unit * 2)));
        }
        return { id: named ? null : nameField & 0xFFFF, name, offset: target & 0x7FFFFFFF, isDirectory: (target & 0x80000000) !== 0 };
      });
    }
    // Follows the first child until a data entry is reached (name → language → data).
    leafData(node) {
      let current = node;
      while (current.isDirectory) { const first = this.children(current.offset)[0]; if (!first) return null; current = first; }
      const entry = this.resourceOffset + current.offset;
      const offset = this.rvaToOffset(this.u32(entry)), size = this.u32(entry + 4);
      return offset >= 0 && offset + size <= this.bytes.length ? this.bytes.subarray(offset, offset + size) : null;
    }
  }

  // ---- DIB decoding (decode_dib) ----------------------------------------------------------
  async function decodeDib(bytes, preserveAlpha) {
    if (bytes.length < 16) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerSize = view.getUint32(0, true), width = view.getInt32(4, true), rawHeight = view.getInt32(8, true), bpp = view.getUint16(14, true);
    const compression = headerSize >= 20 ? view.getUint32(16, true) : 0;
    let colours = headerSize >= 36 ? view.getUint32(32, true) : 0;
    if (colours === 0 && bpp <= 8) colours = 1 << bpp;
    const height = Math.abs(rawHeight), bottomUp = rawHeight > 0;
    const masksSize = compression === 3 && headerSize === 40 ? 12 : 0;
    const pixelOffset = headerSize + masksSize + colours * 4;
    let picture;
    if (width > 0 && height > 0 && (compression === 0 || (compression === 3 && bpp === 32)) && [1, 4, 8, 24, 32].includes(bpp)) {
      const stride = Math.floor((width * bpp + 31) / 32) * 4;
      if (pixelOffset + stride * height > bytes.length) return null;
      const palette = bpp <= 8 ? Array.from({ length: colours }, (_, index) => { const at = headerSize + masksSize + index * 4; return [bytes[at + 2], bytes[at + 1], bytes[at]]; }) : [];
      picture = new Picture(width, height);
      for (let y = 0; y < height; y += 1) {
        const row = pixelOffset + (bottomUp ? height - 1 - y : y) * stride;
        for (let x = 0; x < width; x += 1) {
          let r = 0, g = 0, b = 0, a = 255;
          if (bpp === 32) { const at = row + x * 4; b = bytes[at]; g = bytes[at + 1]; r = bytes[at + 2]; if (preserveAlpha) a = bytes[at + 3]; }
          else if (bpp === 24) { const at = row + x * 3; b = bytes[at]; g = bytes[at + 1]; r = bytes[at + 2]; }
          else {
            const index = bpp === 8 ? bytes[row + x] : bpp === 4 ? (bytes[row + (x >> 1)] >> (x % 2 === 0 ? 4 : 0)) & 0x0F : (bytes[row + (x >> 3)] >> (7 - x % 8)) & 1;
            if (index < palette.length) [r, g, b] = palette[index];
          }
          const at = (y * width + x) * 4;
          picture.pixels[at] = r; picture.pixels[at + 1] = g; picture.pixels[at + 2] = b; picture.pixels[at + 3] = a;
        }
      }
    } else {
      // RLE and other rare formats: let the browser decode a synthesized .bmp file.
      const file = new Uint8Array(14 + bytes.length); const header = new DataView(file.buffer);
      file[0] = 0x42; file[1] = 0x4D; header.setUint32(2, file.length, true); header.setUint32(10, 14 + pixelOffset, true); file.set(bytes, 14);
      try { picture = await decodeImage(file, 'image/bmp'); } catch { return null; }
      for (let index = 3; index < picture.pixels.length; index += 4) picture.pixels[index] = 255;
    }
    // Magenta is the transparent key colour in msstyles bitmaps.
    for (let index = 0; index < picture.pixels.length; index += 4) if (picture.pixels[index] > 245 && picture.pixels[index + 1] < 12 && picture.pixels[index + 2] > 245) picture.pixels[index + 3] = 0;
    return picture;
  }
  async function bitmaps(pe) {
    const root = pe.children().find(node => node.name === null && node.id === 2);
    if (!root) return [];
    const result = [];
    for (const entry of pe.children(root.offset)) {
      const name = entry.name ?? String(entry.id ?? 0);
      const data = pe.leafData(entry); if (!data) continue;
      const picture = await decodeDib(data, name.toUpperCase().endsWith('GLYPH_BMP'));
      if (picture) result.push([name, picture]);
    }
    return result;
  }
  function namedPng(pe, type, id) {
    const root = pe.children().find(node => node.name === type);
    const item = root && pe.children(root.offset).find(node => node.id === id);
    const data = item && pe.leafData(item);
    return data && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 ? data : null;
  }

  // ---- Sprite helpers ---------------------------------------------------------------------
  function find(images, suffix, prefix = '') {
    const match = images.find(([name]) => name.toUpperCase().endsWith(suffix) && (!prefix || name.toUpperCase().startsWith(`${prefix.toUpperCase()}_`)));
    if (!match) throw new ThemeError(`Missing theme resource ${suffix}`);
    return match[1];
  }
  function state(picture, index) {
    const side = picture.width, rows = Math.max(1, Math.floor(picture.height / Math.max(1, side)));
    const top = Math.min(index, rows - 1) * side;
    return picture.crop(0, top, picture.width, Math.min(top + side, picture.height));
  }
  function buttonState(picture, index) {
    const frameHeight = picture.height % 5 === 0 ? picture.height / 5 : picture.width;
    const top = Math.min(index, Math.max(0, Math.floor(picture.height / Math.max(1, frameHeight)) - 1)) * frameHeight;
    return picture.crop(0, top, picture.width, top + frameHeight);
  }
  function stripState(picture, frameHeight, index) {
    const top = Math.min(index, Math.max(0, Math.floor(picture.height / frameHeight) - 1)) * frameHeight;
    return picture.crop(0, top, picture.width, top + frameHeight);
  }

  // ---- .theme (INI) -------------------------------------------------------------------------
  function readIni(bytes) {
    const result = {}; let section = '';
    for (const raw of new TextDecoder('windows-1252').decode(bytes || new Uint8Array()).split(/\r\n|\r|\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith(';') || line.startsWith('#')) continue;
      if (line.startsWith('[') && line.endsWith(']')) { section = line.slice(1, -1).toLowerCase(); continue; }
      const separator = line.search(/[=:]/); if (separator <= 0) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      result[section] ||= {};
      if (result[section][key] === undefined) result[section][key] = line.slice(separator + 1).trim();
    }
    return result;
  }
  const iniGet = (ini, section, key) => ini[section.toLowerCase()]?.[key.toLowerCase()];
  const extension = name => (name.match(/\.([^./]+)$/)?.[1] || '').toLowerCase();
  const baseName = name => name.split('/').pop();
  const stem = name => baseName(name).replace(/\.[^.]+$/, '');

  // Picks the .msstyles for a source (.msstyles itself, or the file named by a .theme).
  function resolveTheme(files, source) {
    if (extension(source) === 'msstyles') return source;
    const path = iniGet(readIni(files[source]), 'VisualStyles', 'Path') || '';
    const filename = path.replace(/\\/g, '/').split('/').pop().toLowerCase();
    const names = Object.keys(files);
    const candidates = [...(filename ? names.filter(name => baseName(name).toLowerCase() === filename) : []), ...names.filter(name => extension(name) === 'msstyles')];
    if (!candidates.length) throw new ThemeError('The .theme file has no nearby .msstyles file');
    return candidates[0];
  }
  function themeColours(files, source) {
    const colours = { Window: '#ece9d8', ButtonFace: '#d4d0c8', WindowText: '#000000', Hilight: '#316ac5' };
    if (extension(source) !== 'theme') return colours;
    const ini = readIni(files[source]);
    if (!ini['control panel\\colors']) return colours;
    for (const key of Object.keys(colours)) {
      const value = (iniGet(ini, 'Control Panel\\Colors', key) || '').replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(Number);
      if (value.length === 3 && value.every(Number.isInteger)) colours[key] = `#${value.map(part => part.toString(16).padStart(2, '0')).join('')}`;
    }
    return colours;
  }
  function themeDisplayName(files, source, msstyles) {
    if (extension(source) === 'theme') {
      const value = (iniGet(readIni(files[source]), 'Theme', 'DisplayName') || '').trim();
      if (value && !value.startsWith('@')) return value;
    }
    const name = stem(extension(source) === 'theme' ? source : msstyles);
    return { aero: 'Aero', aerolite: 'Aero Lite' }[name.toLowerCase()] || name;
  }
  const isAeroStyle = (source, msstyles) => ['aero', 'aerolite'].includes(stem(source).toLowerCase()) || ['aero', 'aerolite'].includes(stem(msstyles).toLowerCase());
  function schemeLabel(prefix) {
    return { BLUE: 'Default (blue)', HOMESTEAD: 'Homestead (green)', METALLIC: 'Metallic (silver)', DEFAULT: 'Default', ROYALE: 'Royale' }[prefix.toUpperCase()]
      || prefix.replace(/_/g, ' ').toLowerCase().split(' ').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  }
  function sourceScheme(files, source, prefixes) {
    if (extension(source) === 'theme') {
      let requested = (iniGet(readIni(files[source]), 'VisualStyles', 'ColorStyle') || 'NormalColor').toUpperCase();
      requested = { NORMALCOLOR: 'BLUE', HOMESTEAD: 'HOMESTEAD', METALLIC: 'METALLIC' }[requested] || requested;
      if (prefixes.includes(requested)) return requested;
    }
    return prefixes[0];
  }

  // ---- Writers: a rendered directory is { files: {name: Blob}, css } ----------------------------
  // CSS refers to its own files as url("nk-asset:<name>"); materialize() swaps in blob: URLs.
  const asset = name => `url("nk-asset:${name}")`;
  async function writeScheme(images, prefix, colours) {
    const files = {};
    const save = async (picture, name) => { files[name] = await pngBlob(picture); };
    let caption = find(images, '_FRAMECAPTION_BMP', prefix);
    const capHeight = Math.floor(caption.height / 2);
    // The caption bitmap stacks the active title bar over the inactive one.
    const inactive = caption.crop(0, capHeight, caption.width, capHeight * 2);
    caption = caption.crop(0, 0, caption.width, capHeight);
    let left = 28, right = 35;
    if (caption.width <= left + right) { left = Math.max(1, Math.floor(caption.width / 4)); right = Math.max(1, Math.floor(caption.width / 4)); }
    await save(caption.crop(0, 0, left, capHeight), 'title-left.png');
    await save(caption.crop(left, 0, caption.width - right, capHeight), 'title-fill.png');
    await save(caption.crop(caption.width - right, 0, caption.width, capHeight), 'title-right.png');
    await save(inactive.crop(0, 0, left, capHeight), 'title-left-inactive.png');
    await save(inactive.crop(left, 0, caption.width - right, capHeight), 'title-fill-inactive.png');
    await save(inactive.crop(caption.width - right, 0, caption.width, capHeight), 'title-right-inactive.png');
    await save(find(images, '_FRAMELEFT_BMP', prefix), 'frame-left.png');
    await save(find(images, '_FRAMERIGHT_BMP', prefix), 'frame-right.png');
    const bottom = find(images, '_FRAMEBOTTOM_BMP', prefix);
    const bleft = Math.min(5, Math.floor(bottom.width / 3)), bright = Math.min(5, Math.floor(bottom.width / 3));
    await save(bottom.crop(0, 0, bleft, bottom.height), 'bottom-left.png');
    await save(bottom.crop(bleft, 0, bottom.width - bright, bottom.height), 'bottom-fill.png');
    await save(bottom.crop(bottom.width - bright, 0, bottom.width, bottom.height), 'bottom-right.png');
    const states = ['normal', 'hover', 'pressed'];
    for (const [name, resource] of [['caption', '_CAPTIONBUTTON_BMP'], ['close', '_CLOSEBUTTON_BMP']]) {
      const button = find(images, resource, prefix);
      for (const [index, stateName] of states.entries()) await save(state(button, index), `${name}-${stateName}.png`);
    }
    const button = find(images, '_BUTTON_BMP', prefix);
    for (const [index, stateName] of states.entries()) await save(buttonState(button, index), `button-${stateName}.png`);
    const checkbox = find(images, '_CHECKBOX13_BMP', prefix);
    for (const [index, stateName] of [[0, 'unchecked-normal'], [1, 'unchecked-hover'], [2, 'unchecked-pressed'], [4, 'checked-normal'], [5, 'checked-hover'], [6, 'checked-pressed']]) await save(state(checkbox, index), `checkbox-${stateName}.png`);
    await save(find(images, '_GROUPBOX_BMP', prefix), 'groupbox.png');
    await save(find(images, '_FIELDOUTLINEBLUE_BMP', prefix), 'field-outline.png');
    const arrows = find(images, '_SCROLLARROWS_BMP', prefix), arrowGlyphs = find(images, '_SCROLLARROWGLYPHS_BMP', prefix);
    for (const [direction, index] of [['up', 0], ['down', 4], ['left', 8], ['right', 12]]) {
      for (const [stateIndex, stateName] of states.entries()) {
        const arrow = state(arrows, index + stateIndex), glyph = state(arrowGlyphs, index + stateIndex);
        arrow.composite(glyph, Math.floor((arrow.width - glyph.width) / 2), Math.floor((arrow.height - glyph.height) / 2));
        await save(arrow, `scroll-${direction}-${stateName}.png`);
      }
    }
    await save(state(find(images, '_SCROLLSHAFTVERTICAL_BMP', prefix), 0), 'scroll-shaft-vertical.png');
    await save(state(find(images, '_SCROLLSHAFTHORIZONTAL_BMP', prefix), 0), 'scroll-shaft-horizontal.png');
    const thumbVertical = find(images, '_SCROLLTHUMBVERTICAL_BMP', prefix), thumbHorizontal = find(images, '_SCROLLTHUMBHORIZONTAL_BMP', prefix);
    for (const [stateIndex, stateName] of states.entries()) {
      await save(stripState(thumbVertical, 22, stateIndex), `scroll-thumb-vertical-${stateName}.png`);
      await save(stripState(thumbHorizontal, 20, stateIndex), `scroll-thumb-horizontal-${stateName}.png`);
    }
    for (const [name, resource] of [['minimize', '_MINIMIZEGLYPH_BMP'], ['maximize', '_MAXIMIZEGLYPH_BMP'], ['close', '_CLOSEGLYPH_BMP']]) {
      const glyph = find(images, resource, prefix);
      for (const [index, stateName] of states.entries()) await save(state(glyph, index), `${name}-glyph-${stateName}.png`);
    }
    const u = asset;
    let css = `:root { --xp-frame-states: 2; --xp-caption-left: ${left}px; --xp-caption-right: ${right}px; --xp-caption-middle: 1px; --xp-caption-height: ${capHeight}px; --xp-bottom-left: ${bleft}px; --xp-bottom-right: ${bright}px; --xp-bottom-middle: 1px; --xp-bottom-height: ${bottom.height}px; `;
    css += `--xp-theme-window: ${colours.Window}; --xp-theme-buttonface: ${colours.ButtonFace}; --xp-theme-windowtext: ${colours.WindowText}; --xp-theme-highlight: ${colours.Hilight}; `;
    css += `--xp-title-fill: ${u('title-fill.png')}; --xp-title-left: ${u('title-left.png')}; --xp-title-right: ${u('title-right.png')}; --xp-frame-left: ${u('frame-left.png')}; --xp-frame-right: ${u('frame-right.png')}; --xp-bottom-fill: ${u('bottom-fill.png')}; --xp-bottom-left-image: ${u('bottom-left.png')}; --xp-bottom-right-image: ${u('bottom-right.png')}; `;
    css += `--xp-caption-normal: ${u('caption-normal.png')}; --xp-caption-hover: ${u('caption-hover.png')}; --xp-caption-pressed: ${u('caption-pressed.png')}; --xp-close-normal: ${u('close-normal.png')}; --xp-close-hover: ${u('close-hover.png')}; --xp-close-pressed: ${u('close-pressed.png')}; `;
    css += `--xp-close-glyph: ${u('close-glyph-normal.png')}; --xp-close-glyph-hover: ${u('close-glyph-hover.png')}; --xp-close-glyph-pressed: ${u('close-glyph-pressed.png')}; --xp-minimize-glyph: ${u('minimize-glyph-normal.png')}; --xp-minimize-glyph-hover: ${u('minimize-glyph-hover.png')}; --xp-minimize-glyph-pressed: ${u('minimize-glyph-pressed.png')}; `;
    css += `--xp-maximize-glyph: ${u('maximize-glyph-normal.png')}; --xp-maximize-glyph-hover: ${u('maximize-glyph-hover.png')}; --xp-maximize-glyph-pressed: ${u('maximize-glyph-pressed.png')}; --xp-button-normal: ${u('button-normal.png')}; --xp-button-hover: ${u('button-hover.png')}; --xp-button-pressed: ${u('button-pressed.png')}; }\n`;
    // XP trackbar (thumb pointing down + track); optional, themes without it still import.
    let slider = false;
    try {
      const thumb = find(images, '_TRACKBARDOWN16_BMP', prefix), track = find(images, '_SLIDERTRACK_BMP', prefix);
      for (const [index, name] of ['normal', 'hover', 'pressed'].entries()) await save(stripState(thumb, Math.floor(thumb.height / 5), index), `slider-thumb-${name}.png`);
      await save(track, 'slider-track.png');
      slider = true;
    } catch {}
    if (slider) css += `:root { --xp-slider-thumb: ${u('slider-thumb-normal.png')}; --xp-slider-thumb-hover: ${u('slider-thumb-hover.png')}; --xp-slider-thumb-pressed: ${u('slider-thumb-pressed.png')}; --xp-slider-track: ${u('slider-track.png')}; }\n`;
    css += `:root { --xp-title-fill-inactive: ${u('title-fill-inactive.png')}; --xp-title-left-inactive: ${u('title-left-inactive.png')}; --xp-title-right-inactive: ${u('title-right-inactive.png')}; }\n`;
    css += `:root { --xp-checkbox-unchecked: ${u('checkbox-unchecked-normal.png')}; --xp-checkbox-unchecked-hover: ${u('checkbox-unchecked-hover.png')}; --xp-checkbox-unchecked-pressed: ${u('checkbox-unchecked-pressed.png')}; --xp-checkbox-checked: ${u('checkbox-checked-normal.png')}; --xp-checkbox-checked-hover: ${u('checkbox-checked-hover.png')}; --xp-checkbox-checked-pressed: ${u('checkbox-checked-pressed.png')}; --xp-groupbox: ${u('groupbox.png')}; --xp-field-outline: ${u('field-outline.png')}; }\n`;
    css += ':root { ';
    for (const direction of ['up', 'down', 'left', 'right']) css += `--xp-scroll-${direction}: ${u(`scroll-${direction}-normal.png`)}; --xp-scroll-${direction}-hover: ${u(`scroll-${direction}-hover.png`)}; --xp-scroll-${direction}-pressed: ${u(`scroll-${direction}-pressed.png`)}; `;
    css += `--xp-scroll-shaft-vertical: ${u('scroll-shaft-vertical.png')}; --xp-scroll-shaft-horizontal: ${u('scroll-shaft-horizontal.png')}; `;
    for (const axis of ['vertical', 'horizontal']) css += `--xp-scroll-thumb-${axis}: ${u(`scroll-thumb-${axis}-normal.png`)}; --xp-scroll-thumb-${axis}-hover: ${u(`scroll-thumb-${axis}-hover.png`)}; --xp-scroll-thumb-${axis}-pressed: ${u(`scroll-thumb-${axis}-pressed.png`)}; `;
    css += '}\n';
    return { files, css };
  }
  async function writeAeroScheme(pe) {
    const files = {};
    for (const [filename, id] of [['aero-close-strip.png', 936], ['aero-close-glyphs.png', 937]]) { const png = namedPng(pe, 'IMAGE', id); if (png) files[filename] = new Blob([png], { type: 'image/png' }); }
    const title = namedPng(pe, 'IMAGE', 934);
    if (title) {
      const picture = await decodeImage(title, 'image/png');
      const activeHeight = Math.floor(picture.height / 2), left = Math.min(16, Math.floor(picture.width / 3)), right = Math.min(16, Math.floor(picture.width / 3));
      files['aero-title-left.png'] = await pngBlob(picture.crop(0, 0, left, activeHeight));
      files['aero-title-fill.png'] = await pngBlob(picture.crop(left, 0, picture.width - right, activeHeight));
      files['aero-title-right.png'] = await pngBlob(picture.crop(picture.width - right, 0, picture.width, activeHeight));
    }
    const atlas = namedPng(pe, 'STREAM', 971);
    if (atlas) files['aero-glass-reflection.png'] = await pngBlob((await decodeImage(atlas, 'image/png')).crop(555, 0, 555 + 802, 604));
    return { files, css: window.NekoAeroCss.replace(/url\("\{asset\}\/([^"]+)"\)/g, (_, name) => asset(name)) };
  }
  // import_theme(): renders a .theme or .msstyles source into { metadata, dirs }.
  async function importMsStyles(files, source) {
    const msstyles = resolveTheme(files, source);
    const pe = new PeFile(files[msstyles]);
    const displayName = themeDisplayName(files, source, msstyles);
    if (isAeroStyle(source, msstyles)) {
      const scheme = 'normalcolor', rendered = await writeAeroScheme(pe);
      return { metadata: { theme: displayName, msstyles: baseName(msstyles), schemes: [{ id: scheme, name: 'Default (blue)' }], defaultScheme: scheme }, dirs: { '': rendered, [`schemes/${scheme}`]: rendered } };
    }
    const images = await bitmaps(pe);
    const colours = themeColours(files, source);
    const suffix = '_FRAMECAPTION_BMP';
    const prefixes = images.map(([name]) => name).filter(name => name.toUpperCase().endsWith(suffix)).map(name => name.slice(0, -suffix.length));
    if (!prefixes.length) throw new ThemeError('Theme has no frame resources');
    const selected = sourceScheme(files, source, prefixes);
    const dirs = { '': await writeScheme(images, selected, colours) };
    const schemes = [];
    for (const prefix of prefixes) {
      const schemeId = prefix.toLowerCase();
      schemes.push({ id: schemeId, name: schemeLabel(prefix) });
      dirs[`schemes/${schemeId}`] = prefix === selected ? dirs[''] : await writeScheme(images, prefix, colours);
    }
    return { metadata: { theme: displayName, msstyles: baseName(msstyles), schemes, defaultScheme: selected.toLowerCase() }, dirs };
  }

  // ---- Theme manager (ipcMain handlers) ----------------------------------------------------
  let activeTheme = null;
  let activeDisplay = { language: 'ru', loginUi: 'xp', micDeviceId: '', noiseSuppression: 'webrtc' };
  const materialized = new Map(); // `${id}|${scheme}` → blob: URL of the stylesheet
  let prebuiltIds;

  async function prebuiltList() {
    prebuiltIds ||= fetch('prebuilt/index.json').then(response => response.json()).catch(() => ['Classic', 'Luna']);
    return prebuiltIds;
  }
  function findSource(names) {
    const sorted = [...names].sort();
    return sorted.find(name => extension(name) === 'theme') || sorted.find(name => extension(name) === 'msstyles') || sorted.find(name => baseName(name).toLowerCase() === 'theme.css');
  }
  async function discoverThemes() {
    const found = (await prebuiltList()).map(id => ({ id, prebuilt: true }));
    for (const record of (await dbAll('themes')).sort((a, b) => a.id.localeCompare(b.id))) {
      if (RESERVED_IDS.has(record.id)) continue;
      const source = findSource(Object.keys(record.files)); if (!source) continue;
      const index = found.findIndex(theme => theme.id === record.id); if (index >= 0) found.splice(index, 1);
      found.push({ id: record.id, prebuilt: false, record, source, css: baseName(source).toLowerCase() === 'theme.css', userInstalled: true, catalogId: record.catalogId || null });
    }
    return found;
  }
  async function prepareTheme(id) {
    const theme = (await discoverThemes()).find(item => item.id === id);
    if (!theme) throw new ThemeError('Theme not found');
    if (theme.prebuilt) {
      const response = await fetch(`prebuilt/${encodeURIComponent(id)}/theme.json`);
      if (!response.ok) throw new ThemeError('Theme not found');
      return { theme, metadata: await response.json() };
    }
    if (theme.css) return { theme, metadata: { theme: id, schemes: [{ id: 'default', name: 'Default' }], defaultScheme: 'default' } };
    const stamp = `${theme.record.installed}:${IMPORTER_VERSION}`;
    let rendered = await dbGet('rendered', id);
    if (rendered?.stamp !== stamp) {
      const files = Object.fromEntries(await Promise.all(Object.entries(theme.record.files).map(async ([name, blob]) => [name, new Uint8Array(await blob.arrayBuffer())])));
      rendered = { id, stamp, ...(await importMsStyles(files, theme.source)) };
      await dbPut('rendered', rendered);
    }
    return { theme, metadata: rendered.metadata, rendered };
  }
  const objectUrl = blob => URL.createObjectURL(blob);
  // Built-in themes are plain files next to the page; their CSS carries absolute file:// URLs
  // from the build machine, so point every url() at the asset of the same name (as main.js does).
  async function prebuiltCss(id, scheme) {
    const directory = new URL(`prebuilt/${encodeURIComponent(id)}/schemes/${encodeURIComponent(scheme)}/`, location.href);
    const response = await fetch(new URL('theme.css', directory));
    if (!response.ok) throw new ThemeError('Theme not found');
    return (await response.text()).replace(/url\("([^"]+)"\)/g, (_, target) => `url("${new URL(baseName(target), directory).href}")`);
  }
  // A theme.css bundle refers to its images by relative paths inside the ZIP.
  function userCss(record, source) {
    const root = source.includes('/') ? source.slice(0, source.lastIndexOf('/') + 1) : '';
    return record.files[source].text().then(css => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, target) => {
      if (/^(data:|https?:|blob:)/i.test(target)) return match;
      const parts = []; for (const part of (root + target.replace(/^\.\//, '')).split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
      const file = record.files[parts.join('/')];
      return file ? `url("${objectUrl(file)}")` : match;
    }));
  }
  async function cssUrl(prepared, scheme) {
    const key = `${prepared.theme.id}|${scheme}|${prepared.rendered?.stamp || prepared.theme.record?.installed || ''}`;
    if (materialized.has(key)) return materialized.get(key);
    let css;
    if (prepared.theme.prebuilt) css = await prebuiltCss(prepared.theme.id, scheme);
    else if (prepared.theme.css) css = await userCss(prepared.theme.record, prepared.theme.source);
    else {
      const directory = prepared.rendered.dirs[`schemes/${scheme}`] || prepared.rendered.dirs[''];
      const urls = Object.fromEntries(Object.entries(directory.files).map(([name, blob]) => [name, objectUrl(blob)]));
      css = directory.css.replace(/nk-asset:([^")]+)/g, (_, name) => urls[name] || '');
    }
    const url = objectUrl(new Blob([css], { type: 'text/css' }));
    materialized.set(key, url);
    return url;
  }
  const hasScheme = (metadata, scheme) => (metadata.schemes || []).some(item => item.id === scheme);

  async function listThemes() {
    const results = [];
    for (const theme of await discoverThemes()) {
      let prepared; try { prepared = await prepareTheme(theme.id); } catch (error) { console.warn(`Theme ${theme.id} skipped:`, error); continue; }
      const name = String(prepared.metadata.theme || theme.id).replace(/\.(theme|msstyles)$/i, '') || theme.id;
      results.push({ id: theme.id, name, schemes: prepared.metadata.schemes || [], removable: Boolean(theme.userInstalled), catalogId: theme.catalogId || null });
    }
    return results;
  }
  async function previewTheme(id, scheme) {
    const prepared = await prepareTheme(id);
    const active = scheme || prepared.metadata.defaultScheme || '';
    return { id, scheme: active, revision: now(), cssUrl: await cssUrl(prepared, active) };
  }
  async function activateTheme(id, requestedScheme) {
    if (!/^[a-zA-Z0-9._ -]+$/.test(String(id)) || (requestedScheme && !/^[a-zA-Z0-9._-]+$/.test(requestedScheme))) throw new ThemeError('Invalid theme name');
    const prepared = await prepareTheme(id);
    const scheme = requestedScheme || prepared.metadata.defaultScheme || '';
    if (!hasScheme(prepared.metadata, scheme)) throw new ThemeError('Unknown colour scheme');
    activeTheme = { id, scheme, revision: now(), cssUrl: await cssUrl(prepared, scheme) };
    writeStored(THEME_STATE_KEY, { id, scheme });
    return activeTheme;
  }
  async function removeTheme(id) {
    const theme = (await discoverThemes()).find(item => item.id === id);
    if (!theme?.userInstalled) throw new ThemeError('Built-in themes cannot be removed.');
    if (activeTheme?.id === id) await activateTheme('Classic', 'classic');
    await dbDelete('themes', id); await dbDelete('rendered', id);
    return { themes: await listThemes(), activeTheme };
  }
  // Keeps only what a theme needs from a ZIP, like installCatalogTheme() in main.js.
  async function bundleFiles(zip) {
    const entries = await readZip(zip);
    const source = Object.keys(entries).sort().find(name => ['theme', 'msstyles'].includes(extension(name)) || baseName(name).toLowerCase() === 'theme.css');
    if (!source) throw new ThemeError('Theme.ZIP must contain a .theme, .msstyles, or theme.css file.');
    const root = source.includes('/') ? source.slice(0, source.lastIndexOf('/') + 1) : '';
    const copyAll = baseName(source).toLowerCase() === 'theme.css';
    const files = {};
    for (const [name, bytes] of Object.entries(entries)) {
      if (!name.startsWith(root)) continue;
      if (!copyAll && !/\.(theme|msstyles|dll|mui)$/i.test(name)) continue;
      files[name.slice(root.length)] = new Blob([bytes]);
    }
    return files;
  }
  async function installRecord(record) {
    await dbPut('themes', record);
    try { await prepareTheme(record.id); }
    catch (error) { await dbDelete('themes', record.id); await dbDelete('rendered', record.id); throw error; }
  }
  // Imports a user-picked file: .msstyles, .theme, theme.css or a .zip bundle.
  async function importThemeFile(file) {
    const base = (file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 60)) || 'Custom-theme';
    const id = `${base}-${now()}`;
    const lower = file.name.toLowerCase();
    let files;
    if (lower.endsWith('.zip')) files = await bundleFiles(await file.arrayBuffer());
    else if (lower.endsWith('.css')) files = { 'theme.css': file };
    else if (lower.endsWith('.msstyles') || lower.endsWith('.theme')) files = { [file.name.replace(/\//g, '_')]: file };
    else throw new ThemeError(activeDisplay.language === 'en' ? 'Choose a .msstyles, .theme, theme.css or .zip theme file.' : 'Выберите файл .msstyles, .theme, theme.css или .zip с темой.');
    await installRecord({ id, installed: now(), files });
    const prepared = await prepareTheme(id);
    const scheme = prepared.metadata.defaultScheme || '';
    return { themes: await listThemes(), id, scheme, revision: now(), cssUrl: await cssUrl(prepared, scheme) };
  }
  // dialog.showOpenDialog: the click that opened it counts as the user action for the picker.
  function pickFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.msstyles,.theme,.css,.zip';
      input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
      input.addEventListener('cancel', () => resolve(null), { once: true });
      input.click();
    });
  }
  async function importTheme() { const file = await pickFile(); return file ? importThemeFile(file) : null; }

  // ---- Catalog ------------------------------------------------------------------------------
  function catalogEntries(manifest) {
    let entries = [];
    if (Array.isArray(manifest)) entries = manifest.map(item => item || {});
    else if (Array.isArray(manifest?.themes)) entries = manifest.themes.map(item => item || {});
    else if (manifest && typeof manifest === 'object') entries = Object.keys(manifest).sort().map(key => ({ ...(manifest[key] || {}), theme_id: key }));
    return entries.map((entry, index) => {
      const pick = (...keys) => { for (const key of keys) { const value = entry[key]; if (value !== undefined && value !== null && String(value)) return String(value); } return null; };
      const details = entry.Details || entry.details || {};
      const detail = (...keys) => keys.map(key => details[key]).find(value => typeof value === 'string' && value);
      const themeId = pick('theme_id', 'id') || `theme-${index + 1}`;
      const directory = (pick('directory') || themeId).replace(/^\/+|\/+$/g, '');
      return {
        id: themeId, directory, displayName: pick('DisplayName', 'displayName') || themeId,
        colorSchemes: entry.ColorSchemes || entry.ColorShemas || entry.colorSchemes || [],
        type: detail('Type', 'type') || pick('Type', 'type') || 'WindowsThemeFile',
        author: detail('Author', 'author') || pick('Author', 'author') || 'Unknown',
        version: detail('Version', 'version') || pick('Version', 'version') || 'Unknown',
        previewUrl: pick('Preview', 'preview') || `${CATALOG_ROOT}/${directory}/Preview.png`,
        descriptionUrl: pick('Description', 'description') || `${CATALOG_ROOT}/${directory}/Description.md`,
        detailsUrl: pick('DetailsFile', 'detailsFile') || `${CATALOG_ROOT}/${directory}/Details.json`,
        zipUrl: pick('ThemeZIP', 'themeZip') || `${CATALOG_ROOT}/${directory}/Theme.ZIP`,
      };
    });
  }
  async function fetchCatalog() {
    const response = await fetch(`${CATALOG_ROOT}/themes.json`, { cache: 'no-store' });
    if (!response.ok) throw new ThemeError(response.status === 404 ? 'Theme catalog has not been published yet.' : `Unable to load theme catalog (${response.status}).`);
    return catalogEntries(await response.json());
  }
  async function catalogItem(id) {
    const item = (await fetchCatalog()).find(theme => theme.id === id);
    if (!item) throw new ThemeError('Theme no longer exists in the catalog.');
    return item;
  }
  async function fetchCatalogThemeDetails(id) {
    const item = await catalogItem(id);
    let description = '';
    try { const response = await fetch(item.descriptionUrl); if (response.ok) description = await response.text(); } catch {}
    return { ...item, description };
  }
  async function installCatalogTheme(id) {
    const item = await catalogItem(id);
    const response = await fetch(item.zipUrl);
    if (!response.ok) throw new ThemeError(`Unable to download Theme.ZIP (${response.status}).`);
    const themeId = `${item.id.replace(/[^a-zA-Z0-9._-]/g, '_')}-${now()}`;
    await installRecord({ id: themeId, installed: now(), catalogId: item.id, files: await bundleFiles(await response.arrayBuffer()) });
    return { id: themeId, themes: await listThemes() };
  }

  // ---- Settings -----------------------------------------------------------------------------
  function saveDisplaySettings(settings = {}) {
    const merged = { ...activeDisplay, ...settings };
    activeDisplay = {
      language: merged.language === 'en' ? 'en' : 'ru',
      loginUi: merged.loginUi === 'classic' ? 'classic' : 'xp',
      micDeviceId: typeof merged.micDeviceId === 'string' ? merged.micDeviceId : '',
      noiseSuppression: ['off', 'rnnoise'].includes(merged.noiseSuppression) ? merged.noiseSuppression : 'webrtc',
    };
    writeStored(DISPLAY_STATE_KEY, activeDisplay);
    return activeDisplay;
  }
  async function load() {
    activeDisplay = { ...activeDisplay, ...(readStored(DISPLAY_STATE_KEY) || {}) };
    const saved = readStored(THEME_STATE_KEY) || { id: 'Classic' };
    try { await activateTheme(saved.id || 'Classic', saved.scheme || undefined); }
    catch { try { await activateTheme('Classic', 'classic'); } catch (error) { console.error('Theme activation failed:', error); } }
  }
  const loaded = load();

  window.NekoThemes = {
    ready: () => loaded,
    get activeTheme() { return activeTheme; },
    get activeDisplay() { return activeDisplay; },
    listThemes, previewTheme, activateTheme, removeTheme, importTheme,
    fetchCatalog, fetchCatalogThemeDetails, installCatalogTheme, saveDisplaySettings,
  };
})();
