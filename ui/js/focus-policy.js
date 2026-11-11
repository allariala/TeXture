// Native select popups in Mac Office lose their open state if the textarea takes focus.
const CONTROLS = 'button, input, textarea, select, option, label, a, [contenteditable], [tabindex], .popup, .sheet, .palette, .size, .colors, .word-numbering';

export function bindEditorFocus({ document, window, editor, isSettingsOpen, officeMode }) {
  const isControl = (target) => !!target?.closest?.(CONTROLS);
  document.addEventListener('mousedown', (event) => {
    if (isSettingsOpen() || isControl(event.target)) return;
    setTimeout(() => {
      // A control may have received focus since mousedown. Do not override that interaction.
      if (!isSettingsOpen() && !isControl(document.activeElement)) editor.focus();
    }, 0);
  });
  window.addEventListener('focus', () => {
    // Returning from Word or its native popup must not pull focus back out of the document.
    if (!officeMode && !isSettingsOpen() && !isControl(document.activeElement)) editor.focus();
  });
}
