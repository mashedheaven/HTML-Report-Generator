import { useRef, useEffect, useCallback, useState } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline, Strikethrough, Superscript, Subscript, Link } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minimal?: boolean; // hide toolbar, show on focus
}

export function RichTextEditor({ value, onChange, placeholder, className = '', minimal = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelection = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const sanitized = DOMPurify.sanitize(value);
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const execCommand = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      isInternalChange.current = true;
      const sanitized = DOMPurify.sanitize(editorRef.current.innerHTML);
      onChange(sanitized);
    }
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      const sanitized = DOMPurify.sanitize(editorRef.current.innerHTML);
      onChange(sanitized);
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedSelection.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const openLinkDialog = () => {
    saveSelection();
    setLinkUrl('');
    setShowLinkDialog(true);
  };

  const insertLink = () => {
    if (!linkUrl.trim()) {
      setShowLinkDialog(false);
      return;
    }
    restoreSelection();
    execCommand('createLink', linkUrl.trim());
    setShowLinkDialog(false);
    setLinkUrl('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case 'k':
          e.preventDefault();
          openLinkDialog();
          break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const htmlData = e.clipboardData.getData('text/html');
    if (htmlData) {
      e.preventDefault();
      const sanitizedHtml = DOMPurify.sanitize(htmlData);
      document.execCommand('insertHTML', false, sanitizedHtml);
      if (editorRef.current) {
        isInternalChange.current = true;
        const sanitized = DOMPurify.sanitize(editorRef.current.innerHTML);
        onChange(sanitized);
      }
    }
  };

  const linkDialog = showLinkDialog && (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setShowLinkDialog(false)} />
      <div className="relative bg-white rounded-lg shadow-xl p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">Insert Link</h3>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); if (e.key === 'Escape') setShowLinkDialog(false); }}
          placeholder="https://..."
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => setShowLinkDialog(false)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
          <button onClick={insertLink} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Insert</button>
        </div>
      </div>
    </div>
  );

  const toolbarButtons = [
    { command: 'bold', icon: Bold, title: 'Bold (Ctrl+B)' },
    { command: 'italic', icon: Italic, title: 'Italic (Ctrl+I)' },
    { command: 'underline', icon: Underline, title: 'Underline (Ctrl+U)' },
    { command: 'strikethrough', icon: Strikethrough, title: 'Strikethrough' },
    { command: 'superscript', icon: Superscript, title: 'Superscript' },
    { command: 'subscript', icon: Subscript, title: 'Subscript' },
  ];

  if (minimal) {
    return (
      <>
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className={`outline-none min-h-[1.5em] ${className} empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`}
          suppressContentEditableWarning
        />
        {linkDialog}
      </>
    );
  }

  return (
    <>
      <div className="border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-200 bg-gray-50">
          {toolbarButtons.map(({ command, icon: Icon, title }) => (
            <button
              key={command}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCommand(command); }}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
              title={title}
            >
              <Icon size={15} />
            </button>
          ))}
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); openLinkDialog(); }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            title="Insert Link (Ctrl+K)"
          >
            <Link size={15} />
          </button>
        </div>
        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className={`px-3 py-2 min-h-[100px] outline-none text-sm ${className} empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`}
          suppressContentEditableWarning
        />
      </div>
      {linkDialog}
    </>
  );
}
