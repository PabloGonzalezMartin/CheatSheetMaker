/**
 * CheatSheet Maker - Frontend JavaScript (Fixed Version)
 */

// Global 401 handler - redirect to login if session expires
const _originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await _originalFetch(...args);
    if (response.status === 401) {
        window.location.href = '/login';
    }
    return response;
};

// Share cheatsheet toggle
async function shareCheatsheet() {
    if (!currentCheatsheet.id) {
        showNotification('Save the cheatsheet first', 'error');
        return;
    }
    try {
        const response = await fetch(`/api/cheatsheet/${currentCheatsheet.id}/share`, { method: 'PUT' });
        const data = await response.json();
        if (data.success) {
            if (data.is_public && data.share_url) {
                await navigator.clipboard.writeText(data.share_url);
                showNotification('Public link copied to clipboard!', 'success');
            } else {
                showNotification('Cheatsheet is now private', 'success');
            }
        }
    } catch (error) {
        showNotification('Failed to update sharing', 'error');
    }
}

// Current cheatsheet state
let currentCheatsheet = {
    id: null,
    title: '',
    sections: []
};

// Undo/Redo history
const historyStack = [];
const redoStack = [];
const MAX_HISTORY = 50;
let isUndoRedoAction = false;
let saveHistoryTimeout = null;

// Cleanup tracking
let dragObserver = null;
let modalClickListener = null;
let keyboardListener = null;

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Safe DOM element getter
 */
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with id "${id}" not found`);
    }
    return element;
}

/**
 * Validate button element
 */
function validateButton(button) {
    if (!button || !(button instanceof HTMLElement)) {
        console.error('Invalid button element');
        return false;
    }
    return true;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Initialize the application
 */
function initializeApp() {
    // Check if we're editing an existing cheatsheet
    if (window.editData) {
        loadCheatsheetData(window.editData);
    } else {
        // Start with one empty section
        addSection();
    }

    // Save initial state to history
    setTimeout(() => {
        const initialState = collectEditorData();
        if (initialState) {
            historyStack.push(initialState);
            updateUndoRedoButtons();
        }
    }, 100);

    // Restore sidebar state
    restoreSidebarState();

    // Setup event listeners
    setupEventListeners();

    // Setup drag and drop
    setTimeout(setupDragAndDrop, 200);

    // Initialize auto-resize for textareas
    initAutoResize();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Keyboard shortcuts
    if (keyboardListener) {
        document.removeEventListener('keydown', keyboardListener);
    }
    keyboardListener = handleKeyboardShortcuts;
    document.addEventListener('keydown', keyboardListener);

    // Modal click listener
    const previewModal = safeGetElement('previewModal');
    if (previewModal) {
        if (modalClickListener) {
            previewModal.removeEventListener('click', modalClickListener);
        }
        modalClickListener = (e) => {
            if (e.target === e.currentTarget) {
                closePreview();
            }
        };
        previewModal.addEventListener('click', modalClickListener);
    }

    // Input change tracking for undo/redo
    document.addEventListener('input', handleInputChange);

    // Color picker preview
    const colorInput = safeGetElement('groupColor');
    const colorPreview = safeGetElement('colorPreview');
    if (colorInput && colorPreview) {
        colorInput.addEventListener('input', () => {
            colorPreview.style.background = colorInput.value;
        });
    }

    // Modal outside click handlers
    document.addEventListener('click', handleModalOutsideClick);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCheatsheet();
    }

    // Ctrl+G to toggle navigator
    if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        toggleNavigator();
    }

    // Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }

    // Ctrl+Y or Ctrl+Shift+Z for redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
    }

    // Escape to close modal or navigator
    if (e.key === 'Escape') {
        closePreview();
        closeImportModal();
        const navigator = safeGetElement('sectionNavigator');
        if (navigator && navigator.classList.contains('active')) {
            navigator.classList.remove('active');
        }
    }
}

/**
 * Handle input changes for undo/redo
 */
function handleInputChange(e) {
    if (e.target.matches('.title-input, .section-title-input, .subsection-title-input, .section-description-input, .command-editor, .comment-input, .text-input, .image-width-input') ||
        e.target.closest('.command-editor')) {
        saveToHistory();
    }
}

/**
 * Handle modal outside clicks
 */
function handleModalOutsideClick(e) {
    if (e.target.id === 'createGroupModal') {
        closeCreateGroupModal();
    }
    if (e.target.id === 'moveToGroupModal') {
        closeMoveToGroupModal();
    }
    if (e.target.id === 'importModal') {
        closeImportModal();
    }
}

/**
 * Restore sidebar state from localStorage
 */
function restoreSidebarState() {
    try {
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            const sidebar = safeGetElement('sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
            }
        }
    } catch (error) {
        console.error('Error restoring sidebar state:', error);
    }
}

/**
 * Load cheatsheet data into the editor
 */
function loadCheatsheetData(data) {
    if (!data) {
        console.error('No data provided to load');
        return;
    }

    currentCheatsheet.id = data.id;

    const titleInput = safeGetElement('cheatsheetTitle');
    if (titleInput) {
        titleInput.value = data.title || '';
    }

    // Clear existing sections
    const container = safeGetElement('sectionsContainer');
    if (!container) return;

    container.innerHTML = '';

    // Add sections from data
    if (data.sections && data.sections.length > 0) {
        data.sections.forEach((section, index) => {
            const sectionEl = createSectionElement(index + 1);
            if (!sectionEl) return;

            const sectionTitleInput = sectionEl.querySelector('.section-title-input');
            if (sectionTitleInput) {
                sectionTitleInput.value = section.title || '';
            }

            // Load description
            const descInput = sectionEl.querySelector('.section-description-input');
            if (descInput && section.description) {
                descInput.value = section.description;
            }

            // Load images (support both old 'image' and new 'images' format)
            const imagesContainer = sectionEl.querySelector('.images-container');
            if (imagesContainer) {
                let imagesToLoad = [];
                if (section.images && section.images.length > 0) {
                    imagesToLoad = section.images;
                } else if (section.image) {
                    imagesToLoad = [section.image];
                }
                imagesToLoad.forEach(imageData => {
                    loadImageToContainer(imagesContainer, imageData);
                });
            }

            // Add code lines
            const linesContainer = sectionEl.querySelector('.code-lines-container');
            if (linesContainer) {
                if (section.lines && section.lines.length > 0) {
                    section.lines.forEach(line => {
                        loadCodeLine(linesContainer, line);
                    });
                } else {
                    // Add one empty line
                    linesContainer.appendChild(createCodeLineElement());
                }
            }

            // Add subsections
            if (section.subsections && section.subsections.length > 0) {
                const subsectionsContainer = sectionEl.querySelector('.subsections-container');
                if (subsectionsContainer) {
                    section.subsections.forEach((subsection, subIndex) => {
                        loadSubsection(subsectionsContainer, subsection, index + 1, subIndex + 1);
                    });
                }
            }

            container.appendChild(sectionEl);
        });
    } else {
        addSection();
    }

    // Auto-resize text-input textareas after loading
    requestAnimationFrame(() => {
        document.querySelectorAll('.text-input').forEach(autoResizeTextarea);
    });
}

/**
 * Load an image to a container
 */
function loadImageToContainer(container, imageData) {
    const imageUpload = createImageUploadElement();
    if (!imageUpload) return;

    const previewContainer = imageUpload.querySelector('.image-preview-container');
    const preview = imageUpload.querySelector('.image-preview');
    const label = imageUpload.querySelector('.image-label');
    const widthInput = imageUpload.querySelector('.image-width-input');
    const widthSlider = imageUpload.querySelector('.image-width-slider');
    const fileInput = imageUpload.querySelector('.image-input');

    if (!preview || !previewContainer || !label || !fileInput) return;

    // Support both string (old format) and object (new format with dimensions)
    if (typeof imageData === 'string') {
        preview.src = imageData;
    } else {
        preview.src = imageData.src;
        if (imageData.widthPercent) {
            if (widthInput) widthInput.value = imageData.widthPercent;
            if (widthSlider) widthSlider.value = imageData.widthPercent;
        }
    }
    previewContainer.style.display = 'block';
    label.style.display = 'none';
    fileInput.style.display = 'none';
    container.appendChild(imageUpload);
}

/**
 * Load a code line into a container
 */
function loadCodeLine(container, line) {
    const lineEl = createCodeLineElement();
    if (!lineEl) return;

    const lineType = line.type || 'code';

    if (lineType === 'text') {
        // Set to text mode
        lineEl.dataset.lineType = 'text';
        const codeInputs = lineEl.querySelector('.code-inputs');
        const textInputs = lineEl.querySelector('.text-inputs');
        const textInput = lineEl.querySelector('.text-input');
        const codeBtns = lineEl.querySelectorAll('.type-btn');

        if (codeInputs) codeInputs.style.display = 'none';
        if (textInputs) textInputs.style.display = 'flex';
        if (textInput) {
            textInput.value = line.text || '';
        }

        codeBtns.forEach(btn => {
            if (btn.dataset.type === 'text') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    } else {
        const commandEditor = lineEl.querySelector('.command-editor');
        const commentInput = lineEl.querySelector('.comment-input');
        if (commandEditor && line.command) {
            // Convert syntax tags to HTML spans
            commandEditor.innerHTML = syntaxToHtml(line.command);
        }
        if (commentInput) commentInput.value = line.comment || '';
    }
    container.appendChild(lineEl);

    // Auto-resize text-input AFTER element is in DOM
    if (lineType === 'text') {
        const textInput = lineEl.querySelector('.text-input');
        if (textInput) {
            requestAnimationFrame(() => {
                autoResizeTextarea(textInput);
            });
        }
    }
}

/**
 * Load a subsection into a container
 */
function loadSubsection(container, subsection, sectionNum, subNum) {
    const subsectionEl = createSubsectionElement(sectionNum, subNum);
    if (!subsectionEl) return;

    const subTitleInput = subsectionEl.querySelector('.subsection-title-input');
    if (subTitleInput) {
        subTitleInput.value = subsection.title || '';
    }

    // Load subsection images
    const subImagesContainer = subsectionEl.querySelector('.images-container');
    if (subImagesContainer) {
        let subImagesToLoad = [];
        if (subsection.images && subsection.images.length > 0) {
            subImagesToLoad = subsection.images;
        } else if (subsection.image) {
            subImagesToLoad = [subsection.image];
        }
        subImagesToLoad.forEach(imageData => {
            loadImageToContainer(subImagesContainer, imageData);
        });
    }

    // Add subsection code lines
    const subLinesContainer = subsectionEl.querySelector('.code-lines-container');
    if (subLinesContainer) {
        if (subsection.lines && subsection.lines.length > 0) {
            subsection.lines.forEach(line => {
                loadCodeLine(subLinesContainer, line);
            });
        } else {
            subLinesContainer.appendChild(createCodeLineElement());
        }
    }

    container.appendChild(subsectionEl);
}

/**
 * Create a new section element
 * @param {number} number - Section number
 * @param {boolean} collapsed - Whether to start collapsed (default: true)
 */
function createSectionElement(number, collapsed = true) {
    const template = safeGetElement('sectionTemplate');
    if (!template || !template.content) {
        console.error('Section template not found');
        return null;
    }

    const clone = template.content.cloneNode(true);
    const section = clone.querySelector('.section-editor');
    if (!section) return null;

    section.dataset.sectionIndex = number;
    const badge = section.querySelector('.section-number-badge');
    if (badge) {
        badge.textContent = number;
    }

    // Sections are collapsed by default
    if (collapsed) {
        section.classList.add('collapsed');
    }

    return section;
}

/**
 * Create a new subsection element
 * @param {number} sectionNum - Section number
 * @param {number} subsectionNum - Subsection number
 * @param {boolean} collapsed - Whether to start collapsed (default: true)
 */
function createSubsectionElement(sectionNum, subsectionNum, collapsed = true) {
    const template = safeGetElement('subsectionTemplate');
    if (!template || !template.content) {
        console.error('Subsection template not found');
        return null;
    }

    const clone = template.content.cloneNode(true);
    const subsection = clone.querySelector('.subsection-editor');
    if (!subsection) return null;

    subsection.dataset.subsectionIndex = subsectionNum;
    const badge = subsection.querySelector('.subsection-number-badge');
    if (badge) {
        badge.textContent = `${sectionNum}.${subsectionNum}`;
    }

    // Subsections are collapsed by default
    if (collapsed) {
        subsection.classList.add('collapsed');
    }

    return subsection;
}

/**
 * Create a new code line element
 */
function createCodeLineElement() {
    const template = safeGetElement('codeLineTemplate');
    if (!template || !template.content) {
        console.error('Code line template not found');
        return null;
    }

    const clone = template.content.cloneNode(true);
    return clone.querySelector('.code-line-editor');
}

/**
 * Create a new image upload element
 */
function createImageUploadElement() {
    const template = safeGetElement('imageUploadTemplate');
    if (!template || !template.content) {
        console.error('Image upload template not found');
        return null;
    }

    const clone = template.content.cloneNode(true);
    return clone.querySelector('.image-upload-area');
}

/**
 * Add a new image slot to a section or subsection
 */
function addImageSlot(button) {
    if (!validateButton(button)) return;

    const container = button.closest('.section-extra-fields, .subsection-extra-fields');
    if (!container) return;

    const imagesContainer = container.querySelector('.images-container');
    if (!imagesContainer) return;

    const imageUpload = createImageUploadElement();
    if (!imageUpload) return;

    imagesContainer.appendChild(imageUpload);

    // Trigger file selection
    const fileInput = imageUpload.querySelector('.image-input');
    if (fileInput) {
        fileInput.click();
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Add a new section
 */
function addSection() {
    const container = safeGetElement('sectionsContainer');
    if (!container) return;

    const sectionCount = container.children.length + 1;

    // New sections are expanded so user can edit them
    const section = createSectionElement(sectionCount, false);
    if (!section) return;

    // Add one empty code line
    const linesContainer = section.querySelector('.code-lines-container');
    if (linesContainer) {
        const codeLine = createCodeLineElement();
        if (codeLine) {
            linesContainer.appendChild(codeLine);
        }
    }

    container.appendChild(section);

    // Setup drag and drop for new section
    initDragDrop(section, 'section-editor');

    // Focus on the section title
    const titleInput = section.querySelector('.section-title-input');
    if (titleInput) {
        titleInput.focus();
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Add a new subsection to a section
 */
function addSubsection(button) {
    if (!validateButton(button)) return;

    const section = button.closest('.section-editor');
    if (!section) return;

    const sectionNum = parseInt(section.dataset.sectionIndex);
    const subsectionsContainer = section.querySelector('.subsections-container');
    if (!subsectionsContainer) return;

    const subsectionCount = subsectionsContainer.children.length + 1;

    // New subsections are expanded so user can edit them
    const subsection = createSubsectionElement(sectionNum, subsectionCount, false);
    if (!subsection) return;

    // Add one empty code line
    const linesContainer = subsection.querySelector('.code-lines-container');
    if (linesContainer) {
        const codeLine = createCodeLineElement();
        if (codeLine) {
            linesContainer.appendChild(codeLine);
        }
    }

    subsectionsContainer.appendChild(subsection);

    // Setup drag and drop for new subsection
    initDragDrop(subsection, 'subsection-editor');

    // Focus on the subsection title
    const titleInput = subsection.querySelector('.subsection-title-input');
    if (titleInput) {
        titleInput.focus();
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Remove a section
 */
function removeSection(button) {
    if (!validateButton(button)) return;

    const section = button.closest('.section-editor');
    if (!section) return;

    const container = safeGetElement('sectionsContainer');
    if (!container) return;

    if (container.children.length > 1) {
        section.remove();
        updateSectionNumbers();
        saveToHistory();
    } else {
        alert('You must have at least one section.');
    }
}

/**
 * Remove a subsection
 */
function removeSubsection(button) {
    if (!validateButton(button)) return;

    const subsection = button.closest('.subsection-editor');
    if (!subsection) return;

    const section = subsection.closest('.section-editor');
    subsection.remove();
    
    if (section) {
        updateSubsectionNumbers(section);
    }
    saveToHistory();
}

/**
 * Update section numbers after removal
 */
function updateSectionNumbers() {
    const container = safeGetElement('sectionsContainer');
    if (!container) return;

    const sections = container.querySelectorAll('.section-editor');

    sections.forEach((section, index) => {
        const newNum = index + 1;
        section.dataset.sectionIndex = newNum;
        const badge = section.querySelector('.section-number-badge');
        if (badge) {
            badge.textContent = newNum;
        }

        // Update subsection numbers too
        updateSubsectionNumbers(section);
    });
}

/**
 * Update subsection numbers within a section
 */
function updateSubsectionNumbers(section) {
    if (!section) return;

    const sectionNum = section.dataset.sectionIndex;
    const subsections = section.querySelectorAll('.subsection-editor');

    subsections.forEach((subsection, index) => {
        const newSubNum = index + 1;
        subsection.dataset.subsectionIndex = newSubNum;
        const badge = subsection.querySelector('.subsection-number-badge');
        if (badge) {
            badge.textContent = `${sectionNum}.${newSubNum}`;
        }
    });
}

/**
 * Add a new code line to a section or subsection
 */
function addCodeLine(button) {
    if (!validateButton(button)) return;

    const container = button.closest('.section-editor, .subsection-editor');
    if (!container) return;

    const linesContainer = container.querySelector('.code-lines-container');
    if (!linesContainer) return;

    const newLine = createCodeLineElement();
    if (!newLine) return;

    linesContainer.appendChild(newLine);

    // Setup drag and drop for new line
    initDragDrop(newLine, 'code-line-editor');

    // Focus on the command editor
    const commandEditor = newLine.querySelector('.command-editor');
    if (commandEditor) {
        commandEditor.focus();
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Remove a code line
 */
function removeCodeLine(button) {
    if (!validateButton(button)) return;

    const line = button.closest('.code-line-editor');
    if (!line) return;

    const container = line.closest('.code-lines-container');
    if (!container) return;

    if (container.children.length > 1) {
        line.remove();
        saveToHistory();
    } else {
        // Clear the inputs instead of removing the last line
        const commandEditor = line.querySelector('.command-editor');
        const commentInput = line.querySelector('.comment-input');
        const textInput = line.querySelector('.text-input');

        if (commandEditor) commandEditor.innerHTML = '';
        if (commentInput) commentInput.value = '';
        if (textInput) textInput.value = '';
        
        saveToHistory();
    }
}

/**
 * Insert a colored span at cursor position in contenteditable
 */
function insertSyntaxSpan(button, type) {
    if (!validateButton(button)) return;

    const wrapper = button.closest('.command-input-wrapper');
    if (!wrapper) return;

    const editor = wrapper.querySelector('.command-editor');
    if (!editor) return;

    // Focus the editor
    editor.focus();

    // Get current selection
    const selection = window.getSelection();
    const selectedText = selection.toString();

    // Create the span element
    const span = document.createElement('span');
    span.className = `hl-${type}`;
    span.setAttribute('data-syntax', type);

    if (type === 'comment') {
        span.textContent = selectedText ? `# ${selectedText}` : '# ';
    } else {
        span.textContent = selectedText || type;
    }

    // Insert the span
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Check if selection is within our editor
        if (editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer) {
            range.deleteContents();
            range.insertNode(span);

            // Move cursor after the span
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // If not in editor, append to end
            editor.appendChild(span);
        }
    } else {
        editor.appendChild(span);
    }

    // If no text was selected, select the placeholder text
    if (!selectedText && type !== 'comment') {
        const range = document.createRange();
        range.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Auto-resize textarea to fit content (for text-input only now)
 */
function autoResizeTextarea(textarea) {
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Set the height to scrollHeight, but respect min/max
    const minHeight = 38;
    const maxHeight = 200;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = newHeight + 'px';
}

/**
 * Convert syntax tags to HTML spans for display
 * {method:text} -> <span class="hl-method" data-syntax="method">text</span>
 */
function syntaxToHtml(text) {
    if (!text) return '';

    // Escape HTML first to prevent XSS (except our syntax tags)
    let result = text;

    // Replace {method:...} with highlighted span
    result = result.replace(/\{method:([^}]+)\}/g, '<span class="hl-method" data-syntax="method">$1</span>');

    // Replace {param:...} with highlighted span
    result = result.replace(/\{param:([^}]+)\}/g, '<span class="hl-param" data-syntax="param">$1</span>');

    // Replace {str:...} with highlighted span
    result = result.replace(/\{str:([^}]+)\}/g, '<span class="hl-str" data-syntax="str">$1</span>');

    // Highlight inline comments (# ...) - wrap in span
    result = result.replace(/(^|\s)(#[^\n]*)$/gm, '$1<span class="hl-comment" data-syntax="comment">$2</span>');

    return result;
}

/**
 * Convert HTML spans back to syntax tags for storage
 * <span class="hl-method" data-syntax="method">text</span> -> {method:text}
 */
function htmlToSyntax(editor) {
    if (!editor) return '';

    // Clone the editor to work with
    const clone = editor.cloneNode(true);

    // Process all syntax spans
    clone.querySelectorAll('[data-syntax]').forEach(span => {
        const type = span.getAttribute('data-syntax');
        const text = span.textContent;

        if (type === 'comment') {
            // Comments just keep their text (already has #)
            span.replaceWith(text);
        } else {
            // Wrap in syntax tags
            span.replaceWith(`{${type}:${text}}`);
        }
    });

    // Get the text content (preserves structure)
    return clone.textContent || '';
}

/**
 * Get plain text from command editor for copying
 */
function getEditorPlainText(editor) {
    if (!editor) return '';
    return editor.textContent || '';
}

/**
 * Initialize auto-resize for all textareas
 */
function initAutoResize() {
    // Add input event listener to auto-resize text-input textareas
    document.addEventListener('input', function(e) {
        if (e.target.matches('.text-input')) {
            autoResizeTextarea(e.target);
        }
        // Track changes in command-editor for history
        if (e.target.matches('.command-editor') || e.target.closest('.command-editor')) {
            saveToHistory();
        }
    });

    // Add selection change listener to highlight syntax buttons
    document.addEventListener('selectionchange', updateSyntaxButtonHighlight);

    // Handle space key to exit colored spans
    document.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            const editor = e.target.closest('.command-editor');
            if (editor) {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const container = range.startContainer;

                    // Check if we're inside a syntax span
                    const syntaxSpan = container.nodeType === Node.TEXT_NODE
                        ? container.parentElement.closest('[data-syntax]')
                        : container.closest('[data-syntax]');

                    if (syntaxSpan && syntaxSpan.parentElement === editor) {
                        // Check if cursor is at the end of the span
                        const isAtEnd = range.startOffset === (container.textContent || '').length;

                        if (isAtEnd) {
                            e.preventDefault();

                            // Insert a space after the span as a text node
                            const spaceNode = document.createTextNode('\u00A0'); // Non-breaking space that will be converted
                            syntaxSpan.after(spaceNode);

                            // Move cursor after the space
                            range.setStartAfter(spaceNode);
                            range.setEndAfter(spaceNode);
                            selection.removeAllRanges();
                            selection.addRange(range);

                            // Replace with regular space
                            spaceNode.textContent = ' ';

                            saveToHistory();
                        }
                    }
                }
            }
        }
    });

    // Initial resize for existing textareas
    document.querySelectorAll('.text-input').forEach(autoResizeTextarea);
}

/**
 * Update syntax button highlighting based on cursor position
 */
function updateSyntaxButtonHighlight() {
    // Clear all active states first
    document.querySelectorAll('.syntax-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    // Find the command-editor we're in
    const editor = container.nodeType === Node.TEXT_NODE
        ? container.parentElement.closest('.command-editor')
        : container.closest('.command-editor');

    if (!editor) return;

    // Find the syntax span we're inside
    const syntaxSpan = container.nodeType === Node.TEXT_NODE
        ? container.parentElement.closest('[data-syntax]')
        : container.closest('[data-syntax]');

    if (!syntaxSpan) return;

    const syntaxType = syntaxSpan.getAttribute('data-syntax');
    if (!syntaxType) return;

    // Find the corresponding button in the same code-line-editor
    const codeLineEditor = editor.closest('.code-line-editor');
    if (!codeLineEditor) return;

    const syntaxBtn = codeLineEditor.querySelector(`.syntax-btn[data-syntax-type="${syntaxType}"]`);
    if (syntaxBtn) {
        syntaxBtn.classList.add('active');
    }
}

/**
 * Set line type (code or text)
 */
function setLineType(button, type) {
    if (!validateButton(button)) return;

    const lineEditor = button.closest('.code-line-editor');
    if (!lineEditor) return;

    const codeInputs = lineEditor.querySelector('.code-inputs');
    const textInputs = lineEditor.querySelector('.text-inputs');
    const toggleBtns = lineEditor.querySelectorAll('.type-btn');

    // Update active button
    toggleBtns.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update data attribute
    lineEditor.dataset.lineType = type;

    // Show/hide appropriate inputs
    if (type === 'text') {
        if (codeInputs) codeInputs.style.display = 'none';
        if (textInputs) textInputs.style.display = 'flex';
    } else {
        if (codeInputs) codeInputs.style.display = 'flex';
        if (textInputs) textInputs.style.display = 'none';
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Get or generate a temporary cheatsheet ID for image uploads
 */
function getCheatsheetIdForUpload() {
    // If we have an existing ID, use it
    if (currentCheatsheet.id) {
        return currentCheatsheet.id;
    }

    // Generate a temporary ID based on the title or a random string
    const titleInput = safeGetElement('cheatsheetTitle');
    const title = titleInput ? titleInput.value.trim() : '';

    if (title) {
        // Generate ID similar to backend logic
        const cleanTitle = title.toLowerCase()
            .replace(/[^a-zA-Z0-9\s_-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);
        const hash = Math.random().toString(36).substring(2, 8);
        currentCheatsheet.id = cleanTitle ? `${cleanTitle}_${hash}` : hash;
    } else {
        // Generate a completely random ID
        currentCheatsheet.id = 'temp_' + Math.random().toString(36).substring(2, 10);
    }

    return currentCheatsheet.id;
}

/**
 * Handle image upload - uploads to server and shows preview
 */
function handleImageUpload(input) {
    if (!input || !input.files) return;

    const file = input.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB.');
        return;
    }

    const uploadArea = input.closest('.image-upload-area');
    if (!uploadArea) return;

    const previewContainer = uploadArea.querySelector('.image-preview-container');
    const preview = uploadArea.querySelector('.image-preview');
    const label = uploadArea.querySelector('.image-label');

    if (!preview || !previewContainer || !label) return;

    // Show loading state
    label.textContent = 'Uploading...';

    // Get or generate cheatsheet ID
    const cheatsheetId = getCheatsheetIdForUpload();

    // Upload to server
    const formData = new FormData();
    formData.append('file', file);

    fetch(`/api/cheatsheet/${cheatsheetId}/image`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.url) {
            // Set the image URL (not base64)
            preview.src = data.url;
            preview.dataset.imageUrl = data.url;  // Store URL in data attribute
            previewContainer.style.display = 'block';
            label.style.display = 'none';
            input.style.display = 'none';

            // Save to history for undo/redo
            saveToHistory();
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    })
    .catch(error => {
        console.error('Image upload error:', error);
        alert('Error uploading image: ' + error.message);
        label.textContent = 'Click or drag to upload image';
        label.style.display = 'block';
    });
}

/**
 * Remove an image
 */
function removeImage(button) {
    if (!validateButton(button)) return;

    const uploadArea = button.closest('.image-upload-area');
    if (!uploadArea) return;

    const previewContainer = uploadArea.querySelector('.image-preview-container');
    const preview = uploadArea.querySelector('.image-preview');
    const label = uploadArea.querySelector('.image-label');
    const input = uploadArea.querySelector('.image-input');

    if (preview) preview.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (label) label.style.display = 'block';
    if (input) {
        input.value = '';
        input.style.display = 'block';
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Sync image size between slider and number input
 */
function syncImageSize(element, source) {
    const uploadArea = element.closest('.image-upload-area');
    if (!uploadArea) return;

    const slider = uploadArea.querySelector('.image-width-slider');
    const input = uploadArea.querySelector('.image-width-input');

    if (source === 'slider' && slider && input) {
        input.value = slider.value;
    } else if (source === 'input' && slider && input) {
        slider.value = input.value;
    }

    // Save to history for undo/redo
    saveToHistory();
}

/**
 * Collect data from the editor
 */
function collectEditorData() {
    const titleInput = safeGetElement('cheatsheetTitle');
    const sectionsContainer = safeGetElement('sectionsContainer');
    
    if (!titleInput || !sectionsContainer) {
        console.error('Required elements not found');
        return null;
    }

    const title = titleInput.value.trim();
    const sectionElements = sectionsContainer.querySelectorAll('.section-editor');

    const sections = [];

    sectionElements.forEach(sectionEl => {
        const sectionTitleInput = sectionEl.querySelector('.section-title-input');
        const sectionDescInput = sectionEl.querySelector('.section-description-input');
        
        const sectionTitle = sectionTitleInput ? sectionTitleInput.value.trim() : '';
        const sectionDescription = sectionDescInput ? sectionDescInput.value.trim() : '';

        // Collect all images from section (with percentage width)
        const sectionImages = [];
        const sectionImageAreas = sectionEl.querySelectorAll('.section-extra-fields .images-container .image-upload-area');
        sectionImageAreas.forEach(area => {
            const preview = area.querySelector('.image-preview');
            const widthInput = area.querySelector('.image-width-input');
            // Accept both base64 (data:image) and server URLs (/images/)
            if (preview && preview.src && (preview.src.startsWith('data:image') || preview.src.includes('/images/'))) {
                // Use the URL path for server images, or full src for base64
                let imageSrc = preview.src;
                if (preview.src.includes('/images/')) {
                    // Extract the path from full URL (e.g., http://localhost:5000/images/... -> /images/...)
                    const url = new URL(preview.src);
                    imageSrc = url.pathname;
                }
                const imageData = { src: imageSrc };
                if (widthInput && widthInput.value) {
                    imageData.widthPercent = parseInt(widthInput.value);
                }
                sectionImages.push(imageData);
            }
        });

        const lineElements = sectionEl.querySelectorAll(':scope > .section-editor-content > .code-lines-container > .code-line-editor');

        const lines = [];
        lineElements.forEach(lineEl => {
            const lineType = lineEl.dataset.lineType || 'code';

            if (lineType === 'text') {
                const textInput = lineEl.querySelector('.text-input');
                const text = textInput ? textInput.value.trim() : '';
                if (text) {
                    lines.push({ type: 'text', text: text });
                }
            } else {
                const commandEditor = lineEl.querySelector('.command-editor');
                const commentInput = lineEl.querySelector('.comment-input');
                const command = commandEditor ? htmlToSyntax(commandEditor).trim() : '';
                const comment = commentInput ? commentInput.value.trim() : '';
                if (command || comment) {
                    lines.push({ type: 'code', command, comment });
                }
            }
        });

        // Collect subsections
        const subsections = [];
        const subsectionElements = sectionEl.querySelectorAll('.subsection-editor');
        subsectionElements.forEach(subEl => {
            const subTitleInput = subEl.querySelector('.subsection-title-input');
            const subTitle = subTitleInput ? subTitleInput.value.trim() : '';

            // Collect all images from subsection (with percentage width)
            const subImages = [];
            const subImageAreas = subEl.querySelectorAll('.images-container .image-upload-area');
            subImageAreas.forEach(area => {
                const preview = area.querySelector('.image-preview');
                const widthInput = area.querySelector('.image-width-input');
                // Accept both base64 (data:image) and server URLs (/images/)
                if (preview && preview.src && (preview.src.startsWith('data:image') || preview.src.includes('/images/'))) {
                    // Use the URL path for server images, or full src for base64
                    let imageSrc = preview.src;
                    if (preview.src.includes('/images/')) {
                        // Extract the path from full URL
                        const url = new URL(preview.src);
                        imageSrc = url.pathname;
                    }
                    const imageData = { src: imageSrc };
                    if (widthInput && widthInput.value) {
                        imageData.widthPercent = parseInt(widthInput.value);
                    }
                    subImages.push(imageData);
                }
            });

            const subLineElements = subEl.querySelectorAll('.code-line-editor');

            const subLines = [];
            subLineElements.forEach(lineEl => {
                const lineType = lineEl.dataset.lineType || 'code';

                if (lineType === 'text') {
                    const textInput = lineEl.querySelector('.text-input');
                    const text = textInput ? textInput.value.trim() : '';
                    if (text) {
                        subLines.push({ type: 'text', text: text });
                    }
                } else {
                    const commandEditor = lineEl.querySelector('.command-editor');
                    const commentInput = lineEl.querySelector('.comment-input');
                    const command = commandEditor ? htmlToSyntax(commandEditor).trim() : '';
                    const comment = commentInput ? commentInput.value.trim() : '';
                    if (command || comment) {
                        subLines.push({ type: 'code', command, comment });
                    }
                }
            });

            if (subTitle || subLines.length > 0) {
                const subsectionData = {
                    title: subTitle,
                    lines: subLines
                };
                // Only add images if there are any
                if (subImages.length > 0) {
                    subsectionData.images = subImages;
                }
                subsections.push(subsectionData);
            }
        });

        if (sectionTitle || lines.length > 0 || subsections.length > 0) {
            const sectionData = {
                title: sectionTitle,
                lines: lines
            };
            // Only add description if not empty
            if (sectionDescription) {
                sectionData.description = sectionDescription;
            }
            // Only add images if there are any
            if (sectionImages.length > 0) {
                sectionData.images = sectionImages;
            }
            // Only add subsections if there are any
            if (subsections.length > 0) {
                sectionData.subsections = subsections;
            }
            sections.push(sectionData);
        }
    });

    return {
        id: currentCheatsheet.id,
        title: title || 'Untitled Cheatsheet',
        sections: sections
    };
}

/**
 * Save the cheatsheet (auto-save without page reload)
 */
async function saveCheatsheet() {
    const data = collectEditorData();
    if (!data) {
        showNotification('Error collecting cheatsheet data', 'error');
        return;
    }

    if (data.sections.length === 0) {
        alert('Please add at least one section with content.');
        return;
    }

    try {
        const response = await fetch('/api/cheatsheet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            currentCheatsheet.id = result.id;
            showNotification('Cheatsheet saved successfully!', 'success');
            updateSidebarList(result.id, data.title);
        } else {
            showNotification('Error saving: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error saving cheatsheet:', error);
        showNotification('Error saving cheatsheet. Please try again.', 'error');
    }
}

/**
 * Show a notification message
 */
function showNotification(message, type = 'success') {
    if (!message) return;

    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Update sidebar list after save
 */
function updateSidebarList(id, title) {
    if (!id || !title) return;

    const list = safeGetElement('cheatsheetList');
    if (!list) return;

    let item = list.querySelector(`.cheatsheet-item[data-id="${id}"]`);

    if (item) {
        // Update existing item
        const nameEl = item.querySelector('.cheatsheet-name');
        if (nameEl) {
            nameEl.textContent = title;
            nameEl.title = title;
        }
    } else {
        // Add new item
        const li = document.createElement('li');
        li.className = 'cheatsheet-item';
        li.dataset.id = id;
        
        const escapedTitle = escapeHtml(title);
        const escapedId = escapeHtml(id);
        
        li.innerHTML = `
            <span class="cheatsheet-name" title="${escapedTitle}">${escapedTitle}</span>
            <div class="cheatsheet-actions">
                <button onclick="loadCheatsheet('${escapedId}')" title="Edit">✏️</button>
                <button onclick="previewCheatsheet('${escapedId}')" title="Preview">👁️</button>
                <button onclick="previewFullscreen('${escapedId}')" title="Open in new tab">🔳</button>
                <button onclick="printToPdf('${escapedId}')" title="Print / PDF">🖨️</button>
                <button onclick="downloadCheatsheet('${escapedId}')" title="Download HTML">⬇️</button>
                <button onclick="downloadJsonCheatsheet('${escapedId}')" title="Download JSON">{ }</button>
                <button onclick="deleteCheatsheet('${escapedId}')" title="Delete">🗑️</button>
                <button onclick="moveToGroup('${escapedId}')" title="Move to Group">📁</button>
            </div>
        `;
        list.insertBefore(li, list.firstChild);
    }
}

/**
 * Create a new cheatsheet
 */
function newCheatsheet() {
    if (confirm('Start a new cheatsheet? Any unsaved changes will be lost.')) {
        currentCheatsheet = { id: null, title: '', sections: [] };
        
        const titleInput = safeGetElement('cheatsheetTitle');
        const container = safeGetElement('sectionsContainer');
        
        if (titleInput) titleInput.value = '';
        if (container) container.innerHTML = '';
        
        addSection();
    }
}

/**
 * Load a cheatsheet for editing
 */
async function loadCheatsheet(id) {
    if (!id) return;

    try {
        const response = await fetch(`/api/cheatsheet/${encodeURIComponent(id)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            alert('Error loading cheatsheet: ' + data.error);
            return;
        }

        loadCheatsheetData(data);
    } catch (error) {
        console.error('Error loading cheatsheet:', error);
        alert('Error loading cheatsheet. Please try again.');
    }
}

/**
 * Preview a cheatsheet in modal
 */
function previewCheatsheet(id) {
    if (!id) return;

    const modal = safeGetElement('previewModal');
    const iframe = safeGetElement('previewFrame');

    if (!modal || !iframe) return;

    iframe.src = `/preview/${encodeURIComponent(id)}`;
    modal.classList.add('active');
}

/**
 * Preview a cheatsheet in a new tab (fullscreen)
 */
function previewFullscreen(id) {
    if (!id) return;
    window.open(`/preview/${encodeURIComponent(id)}`, '_blank');
}

/**
 * Preview the current cheatsheet (unsaved)
 */
async function previewCurrent() {
    const data = collectEditorData();
    if (!data) {
        showNotification('Error collecting cheatsheet data', 'error');
        return;
    }

    if (data.sections.length === 0) {
        alert('Please add at least one section with content to preview.');
        return;
    }

    try {
        const response = await fetch('/api/cheatsheet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            currentCheatsheet.id = result.id;
            previewCheatsheet(result.id);
        } else {
            alert('Error generating preview: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error generating preview:', error);
        alert('Error generating preview. Please try again.');
    }
}

/**
 * Close the preview modal
 */
function closePreview() {
    const modal = safeGetElement('previewModal');
    const iframe = safeGetElement('previewFrame');

    if (modal) modal.classList.remove('active');
    if (iframe) iframe.src = '';
}

/**
 * Download a cheatsheet as HTML
 */
function downloadCheatsheet(id) {
    if (!id) return;
    window.location.href = `/download/${encodeURIComponent(id)}`;
}

/**
 * Download a cheatsheet as JSON
 */
function downloadJsonCheatsheet(id) {
    if (!id) return;
    window.location.href = `/download-json/${encodeURIComponent(id)}`;
}

/**
 * Delete a cheatsheet
 */
async function deleteCheatsheet(id) {
    if (!id) return;

    if (!confirm('Are you sure you want to delete this cheatsheet?')) {
        return;
    }

    try {
        const response = await fetch(`/api/cheatsheet/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Remove from list
            const item = document.querySelector(`.cheatsheet-item[data-id="${id}"]`);
            if (item) {
                item.remove();
            }

            // If we're editing this cheatsheet, start a new one
            if (currentCheatsheet.id === id) {
                newCheatsheet();
            }
            
            showNotification('Cheatsheet deleted successfully', 'success');
        } else {
            alert('Error deleting cheatsheet: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting cheatsheet:', error);
        alert('Error deleting cheatsheet. Please try again.');
    }
}

/**
 * Toggle sidebar expanded/collapsed
 */
function toggleSidebar() {
    const sidebar = safeGetElement('sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed');

    // Save state to localStorage
    try {
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    } catch (error) {
        console.error('Error saving sidebar state:', error);
    }
}

/**
 * Toggle section navigator panel
 */
function toggleNavigator() {
    const navigator = safeGetElement('sectionNavigator');
    if (!navigator) return;

    navigator.classList.toggle('active');

    if (navigator.classList.contains('active')) {
        updateNavigator();
    }
}

/**
 * Update the section navigator list
 */
function updateNavigator() {
    const navList = safeGetElement('navList');
    if (!navList) return;

    const sections = document.querySelectorAll('.section-editor');

    navList.innerHTML = '';

    sections.forEach((section, index) => {
        const sectionNum = index + 1;
        const titleInput = section.querySelector('.section-title-input');
        const title = titleInput ? titleInput.value || `Section ${sectionNum}` : `Section ${sectionNum}`;
        const subsections = section.querySelectorAll('.subsection-editor');
        const hasSubsections = subsections.length > 0;

        // Create section item
        const li = document.createElement('li');
        li.className = 'nav-section' + (hasSubsections ? ' has-subsections' : '');
        li.dataset.sectionIndex = index;

        // Add minimalist toggle button if has subsections (default collapsed)
        const toggleBtn = hasSubsections ? `<button class="nav-toggle" onclick="event.stopPropagation(); toggleNavSection(this)">+</button>` : '';

        li.innerHTML = `${toggleBtn}<span class="nav-num">${sectionNum}</span><span class="nav-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>`;
        li.onclick = () => scrollToSection(index);
        navList.appendChild(li);

        // Add subsections container (collapsed by default)
        if (hasSubsections) {
            const subContainer = document.createElement('ul');
            subContainer.className = 'nav-subsections collapsed';

            subsections.forEach((subsection, subIndex) => {
                const subNum = `${sectionNum}.${subIndex + 1}`;
                const subTitleInput = subsection.querySelector('.subsection-title-input');
                const subTitle = subTitleInput ? subTitleInput.value || `Subsection ${subNum}` : `Subsection ${subNum}`;
                const subLi = document.createElement('li');
                subLi.className = 'nav-subsection';
                subLi.innerHTML = `<span class="nav-num">${subNum}</span><span class="nav-title" title="${escapeHtml(subTitle)}">${escapeHtml(subTitle)}</span>`;
                subLi.onclick = (e) => { e.stopPropagation(); scrollToSubsection(index, subIndex); };
                subContainer.appendChild(subLi);
            });

            navList.appendChild(subContainer);
        }
    });
}

/**
 * Toggle a section's subsections in the navigator
 */
function toggleNavSection(button) {
    if (!validateButton(button)) return;

    const sectionLi = button.closest('.nav-section');
    if (!sectionLi) return;

    const subContainer = sectionLi.nextElementSibling;

    if (subContainer && subContainer.classList.contains('nav-subsections')) {
        subContainer.classList.toggle('collapsed');
        button.textContent = subContainer.classList.contains('collapsed') ? '+' : '−';
    }
}

/**
 * Scroll to a section in the editor
 */
function scrollToSection(index) {
    const sections = document.querySelectorAll('.section-editor');
    if (sections[index]) {
        // Unfold the section if it's collapsed
        sections[index].classList.remove('collapsed');
        sections[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
        const titleInput = sections[index].querySelector('.section-title-input');
        if (titleInput) {
            titleInput.focus();
        }
    }
}

/**
 * Scroll to a subsection in the editor
 */
function scrollToSubsection(sectionIndex, subsectionIndex) {
    const sections = document.querySelectorAll('.section-editor');
    if (sections[sectionIndex]) {
        // Unfold the parent section if it's collapsed
        sections[sectionIndex].classList.remove('collapsed');
        const subsections = sections[sectionIndex].querySelectorAll('.subsection-editor');
        if (subsections[subsectionIndex]) {
            // Unfold the subsection if it's collapsed
            subsections[subsectionIndex].classList.remove('collapsed');
            subsections[subsectionIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            const titleInput = subsections[subsectionIndex].querySelector('.subsection-title-input');
            if (titleInput) {
                titleInput.focus();
            }
        }
    }
}

/**
 * Save current state to history (debounced)
 */
function saveToHistory() {
    if (isUndoRedoAction) return;

    if (saveHistoryTimeout) {
        clearTimeout(saveHistoryTimeout);
    }
    
    saveHistoryTimeout = setTimeout(() => {
        const state = collectEditorData();
        if (!state) return;

        const stateStr = JSON.stringify(state);

        // Don't save if same as last state
        if (historyStack.length > 0 && JSON.stringify(historyStack[historyStack.length - 1]) === stateStr) {
            return;
        }

        historyStack.push(state);
        if (historyStack.length > MAX_HISTORY) {
            historyStack.shift();
        }

        // Clear redo stack on new change
        redoStack.length = 0;

        updateUndoRedoButtons();
    }, 300);
}

/**
 * Undo last change
 */
function undo() {
    if (historyStack.length <= 1) return;

    isUndoRedoAction = true;

    try {
        // Save current state to redo stack
        const currentState = collectEditorData();
        if (currentState) {
            redoStack.push(currentState);
        }

        // Pop current state and restore previous
        historyStack.pop();
        const previousState = historyStack[historyStack.length - 1];

        if (previousState) {
            loadCheatsheetData(previousState);
        }

        updateUndoRedoButtons();
    } finally {
        isUndoRedoAction = false;
    }
}

/**
 * Redo last undone change
 */
function redo() {
    if (redoStack.length === 0) return;

    isUndoRedoAction = true;

    try {
        const nextState = redoStack.pop();
        if (nextState) {
            historyStack.push(nextState);
            loadCheatsheetData(nextState);
        }

        updateUndoRedoButtons();
    } finally {
        isUndoRedoAction = false;
    }
}

/**
 * Update undo/redo button states
 */
function updateUndoRedoButtons() {
    const undoBtn = document.querySelector('.btn-undo');
    const redoBtn = document.querySelector('.btn-redo');

    if (undoBtn) {
        undoBtn.disabled = historyStack.length <= 1;
    }
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
    }
}

/**
 * Toggle a section collapsed/expanded in the editor
 */
function toggleSectionEditor(button) {
    if (!validateButton(button)) return;

    const section = button.closest('.section-editor');
    if (section) {
        section.classList.toggle('collapsed');
    }
}

/**
 * Toggle a subsection collapsed/expanded in the editor
 */
function toggleSubsectionEditor(button) {
    if (!validateButton(button)) return;

    const subsection = button.closest('.subsection-editor');
    if (subsection) {
        subsection.classList.toggle('collapsed');
    }
}

/**
 * Fold all sections in the editor
 */
function foldAllSections() {
    document.querySelectorAll('.section-editor').forEach(section => {
        section.classList.add('collapsed');
    });
}

/**
 * Unfold all sections in the editor
 */
function unfoldAllSections() {
    document.querySelectorAll('.section-editor').forEach(section => {
        section.classList.remove('collapsed');
    });
}

/**
 * Open print dialog for a cheatsheet (for PDF export)
 */
function printToPdf(id) {
    if (!id) return;

    const printWindow = window.open(`/preview/${encodeURIComponent(id)}`, '_blank');
    if (printWindow) {
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };
    }
}

// ==============================================
// DRAG AND DROP FUNCTIONALITY
// ==============================================

let draggedElement = null;
let draggedType = null;

/**
 * Initialize drag and drop for an element
 */
function initDragDrop(element, type) {
    if (!element || !type) return;

    element.setAttribute('draggable', 'true');
    element.classList.add('draggable');

    element.addEventListener('dragstart', (e) => {
        draggedElement = element;
        draggedType = type;
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedElement = null;
        draggedType = null;
    });

    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedElement || draggedElement === element) return;

        // Only allow dropping on same type containers
        const draggedParent = draggedElement.parentElement;
        const targetParent = element.parentElement;
        if (draggedParent !== targetParent) return;

        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');

        if (!draggedElement || draggedElement === element) return;

        const parent = element.parentElement;
        const draggedParent = draggedElement.parentElement;
        if (parent !== draggedParent) return;

        // Get positions
        const children = Array.from(parent.children).filter(c => c.classList.contains(draggedType));
        const draggedIndex = children.indexOf(draggedElement);
        const targetIndex = children.indexOf(element);

        if (draggedIndex === -1 || targetIndex === -1) return;

        if (draggedIndex < targetIndex) {
            parent.insertBefore(draggedElement, element.nextSibling);
        } else {
            parent.insertBefore(draggedElement, element);
        }

        // Update numbers and save history
        if (draggedType === 'section-editor') {
            updateSectionNumbers();
        } else if (draggedType === 'subsection-editor') {
            updateSubsectionNumbers(parent.closest('.section-editor'));
        }
        saveToHistory();
    });
}

/**
 * Setup drag and drop on page load and when elements are created
 */
function setupDragAndDrop() {
    // Sections
    document.querySelectorAll('.section-editor').forEach(el => {
        if (!el.hasAttribute('draggable')) {
            initDragDrop(el, 'section-editor');
        }
    });

    // Subsections
    document.querySelectorAll('.subsection-editor').forEach(el => {
        if (!el.hasAttribute('draggable')) {
            initDragDrop(el, 'subsection-editor');
        }
    });

    // Code lines
    document.querySelectorAll('.code-line-editor').forEach(el => {
        if (!el.hasAttribute('draggable')) {
            initDragDrop(el, 'code-line-editor');
        }
    });
}

/**
 * Initialize drag and drop observer
 */
function initDragObserver() {
    const container = safeGetElement('sectionsContainer');
    if (!container) return;

    // Clean up existing observer
    if (dragObserver) {
        dragObserver.disconnect();
    }

    dragObserver = new MutationObserver(() => {
        setupDragAndDrop();
    });

    dragObserver.observe(container, {
        childList: true,
        subtree: true
    });
}

// Initialize drag observer on load
document.addEventListener('DOMContentLoaded', () => {
    initDragObserver();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (dragObserver) {
        dragObserver.disconnect();
    }
    if (saveHistoryTimeout) {
        clearTimeout(saveHistoryTimeout);
    }
});

// ==============================================
// INSERT BETWEEN FUNCTIONALITY
// ==============================================

/**
 * Insert a new section before another section
 */
function insertSectionBefore(button) {
    if (!validateButton(button)) return;

    const targetSection = button.closest('.section-editor');
    if (!targetSection) return;

    const container = safeGetElement('sectionsContainer');
    if (!container) return;

    const sectionCount = container.children.length + 1;

    // New sections are expanded so user can edit them
    const newSection = createSectionElement(sectionCount, false);
    if (!newSection) return;

    const linesContainer = newSection.querySelector('.code-lines-container');
    if (linesContainer) {
        const codeLine = createCodeLineElement();
        if (codeLine) {
            linesContainer.appendChild(codeLine);
        }
    }

    container.insertBefore(newSection, targetSection);
    initDragDrop(newSection, 'section-editor');
    updateSectionNumbers();
    
    const titleInput = newSection.querySelector('.section-title-input');
    if (titleInput) {
        titleInput.focus();
    }
    
    saveToHistory();
}

/**
 * Insert a new subsection before another subsection
 */
function insertSubsectionBefore(button) {
    if (!validateButton(button)) return;

    const targetSubsection = button.closest('.subsection-editor');
    if (!targetSubsection) return;

    const section = targetSubsection.closest('.section-editor');
    if (!section) return;

    const sectionNum = parseInt(section.dataset.sectionIndex);
    const subsectionsContainer = section.querySelector('.subsections-container');
    if (!subsectionsContainer) return;

    const subsectionCount = subsectionsContainer.children.length + 1;

    // New subsections are expanded so user can edit them
    const newSubsection = createSubsectionElement(sectionNum, subsectionCount, false);
    if (!newSubsection) return;

    const linesContainer = newSubsection.querySelector('.code-lines-container');
    if (linesContainer) {
        const codeLine = createCodeLineElement();
        if (codeLine) {
            linesContainer.appendChild(codeLine);
        }
    }

    subsectionsContainer.insertBefore(newSubsection, targetSubsection);
    initDragDrop(newSubsection, 'subsection-editor');
    updateSubsectionNumbers(section);
    
    const titleInput = newSubsection.querySelector('.subsection-title-input');
    if (titleInput) {
        titleInput.focus();
    }
    
    saveToHistory();
}

/**
 * Insert a new code line before another code line
 */
function insertCodeLineBefore(button) {
    if (!validateButton(button)) return;

    const targetLine = button.closest('.code-line-editor');
    if (!targetLine) return;

    const container = targetLine.closest('.code-lines-container');
    if (!container) return;

    const newLine = createCodeLineElement();
    if (!newLine) return;

    container.insertBefore(newLine, targetLine);
    initDragDrop(newLine, 'code-line-editor');

    const commandEditor = newLine.querySelector('.command-editor');
    if (commandEditor) {
        commandEditor.focus();
    }

    saveToHistory();
}

// ==============================================
// GROUPS FUNCTIONALITY
// ==============================================

let currentMoveCheatsheetId = null;

/**
 * Toggle group collapsed/expanded
 */
function toggleGroup(header) {
    if (!header) return;

    const groupSection = header.closest('.group-section');
    if (groupSection) {
        groupSection.classList.toggle('collapsed');
    }
}

/**
 * Show create group modal
 */
function showCreateGroupModal() {
    const modal = safeGetElement('createGroupModal');
    const nameInput = safeGetElement('groupName');
    
    if (modal) modal.classList.add('active');
    if (nameInput) nameInput.focus();
}

/**
 * Close create group modal
 */
function closeCreateGroupModal() {
    const modal = safeGetElement('createGroupModal');
    const nameInput = safeGetElement('groupName');
    const colorInput = safeGetElement('groupColor');
    const colorPreview = safeGetElement('colorPreview');
    
    if (modal) modal.classList.remove('active');
    if (nameInput) nameInput.value = '';
    if (colorInput) colorInput.value = '#667eea';
    if (colorPreview) colorPreview.style.background = '#667eea';
}

/**
 * Create a new group
 */
async function createGroup() {
    const nameInput = safeGetElement('groupName');
    const colorInput = safeGetElement('groupColor');
    
    if (!nameInput || !colorInput) return;

    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) {
        alert('Please enter a group name.');
        return;
    }

    try {
        const response = await fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, color })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            closeCreateGroupModal();
            location.reload();
        } else {
            alert('Error creating group: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating group:', error);
        alert('Error creating group. Please try again.');
    }
}

/**
 * Delete a group
 */
async function deleteGroup(groupId) {
    if (!groupId) return;

    if (!confirm('Are you sure you want to delete this group? Cheatsheets will be moved to Ungrouped.')) {
        return;
    }

    try {
        const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            location.reload();
        } else {
            alert('Error deleting group: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting group:', error);
        alert('Error deleting group. Please try again.');
    }
}

/**
 * Show move to group modal
 */
function moveToGroup(cheatsheetId) {
    if (!cheatsheetId) return;

    currentMoveCheatsheetId = cheatsheetId;
    const modal = safeGetElement('moveToGroupModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close move to group modal
 */
function closeMoveToGroupModal() {
    const modal = safeGetElement('moveToGroupModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentMoveCheatsheetId = null;
}

/**
 * Confirm move cheatsheet to group
 */
async function confirmMoveToGroup() {
    if (!currentMoveCheatsheetId) return;

    const groupSelect = safeGetElement('groupSelect');
    if (!groupSelect) return;

    const groupId = groupSelect.value;

    try {
        const response = await fetch(`/api/cheatsheet/${encodeURIComponent(currentMoveCheatsheetId)}/group`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ group: groupId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            closeMoveToGroupModal();
            location.reload();
        } else {
            alert('Error moving cheatsheet: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error moving cheatsheet:', error);
        alert('Error moving cheatsheet. Please try again.');
    }
}

// ==============================================
// IMPORT JSON FUNCTIONALITY
// ==============================================

let currentImportType = null;
let currentImportContext = null;
let importedFileContent = null;

/**
 * Show import modal
 * @param {string} type - 'cheatsheet', 'section', or 'subsection'
 * @param {HTMLElement} contextElement - The element context (for subsection imports)
 */
function showImportModal(type, contextElement = null) {
    currentImportType = type;
    currentImportContext = contextElement;
    importedFileContent = null;

    const modal = safeGetElement('importModal');
    const title = safeGetElement('importModalTitle');
    const jsonText = safeGetElement('importJsonText');
    const fileInput = safeGetElement('importFileInput');
    const fileSelectedName = safeGetElement('fileSelectedName');
    const importError = safeGetElement('importError');

    if (!modal) return;

    // Set title based on type
    const titles = {
        'cheatsheet': 'Import Cheatsheet',
        'section': 'Import Section',
        'subsection': 'Import Subsection'
    };
    if (title) title.textContent = titles[type] || 'Import JSON';

    // Reset form
    if (jsonText) jsonText.value = '';
    if (fileInput) fileInput.value = '';
    if (fileSelectedName) fileSelectedName.textContent = '';
    if (importError) {
        importError.textContent = '';
        importError.classList.remove('visible');
    }

    // Reset to paste tab
    switchImportTab('paste');

    modal.classList.add('active');

    // Focus on textarea
    if (jsonText) jsonText.focus();
}

/**
 * Close import modal
 */
function closeImportModal() {
    const modal = safeGetElement('importModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentImportType = null;
    currentImportContext = null;
    importedFileContent = null;
}

/**
 * Switch between paste and file tabs
 */
function switchImportTab(tabName) {
    const pasteTab = safeGetElement('importPasteTab');
    const fileTab = safeGetElement('importFileTab');
    const tabs = document.querySelectorAll('.import-tab');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    if (pasteTab) pasteTab.style.display = tabName === 'paste' ? 'flex' : 'none';
    if (fileTab) fileTab.style.display = tabName === 'file' ? 'flex' : 'none';
}

/**
 * Handle file selection for import
 */
function handleImportFile(input) {
    if (!input || !input.files || !input.files[0]) return;

    const file = input.files[0];
    const fileSelectedName = safeGetElement('fileSelectedName');

    if (!file.name.endsWith('.json')) {
        showImportError('Please select a .json file');
        return;
    }

    if (fileSelectedName) {
        fileSelectedName.textContent = `Selected: ${file.name}`;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        importedFileContent = e.target.result;
    };
    reader.onerror = () => {
        showImportError('Error reading file');
    };
    reader.readAsText(file);
}

/**
 * Show import error message
 */
function showImportError(message) {
    const importError = safeGetElement('importError');
    if (importError) {
        importError.textContent = message;
        importError.classList.add('visible');
    }
}

/**
 * Hide import error message
 */
function hideImportError() {
    const importError = safeGetElement('importError');
    if (importError) {
        importError.textContent = '';
        importError.classList.remove('visible');
    }
}

/**
 * Confirm and process the import
 */
function confirmImport() {
    hideImportError();

    // Get JSON content from paste tab or file
    const jsonText = safeGetElement('importJsonText');
    const pasteTab = safeGetElement('importPasteTab');

    let jsonContent = '';

    if (pasteTab && pasteTab.style.display !== 'none') {
        // Using paste tab
        jsonContent = jsonText ? jsonText.value.trim() : '';
    } else {
        // Using file tab
        jsonContent = importedFileContent || '';
    }

    if (!jsonContent) {
        showImportError('Please paste JSON content or select a file');
        return;
    }

    // Parse JSON
    let data;
    try {
        data = JSON.parse(jsonContent);
    } catch (e) {
        showImportError('Invalid JSON format: ' + e.message);
        return;
    }

    // Process based on import type
    try {
        switch (currentImportType) {
            case 'cheatsheet':
                importCheatsheet(data);
                break;
            case 'section':
                importSection(data);
                break;
            case 'subsection':
                importSubsection(data);
                break;
            default:
                showImportError('Unknown import type');
                return;
        }

        closeImportModal();
        showNotification(`${currentImportType.charAt(0).toUpperCase() + currentImportType.slice(1)} imported successfully!`, 'success');
        saveToHistory();
    } catch (e) {
        showImportError('Error importing: ' + e.message);
    }
}

/**
 * Import a full cheatsheet
 */
function importCheatsheet(data) {
    // Validate structure
    if (!data.title && !data.sections) {
        throw new Error('Invalid cheatsheet format. Expected "title" and/or "sections".');
    }

    // If it's a full cheatsheet with sections, load it
    if (data.sections && Array.isArray(data.sections)) {
        // Clear current editor
        currentCheatsheet = { id: null, title: '', sections: [] };
        const titleInput = safeGetElement('cheatsheetTitle');
        const container = safeGetElement('sectionsContainer');

        if (titleInput) titleInput.value = data.title || '';
        if (container) container.innerHTML = '';

        // Load the cheatsheet data
        loadCheatsheetData(data);
    } else {
        throw new Error('Cheatsheet must have a "sections" array.');
    }
}

/**
 * Import a section
 */
function importSection(data) {
    // Validate structure - accept both single section and wrapped format
    let sectionData = data;

    // If it has a sections array, take the first section
    if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        sectionData = data.sections[0];
    }

    // Validate section has required fields
    if (!sectionData.title && !sectionData.lines && !sectionData.subsections) {
        throw new Error('Invalid section format. Expected "title", "lines", and/or "subsections".');
    }

    const container = safeGetElement('sectionsContainer');
    if (!container) throw new Error('Sections container not found');

    const sectionCount = container.children.length + 1;
    const sectionEl = createSectionElement(sectionCount, false);
    if (!sectionEl) throw new Error('Failed to create section element');

    // Set title
    const sectionTitleInput = sectionEl.querySelector('.section-title-input');
    if (sectionTitleInput) {
        sectionTitleInput.value = sectionData.title || '';
    }

    // Set description
    const descInput = sectionEl.querySelector('.section-description-input');
    if (descInput && sectionData.description) {
        descInput.value = sectionData.description;
    }

    // Load images
    const imagesContainer = sectionEl.querySelector('.images-container');
    if (imagesContainer && sectionData.images) {
        sectionData.images.forEach(imageData => {
            loadImageToContainer(imagesContainer, imageData);
        });
    }

    // Load code lines
    const linesContainer = sectionEl.querySelector('.code-lines-container');
    if (linesContainer) {
        if (sectionData.lines && sectionData.lines.length > 0) {
            sectionData.lines.forEach(line => {
                loadCodeLine(linesContainer, line);
            });
        } else {
            linesContainer.appendChild(createCodeLineElement());
        }
    }

    // Load subsections
    if (sectionData.subsections && sectionData.subsections.length > 0) {
        const subsectionsContainer = sectionEl.querySelector('.subsections-container');
        if (subsectionsContainer) {
            sectionData.subsections.forEach((subsection, subIndex) => {
                loadSubsection(subsectionsContainer, subsection, sectionCount, subIndex + 1);
            });
        }
    }

    container.appendChild(sectionEl);
    initDragDrop(sectionEl, 'section-editor');

    // Focus on the section title
    if (sectionTitleInput) {
        sectionTitleInput.focus();
    }
}

/**
 * Import a subsection
 */
function importSubsection(data) {
    // Validate structure - accept both single subsection and wrapped format
    let subsectionData = data;

    // If it has a subsections array, take the first one
    if (data.subsections && Array.isArray(data.subsections) && data.subsections.length > 0) {
        subsectionData = data.subsections[0];
    }

    // Also check if it's a section with subsections
    if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        const firstSection = data.sections[0];
        if (firstSection.subsections && firstSection.subsections.length > 0) {
            subsectionData = firstSection.subsections[0];
        }
    }

    // Validate subsection has required fields
    if (!subsectionData.title && !subsectionData.lines) {
        throw new Error('Invalid subsection format. Expected "title" and/or "lines".');
    }

    // Find the section context
    let section;
    if (currentImportContext) {
        section = currentImportContext.closest('.section-editor');
    }

    if (!section) {
        // If no context, add to the last section or create a new one
        const container = safeGetElement('sectionsContainer');
        if (!container) throw new Error('Sections container not found');

        const sections = container.querySelectorAll('.section-editor');
        if (sections.length === 0) {
            throw new Error('No sections available. Please create a section first.');
        }
        section = sections[sections.length - 1];
    }

    const sectionNum = parseInt(section.dataset.sectionIndex);
    const subsectionsContainer = section.querySelector('.subsections-container');
    if (!subsectionsContainer) throw new Error('Subsections container not found');

    const subsectionCount = subsectionsContainer.children.length + 1;
    const subsectionEl = createSubsectionElement(sectionNum, subsectionCount, false);
    if (!subsectionEl) throw new Error('Failed to create subsection element');

    // Set title
    const subTitleInput = subsectionEl.querySelector('.subsection-title-input');
    if (subTitleInput) {
        subTitleInput.value = subsectionData.title || '';
    }

    // Load images
    const subImagesContainer = subsectionEl.querySelector('.images-container');
    if (subImagesContainer && subsectionData.images) {
        subsectionData.images.forEach(imageData => {
            loadImageToContainer(subImagesContainer, imageData);
        });
    }

    // Load code lines
    const subLinesContainer = subsectionEl.querySelector('.code-lines-container');
    if (subLinesContainer) {
        if (subsectionData.lines && subsectionData.lines.length > 0) {
            subsectionData.lines.forEach(line => {
                loadCodeLine(subLinesContainer, line);
            });
        } else {
            subLinesContainer.appendChild(createCodeLineElement());
        }
    }

    subsectionsContainer.appendChild(subsectionEl);
    initDragDrop(subsectionEl, 'subsection-editor');

    // Unfold the parent section if collapsed
    section.classList.remove('collapsed');

    // Focus on the subsection title
    if (subTitleInput) {
        subTitleInput.focus();
    }
}