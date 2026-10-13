import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RichTextEditor } from '../RichTextEditor';

describe('RichTextEditor - XSS Prevention', () => {
  it('sanitizes malicious script tags in value prop', () => {
    const maliciousValue = '<p>Hello</p><script>alert("xss")</script>';
    const { container } = render(<RichTextEditor value={maliciousValue} onChange={() => {}} />);

    const editorDiv = container.querySelector('[contenteditable="true"]');
    expect(editorDiv?.innerHTML).toBe('<p>Hello</p>');
    expect(container.querySelector('script')).toBeNull();
  });

  it('sanitizes event handlers in HTML attributes', () => {
    const maliciousValue = '<img src="invalid" onerror="alert(1)" /><b onmouseover="alert(1)">Bold</b>';
    const { container } = render(<RichTextEditor value={maliciousValue} onChange={() => {}} />);

    const editorDiv = container.querySelector('[contenteditable="true"]');
    expect(editorDiv?.innerHTML).not.toContain('onerror');
    expect(editorDiv?.innerHTML).not.toContain('onmouseover');
  });

  it('preserves valid safe rich text formatting', () => {
    const safeValue = '<p><strong>Bold</strong> and <em>Italic</em> text with a <a href="https://example.com">link</a></p>';
    const { container } = render(<RichTextEditor value={safeValue} onChange={() => {}} />);

    const editorDiv = container.querySelector('[contenteditable="true"]');
    expect(editorDiv?.innerHTML).toBe(safeValue);
  });
});
