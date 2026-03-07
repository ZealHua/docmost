import { cleanupXWikiHtml } from './import-formatter';

describe('cleanupXWikiHtml', () => {
  it('should remove empty p, span, div, and font tags', () => {
    const html = `
      <div>
        <p></p>
        <span>       </span>
        <div></div>
        <font>
        </font>
      </div>
    `;
    const cleaned = cleanupXWikiHtml(html);

    expect(cleaned).not.toMatch(/<p><\/p>/);
    expect(cleaned).not.toMatch(/<span>\s*<\/span>/);
    expect(cleaned).not.toMatch(/<div><\/div>/);
    expect(cleaned).not.toMatch(/<font>\s*<\/font>/);
  });

  it('should ignore tags with attributes, children, or comments', () => {
    const html = `
      <p class="test"></p>
      <span><!-- some comment --></span>
      <div>not empty</div>
    `;
    const cleaned = cleanupXWikiHtml(html);

    expect(cleaned).toMatch(/<p class="test"><\/p>/);
    expect(cleaned).toMatch(/<span><!--.*--><\/span>/);
    expect(cleaned).toMatch(/<div>not empty<\/div>/);
  });

  it('should not remove tags with whitespace-only and attributes', () => {
    const html = `
      <p class="test">    </p>
    `;
    const cleaned = cleanupXWikiHtml(html);

    expect(cleaned).toMatch(/<p class="test">\s*<\/p>/);
  });

  it('should remove deeply nested empty tags', () => {
    const html = `
      <div><div><div></div></div></div>
      <span><span></span></span>
    `;
    const cleaned = cleanupXWikiHtml(html);

    expect(cleaned).not.toMatch(/<div><div><div><\/div><\/div><\/div>/);
    expect(cleaned).not.toMatch(/<span><span><\/span><\/span>/);
  });

  it('should keep tags with text or non-empty children', () => {
    const html = `
      <div>
        <div>content</div>
        <span>
          <span>inner</span>
        </span>
      </div>
    `;
    const cleaned = cleanupXWikiHtml(html);

    expect(cleaned).toMatch(/<div>\s*<div>content<\/div>/);
    expect(cleaned).toMatch(/<span>\s*<span>inner<\/span>\s*<\/span>/);
  });

  it('should keep tags with comments', () => {
    const html = `
      <div><!-- comment --></div>
    `;
    const cleaned = cleanupXWikiHtml(html);

    expect(cleaned).toMatch(/<div><!-- comment --><\/div>/);
  });
});
