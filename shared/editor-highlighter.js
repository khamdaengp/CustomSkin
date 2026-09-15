/**
 * CustomSkin - Zero-dependency CSS Syntax Highlighter & Editor Enhancer
 * Provides synchronized syntax highlighting, line numbers, Tab key indentation,
 * and auto-closing brackets for standard <textarea> elements.
 */

class CSSEditor {
  /**
   * Initializes the enhanced CSS editor on a container or textarea.
   * @param {Object} options
   * @param {HTMLTextAreaElement} options.textarea
   * @param {HTMLElement} [options.highlightElement] - Optional <code> or <pre> for syntax coloring
   * @param {HTMLElement} [options.lineNumbersElement] - Optional container for line numbers
   * @param {HTMLElement} [options.statsElement] - Optional element to display line/char count
   * @param {Function} [options.onChange] - Callback fired when value changes
   */
  constructor({ textarea, highlightElement, highlightBackdrop, lineNumbersElement, statsElement, onChange }) {
    this.textarea = textarea;
    this.highlightElement = highlightElement;

    // Resolve the actual scrollable element for the highlight backdrop
    if (highlightBackdrop) {
      this.highlightContainer = highlightBackdrop;
    } else if (this.highlightElement) {
      if (this.highlightElement.tagName === 'CODE' && this.highlightElement.parentElement) {
        this.highlightContainer = this.highlightElement.parentElement;
      } else {
        this.highlightContainer = this.highlightElement;
      }
    } else {
      this.highlightContainer = null;
    }

    this.lineNumbersElement = lineNumbersElement;
    this.statsElement = statsElement;
    this.onChange = onChange;

    this.init();
  }

  init() {
    if (!this.textarea) return;

    // Attach keyboard and scroll event listeners
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.addEventListener('input', () => this.handleInput());
    this.textarea.addEventListener('scroll', () => this.syncScroll(), { passive: true });

    // Ensure sync when moving cursor with arrow keys, page up/down, or clicking
    this.textarea.addEventListener('keyup', () => this.syncScroll(), { passive: true });
    this.textarea.addEventListener('mouseup', () => this.syncScroll(), { passive: true });
    this.textarea.addEventListener('click', () => this.syncScroll(), { passive: true });

    // Allow scrolling when mouse is over the line numbers column
    if (this.lineNumbersElement) {
      this.lineNumbersElement.addEventListener('wheel', (e) => {
        this.textarea.scrollTop += e.deltaY;
        this.textarea.scrollLeft += e.deltaX;
        this.syncScroll();
      }, { passive: true });
    }

    // Initial render
    this.update();
  }

  /**
   * Synchronizes scroll position between textarea and background highlight/lines
   */
  syncScroll() {
    if (this.highlightContainer) {
      this.highlightContainer.scrollTop = this.textarea.scrollTop;
      this.highlightContainer.scrollLeft = this.textarea.scrollLeft;
    }
    if (this.lineNumbersElement) {
      this.lineNumbersElement.scrollTop = this.textarea.scrollTop;
    }
  }

  /**
   * Handles keyboard shortcuts (Tab, auto-close brackets/quotes)
   * @param {KeyboardEvent} e 
   */
  handleKeyDown(e) {
    const { key, shiftKey } = e;
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const val = this.textarea.value;

    // 1. Handle Tab key (indent / unindent)
    if (key === 'Tab') {
      e.preventDefault();
      const tabSpaces = '  '; // 2 spaces

      if (start === end) {
        // Simple insertion
        this.insertText(tabSpaces, start, end, start + tabSpaces.length);
      } else {
        // Multi-line indent/unindent
        const beforeSelection = val.substring(0, start);
        const lineStart = beforeSelection.lastIndexOf('\n') + 1;
        const afterSelection = val.substring(end);
        const selectedText = val.substring(lineStart, end);
        const lines = selectedText.split('\n');

        let modifiedText;
        let newStart = start;
        let newEnd = end;

        if (shiftKey) {
          // Unindent: remove up to 2 spaces
          modifiedText = lines.map(line => {
            if (line.startsWith('  ')) {
              return line.substring(2);
            } else if (line.startsWith(' ')) {
              return line.substring(1);
            }
            return line;
          }).join('\n');
          newEnd = lineStart + modifiedText.length;
        } else {
          // Indent: add 2 spaces to each line
          modifiedText = lines.map(line => tabSpaces + line).join('\n');
          newEnd = lineStart + modifiedText.length;
          newStart = start + tabSpaces.length;
        }

        this.textarea.value = val.substring(0, lineStart) + modifiedText + afterSelection;
        this.textarea.selectionStart = newStart;
        this.textarea.selectionEnd = newEnd;
        this.handleInput();
      }
      return;
    }

    // 2. Auto-close pairs: { }, ( ), [ ], " ", ' '
    const pairs = {
      '{': '}',
      '(': ')',
      '[': ']',
      '"': '"',
      "'": "'"
    };

    if (pairs[key]) {
      const closing = pairs[key];
      // If user has selected text, wrap it!
      if (start !== end) {
        e.preventDefault();
        const selected = val.substring(start, end);
        const replacement = key + selected + closing;
        this.insertText(replacement, start, end, start + 1, end + 1);
        return;
      }

      // If user typed quotes right before an identical quote, just skip over it
      if ((key === '"' || key === "'") && val[start] === key) {
        e.preventDefault();
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
        return;
      }

      // Auto-insert pair
      e.preventDefault();
      this.insertText(key + closing, start, end, start + 1);
      return;
    }

    // 3. Skip over closing bracket if typed
    if ((key === '}' || key === ')' || key === ']') && val[start] === key && start === end) {
      e.preventDefault();
      this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
      return;
    }

    // 4. Handle Enter key inside { } for smart auto-indent
    if (key === 'Enter' && start === end) {
      const prevChar = val[start - 1];
      const nextChar = val[start];
      if (prevChar === '{' && nextChar === '}') {
        e.preventDefault();
        // Insert newline + 2 spaces + newline
        const indent = '\n  \n';
        this.insertText(indent, start, end, start + 3);
        return;
      }
    }
  }

  /**
   * Helper to insert text at specific range with selection update
   */
  insertText(text, start, end, newSelectionStart, newSelectionEnd = newSelectionStart) {
    const supported = document.execCommand && document.execCommand('insertText', false, text);
    if (!supported) {
      const val = this.textarea.value;
      this.textarea.value = val.substring(0, start) + text + val.substring(end);
      this.textarea.selectionStart = newSelectionStart;
      this.textarea.selectionEnd = newSelectionEnd;
    }
    this.handleInput();
  }

  handleInput() {
    this.update();
    if (typeof this.onChange === 'function') {
      this.onChange(this.textarea.value);
    }
  }

  /**
   * Refreshes syntax highlighting, line numbers, and stats
   */
  update() {
    const code = this.textarea.value;

    // Update syntax highlighting
    if (this.highlightElement) {
      this.highlightElement.innerHTML = CSSEditor.highlightCSS(code);
    }

    // Update line numbers
    if (this.lineNumbersElement) {
      const lineCount = (code.match(/\n/g) || []).length + 1;
      let linesHtml = '';
      for (let i = 1; i <= lineCount; i++) {
        linesHtml += `<span>${i}</span>`;
      }
      this.lineNumbersElement.innerHTML = linesHtml;
    }

    // Update stats
    if (this.statsElement) {
      const lines = (code.match(/\n/g) || []).length + 1;
      const chars = code.length;
      const rules = (code.match(/\{/g) || []).length;
      this.statsElement.textContent = `${lines} ${lines === 1 ? 'line' : 'lines'} • ${chars} chars • ${rules} ${rules === 1 ? 'rule' : 'rules'}`;
    }

    this.syncScroll();
  }

  /**
   * Sets value programmatically and updates visuals
   * @param {string} code 
   */
  setValue(code) {
    this.textarea.value = code || '';
    this.update();
  }

  /**
   * Gets current editor value
   * @returns {string}
   */
  getValue() {
    return this.textarea.value;
  }

  /**
   * Tokenizes and colorizes raw CSS code using zero-dependency regex tokenizer.
   * Produces safe HTML with spans for tokens.
   * @param {string} code 
   * @returns {string} HTML with colored spans
   */
  static highlightCSS(code) {
    if (!code) return '&nbsp;';

    // HTML escape helper
    const escapeHtml = (str) =>
      str.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;');

    // Token types with distinct colors:
    // - comment: /* ... */
    // - string: "..." or '...'
    // - at-rule: @media, @keyframes, @import, etc.
    // - property: inside { }, before :
    // - important: !important
    // - color / number / unit: #fff, 12px, 1.5rem, 50%
    // - selector: outside { }
    // - punctuation: { } ; : ,

    const tokenRegex = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z-]+)|(!important)|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%|s|ms|deg|fr)\b|\b\d+(?:\.\d+)?\b)|(:root|::?[a-zA-Z-]+)|([{}();:,])|([a-zA-Z-]+)(?=\s*:)|([^/"'@!#\d:;{}(),\s]+)/g;

    let html = '';
    let lastIndex = 0;
    let match;
    let blockDepth = 0;

    while ((match = tokenRegex.exec(code)) !== null) {
      // Append unparsed whitespace/chars before this match
      if (match.index > lastIndex) {
        html += escapeHtml(code.substring(lastIndex, match.index));
      }

      const [
        full,
        comment,
        str,
        atRule,
        important,
        hexColor,
        numUnit,
        pseudo,
        punct,
        prop,
        other
      ] = match;

      if (comment) {
        html += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
      } else if (str) {
        html += `<span class="tok-string">${escapeHtml(str)}</span>`;
      } else if (atRule) {
        html += `<span class="tok-atrule">${escapeHtml(atRule)}</span>`;
      } else if (important) {
        html += `<span class="tok-important">${escapeHtml(important)}</span>`;
      } else if (hexColor) {
        html += `<span class="tok-color">${escapeHtml(hexColor)}</span>`;
      } else if (numUnit) {
        html += `<span class="tok-number">${escapeHtml(numUnit)}</span>`;
      } else if (pseudo) {
        html += `<span class="tok-pseudo">${escapeHtml(pseudo)}</span>`;
      } else if (prop) {
        html += `<span class="tok-property">${escapeHtml(prop)}</span>`;
      } else if (punct) {
        if (punct === '{') blockDepth++;
        else if (punct === '}') blockDepth = Math.max(0, blockDepth - 1);
        html += `<span class="tok-punct">${escapeHtml(punct)}</span>`;
      } else if (other) {
        if (blockDepth === 0 || other.startsWith('.') || other.startsWith('#')) {
          html += `<span class="tok-selector">${escapeHtml(other)}</span>`;
        } else {
          html += `<span class="tok-keyword">${escapeHtml(other)}</span>`;
        }
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < code.length) {
      html += escapeHtml(code.substring(lastIndex));
    }

    // Trailing newline rendering
    if (code.endsWith('\n')) {
      html += '<br>&nbsp;';
    }

    return html;
  }
}

if (typeof window !== 'undefined') {
  window.CSSEditor = CSSEditor;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSSEditor;
}
