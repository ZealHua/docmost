import { JSDOM } from "jsdom";

export class Window {
  document: Document;
  DOMParser: typeof DOMParser;
  XMLSerializer: typeof XMLSerializer;
  happyDOM: {
    abort: () => void;
    close: () => void;
  };

  constructor() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    this.document = dom.window.document as unknown as Document;
    this.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser;
    this.XMLSerializer = dom.window.XMLSerializer as unknown as typeof XMLSerializer;
    this.happyDOM = {
      abort: () => {},
      close: () => dom.window.close(),
    };
  }
}

export default { Window };
