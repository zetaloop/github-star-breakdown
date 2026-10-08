import { X } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: (close: () => void) => ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      closedby="any"
      onClose={(event) => {
        if (event.target !== event.currentTarget) return;
        void Promise.allSettled(
          event.currentTarget
            .getAnimations()
            .map((animation) => animation.finished),
        ).then(onClose);
      }}
    >
      <header className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <IconButton label="关闭" onClick={() => ref.current?.close()}>
          <X />
        </IconButton>
      </header>
      <div className="modal-body">{children(() => ref.current?.close())}</div>
    </dialog>
  );
}
