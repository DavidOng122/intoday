import { useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';
import QuickAddComposer from './QuickAddComposer';
import TextCaptureModal from './TextCaptureModal';
import { useQuickAdd } from '../hooks/useQuickAdd';
import { QUICK_ADD_OPTIONS } from '../config/quickAddOptions';

const QuickAddMenu = ({ labels, onCreateItem, onImportFiles, renderTrigger }) => {
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
  const textCaptureReturnFocusRef = useRef(null);

  const chooseFiles = (kind) => {
    (kind === 'image' ? imageInputRef : fileInputRef).current?.click();
  };

  return (
    <div ref={rootRef} className="desktop-quick-add">
      <Popover.Root
        open={Boolean(composerKind && composerKind !== 'text')}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
          <Popover.Anchor asChild>
            <DropdownMenu.Trigger asChild>
              {renderTrigger?.({ open })}
            </DropdownMenu.Trigger>
          </Popover.Anchor>

      <input ref={imageInputRef} hidden type="file" accept={QUICK_ADD_OPTIONS[2].accept} onChange={handleFileInputChange} />
      <input ref={fileInputRef} hidden type="file" accept={QUICK_ADD_OPTIONS[3].accept} onChange={handleFileInputChange} />

      {open ? (
        <DropdownMenu.Portal container={getDesktopPortalContainer()}>
        <DropdownMenu.Content
          data-quick-add-layer=""
          className="desktop-quick-add-popover"
          aria-label={labels.quickAddMenuLabel}
          side="bottom"
          align="end"
          sideOffset={14}
          collisionPadding={8}
        >
          {QUICK_ADD_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isFileAction = option.id === 'image' || option.id === 'file';
            return (
              <DropdownMenu.Item
                key={option.id}
                className="desktop-quick-add-option"
                disabled={isImporting && isFileAction}
                onSelect={() => {
                  if (option.id === 'text') {
                    textCaptureReturnFocusRef.current = rootRef.current?.querySelector('button:not([role="menuitem"])') || null;
                  }
                  if (isFileAction) chooseFiles(option.id);
                  else openComposer(option.id);
                }}
              >
                <span className={`desktop-quick-add-option-icon is-${option.id}`}><Icon size={19} strokeWidth={1.9} /></span>
                <span className="desktop-quick-add-option-copy">
                  <strong>{labels[option.labelKey]}</strong>
                  <small>{labels[option.descriptionKey]}</small>
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
        </DropdownMenu.Portal>
      ) : null}
        </DropdownMenu.Root>

      {composerKind === 'text' ? (
        <TextCaptureModal
          labels={labels}
          onCancel={close}
          onSubmit={submitComposer}
          returnFocusRef={textCaptureReturnFocusRef}
        />
      ) : composerKind ? (
        <Popover.Portal container={getDesktopPortalContainer()}>
          <Popover.Content
            data-quick-add-layer=""
            className="desktop-quick-add-composer"
            side="bottom"
            align="end"
            sideOffset={14}
            collisionPadding={8}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <QuickAddComposer kind={composerKind} labels={labels} onCancel={close} onSubmit={submitComposer} />
          </Popover.Content>
        </Popover.Portal>
      ) : null}
      </Popover.Root>
    </div>
  );
};

export default QuickAddMenu;
