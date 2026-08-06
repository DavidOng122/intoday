import React, { useCallback, useEffect, useRef, useState } from 'react';
import { convertDocumentFileToMarkdown } from '../../../lib/convertToMarkdown';
import { translations } from '../../../shared/i18n/translations';
import { SUPPORTED_CONVERT_ACCEPT, SUPPORTED_UPLOAD_ACCEPT } from '../config/uploadConstants';
import { AttachFileIcon, CloseIcon, ConvertUploadIcon } from '../../../shared/ui/icons/DesktopIcons';
import { hasSupportedConvertFiles, hasSupportedUploadFiles, isSupportedConvertFile } from '../services/uploadUtils';

const getTranslationsForLanguage = (language) => translations[language] || translations.EN;

const AddPanel = ({
  open,
  language,
  inputText,
  setInputText,
  fileAttachments,
  onAddFiles,
  onRemoveFile,
  onShowToast,
  onClose,
  onSubmit,
}) => {
  const createInitialConvertState = () => ({
    selectedFile: null,
    status: 'idle',
    markdown: '',
    error: '',
  });
  const [mode, setMode] = useState('add');
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isConvertDragActive, setIsConvertDragActive] = useState(false);
  const [convertState, setConvertState] = useState(createInitialConvertState);
  const fileInputRef = useRef(null);
  const convertFileInputRef = useRef(null);
  const previousModeRef = useRef('add');
  const t = getTranslationsForLanguage(language);

  const resetConvertState = useCallback(() => {
    console.debug('[add-panel] resetConvertState invoked');
    setIsConvertDragActive(false);
    setConvertState((current) => {
      const isAlreadyInitial = (
        current.selectedFile === null
        && current.status === 'idle'
        && !current.markdown
        && !current.error
      );
      console.debug('[add-panel] resetConvertState setConvertState', {
        current,
        isAlreadyInitial,
      });
      return isAlreadyInitial ? current : createInitialConvertState();
    });
    if (convertFileInputRef.current) {
      convertFileInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    console.debug('[add-panel] open reset effect', {
      open,
      mode,
      isFileDragActive,
      convertState,
    });
    if (!open) {
      console.debug('[add-panel] open reset effect setState', {
        nextMode: 'add',
        nextIsFileDragActive: false,
        action: 'resetConvertState',
      });
      setMode('add');
      setIsFileDragActive(false);
      resetConvertState();
    }
  }, [open, mode, isFileDragActive, convertState, resetConvertState]);

  useEffect(() => {
    const previousMode = previousModeRef.current;
    console.debug('[add-panel] mode sync effect', {
      previousMode,
      mode,
      convertStatus: convertState.status,
      hasMarkdown: Boolean(convertState.markdown),
      error: convertState.error,
    });
    if (previousMode === 'convert' && mode !== 'convert') {
      console.debug('[add-panel] mode sync effect setState', {
        action: 'resetConvertState',
      });
      resetConvertState();
    }
    previousModeRef.current = mode;
  }, [mode, convertState.status, convertState.markdown, convertState.error, resetConvertState]);

  const handleConvertFiles = (files) => {
    const selectedFiles = Array.from(files || []);
    const firstSupportedFile = selectedFiles.find((file) => isSupportedConvertFile(file));
    if (!firstSupportedFile) {
      setConvertState({
        selectedFile: null,
        status: 'error',
        markdown: '',
        error: 'Please choose a PDF, DOCX, HTML, or TXT-based file.',
      });
      return;
    }

    setConvertState({
      selectedFile: firstSupportedFile,
      status: 'ready',
      markdown: '',
      error: '',
    });
  };

  const handleUseMarkdownInAdd = useCallback((markdown) => {
    const nextMarkdown = String(markdown || '').trim();
    console.debug('[add-panel] handleUseMarkdownInAdd', {
      markdownLength: nextMarkdown.length,
      willSetInputText: Boolean(nextMarkdown),
    });
    if (!nextMarkdown) return;
    setInputText(nextMarkdown);
    onShowToast?.('Markdown added to draft');
    setMode('add');
  }, [onShowToast, setInputText]);

  const handleRunConvert = async () => {
    if (!convertState.selectedFile || convertState.status === 'converting') return;

    setConvertState((current) => ({
      ...current,
      status: 'converting',
      markdown: '',
      error: '',
    }));

    try {
      const markdown = await convertDocumentFileToMarkdown(convertState.selectedFile);
      setConvertState((current) => ({
        ...current,
        status: 'success',
        markdown,
        error: '',
      }));
      handleUseMarkdownInAdd(markdown);
    } catch (error) {
      setConvertState((current) => ({
        ...current,
        status: 'error',
        markdown: '',
        error: error instanceof Error ? error.message : 'Unable to convert this file.',
      }));
    }
  };

  const convertActionLabel = (() => {
    if (convertState.status === 'converting') return 'Converting...';
    if (convertState.status === 'success') return 'Converted';
    if (convertState.status === 'error' && convertState.selectedFile) return 'Retry';
    return 'Convert';
  })();

  const handlePrimaryConvertAction = () => {
    handleRunConvert();
  };

  if (!open) return null;

  return (
    <div role="dialog" className="desktop-add-panel">
      <div className="desktop-add-panel-header">
        <div className="desktop-add-panel-segmented" role="tablist" aria-label="Panel mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'add'}
            className={`desktop-add-panel-segment ${mode === 'add' ? 'active' : ''}`}
            onClick={() => setMode('add')}
          >
            {t.addPanelAdd || 'Add'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'convert'}
            className={`desktop-add-panel-segment ${mode === 'convert' ? 'active' : ''}`}
            onClick={() => setMode('convert')}
          >
            {t.addPanelConvert || 'Convert'}
          </button>
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className="desktop-add-panel-close"><CloseIcon /></button>
      </div>
      <div className="desktop-add-panel-body">
        <div className="desktop-add-panel-mode-content">
          {mode === 'add' ? (
            <>
              <div className="desktop-add-panel-copy">
                <h2 className="desktop-add-panel-title">{t.addPanelTitle || 'Add to workspace'}</h2>
                <p className="desktop-add-panel-support">{t.addPanelSupport || 'Type a note, paste a link, or drop an image'}</p>
              </div>
              <div
                className={`desktop-add-panel-surface ${isFileDragActive ? 'drag-active' : ''}`}
                onDragEnter={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsFileDragActive(true);
                }}
                onDragOver={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'copy';
                  }
                  if (!isFileDragActive) {
                    setIsFileDragActive(true);
                  }
                }}
                onDragLeave={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsFileDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsFileDragActive(false);
                  const files = Array.from(event.dataTransfer?.files || []);
                  if (files.length) {
                    onAddFiles?.(files);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  multiple
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    if (files.length) {
                      onAddFiles?.(files);
                    }
                    event.target.value = '';
                  }}
                />
                {fileAttachments.length ? (
                  <div className="desktop-add-panel-attachment-strip">
                    {fileAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className={`desktop-add-panel-attachment ${attachment.uploadKind === 'image' ? 'image' : 'document'}`}
                      >
                        {attachment.uploadKind === 'image' ? (
                          <img
                            src={attachment.previewUrl || attachment.photoDataUrl}
                            alt={attachment.title}
                            draggable={false}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="desktop-add-panel-attachment-content">
                            <div className={`desktop-add-panel-attachment-badge ${attachment.uploadKind}`}>
                              {attachment.uploadKind === 'pdf' ? 'PDF' : 'DOC'}
                            </div>
                            <div className="desktop-add-panel-attachment-copy">
                              <span className="desktop-add-panel-attachment-title">{attachment.title}</span>
                              <span className="desktop-add-panel-attachment-kind">{attachment.uploadKind}</span>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${attachment.title}`}
                          onClick={() => onRemoveFile?.(attachment.id)}
                          className="desktop-add-panel-attachment-remove"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <textarea
                  autoFocus
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      onSubmit();
                    }
                  }}
                  placeholder={t.placeholder}
                  className="desktop-add-panel-textarea"
                />
                {isFileDragActive ? (
                  <div className="desktop-add-panel-drop-overlay">
                    {t.dropToAttach || 'Drop PDF, Word, or image to attach'}
                  </div>
                ) : null}
              </div>
              <div className="desktop-add-panel-footer">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="desktop-add-panel-files-button"
                >
                  <AttachFileIcon />
                  <span>{t.document || 'Files'}</span>
                </button>
                <button type="button" onClick={onSubmit} className="desktop-add-panel-submit-button">{t.add || 'Add'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="desktop-add-panel-copy">
                <h2 className="desktop-add-panel-title">{t.convertPanelTitle || 'Convert to Markdown'}</h2>
                <p className="desktop-add-panel-support">{t.convertPanelSupport || 'Drop a PDF, DOCX, HTML, or TXT-based file to turn it into reusable markdown'}</p>
              </div>
              <div
                className={`desktop-convert-panel-dropzone ${isConvertDragActive ? 'drag-active' : ''}`}
                onClick={() => convertFileInputRef.current?.click()}
                onDragEnter={(event) => {
                  if (!hasSupportedConvertFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsConvertDragActive(true);
                }}
                onDragOver={(event) => {
                  if (!hasSupportedConvertFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'copy';
                  }
                  if (!isConvertDragActive) {
                    setIsConvertDragActive(true);
                  }
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsConvertDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  const files = Array.from(event.dataTransfer?.files || []);
                  if (!files.some((file) => isSupportedConvertFile(file))) return;
                  event.preventDefault();
                  setIsConvertDragActive(false);
                  handleConvertFiles(files);
                }}
              >
                <input
                  ref={convertFileInputRef}
                  type="file"
                  accept={SUPPORTED_CONVERT_ACCEPT}
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    handleConvertFiles(event.target.files || []);
                    event.target.value = '';
                  }}
                />
                <div className="desktop-convert-panel-icon-shell">
                  <ConvertUploadIcon />
                </div>
                <div className="desktop-convert-panel-drop-copy">
                  <div className="desktop-convert-panel-drop-title">
                    {convertState.selectedFile?.name || (t.convertPanelSupport || 'Click or drag a PDF, DOCX, HTML, or TXT-based file here')}
                  </div>
                  {convertState.selectedFile ? (
                    <div className="desktop-convert-panel-drop-subtitle">
                      {convertState.status === 'success'
                        ? 'Markdown added to Add so you can review and save'
                        : convertState.status === 'converting'
                          ? 'Extracting text and formatting markdown'
                          : 'Ready to convert'}
                    </div>
                  ) : null}
                </div>
              </div>
              {convertState.error ? (
                <div className="desktop-convert-panel-feedback error">{convertState.error}</div>
              ) : null}
              {convertState.markdown ? (
                <div className="desktop-convert-panel-preview">
                  <div className="desktop-convert-panel-preview-header">
                    <span>Markdown preview</span>
                    <span>{convertState.markdown.length} chars</span>
                  </div>
                  <textarea
                    value={convertState.markdown}
                    readOnly
                    className="desktop-convert-panel-preview-textarea"
                  />
                </div>
              ) : null}
              <div className="desktop-convert-panel-meta">
                <span>Supports PDF, DOCX, HTML, TXT</span>
                <span>Up to 10MB</span>
              </div>
              <div className="desktop-convert-panel-actions">
                <button
                  type="button"
                  onClick={() => convertFileInputRef.current?.click()}
                  className="desktop-add-panel-files-button"
                >
                  {convertState.selectedFile ? 'Choose another file' : 'Choose file'}
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryConvertAction}
                  disabled={!convertState.selectedFile || convertState.status === 'converting' || convertState.status === 'success'}
                  className="desktop-add-panel-submit-button"
                >
                  {convertActionLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPanel;
