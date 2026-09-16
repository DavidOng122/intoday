import QuickAddComposer from './QuickAddComposer';
import TextCaptureModal from './TextCaptureModal';
import { useQuickAdd } from '../hooks/useQuickAdd';
import { QUICK_ADD_OPTIONS } from '../config/quickAddOptions';

const QuickAddMenu = ({ appearance, labels, onCreateItem, onImportFiles, renderTrigger }) => {
  const {
    rootRef,
    imageInputRef,
    fileInputRef,
    open,
    setOpen,
    composerKind,
    isImporting,
    openComposer,
    close,
    submitComposer,
    handleFileInputChange,
  } = useQuickAdd({ onCreateItem, onImportFiles });

  const chooseFiles = (kind) => {
    setOpen(false);
    (kind === 'image' ? imageInputRef : fileInputRef).current?.click();
  };

  return (
    <div ref={rootRef} className="desktop-quick-add">
      {renderTrigger?.({
        open,
        toggle: () => setOpen((current) => !current),
      })}

      <input ref={imageInputRef} hidden type="file" accept={QUICK_ADD_OPTIONS[2].accept} onChange={handleFileInputChange} />
      <input ref={fileInputRef} hidden type="file" accept={QUICK_ADD_OPTIONS[3].accept} onChange={handleFileInputChange} />

      {open ? (
        <div className="desktop-quick-add-popover" role="menu" aria-label={labels.quickAddMenuLabel}>
          {QUICK_ADD_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isFileAction = option.id === 'image' || option.id === 'file';
            return (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                className="desktop-quick-add-option"
                disabled={isImporting && isFileAction}
                onClick={() => (isFileAction ? chooseFiles(option.id) : openComposer(option.id))}
              >
                <span className={`desktop-quick-add-option-icon is-${option.id}`}><Icon size={19} strokeWidth={1.9} /></span>
                <span className="desktop-quick-add-option-copy">
                  <strong>{labels[option.labelKey]}</strong>
                  <small>{labels[option.descriptionKey]}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {composerKind === 'text' ? (
        <TextCaptureModal appearance={appearance} labels={labels} onCancel={close} onSubmit={submitComposer} />
      ) : composerKind ? (
        <QuickAddComposer kind={composerKind} labels={labels} onCancel={close} onSubmit={submitComposer} />
      ) : null}
    </div>
  );
};

export default QuickAddMenu;
