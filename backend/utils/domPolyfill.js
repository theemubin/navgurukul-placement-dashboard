/**
 * Polyfill DOM and Canvas globals for Node.js environments.
 * Required by pdfjs-dist and pdf-parse (v2+) when running in server-side Node.js
 * where browser-native DOMMatrix, Path2D, and ImageData are not present globally.
 */

if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0];
        this.b = init[1];
        this.c = init[2];
        this.d = init[3];
        this.e = init[4];
        this.f = init[5];
      } else {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
      }
    }
  };
}

if (typeof global.DOMPoint === 'undefined') {
  global.DOMPoint = class DOMPoint {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  };
}

if (typeof global.DOMRect === 'undefined') {
  global.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }
  };
}

if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(width = 0, height = 0) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D {
    constructor() {}
  };
}

module.exports = {
  DOMMatrix: global.DOMMatrix,
  DOMPoint: global.DOMPoint,
  DOMRect: global.DOMRect,
  ImageData: global.ImageData,
  Path2D: global.Path2D
};
