import { X } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
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

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  const selected = options.findIndex((option) => option.value === value);
  return (
    <fieldset
      className="segmented"
      disabled={disabled}
      data-selected={selected >= 0}
      style={
        {
          "--count": options.length,
          "--selected": Math.max(0, selected),
        } as CSSProperties
      }
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            className="sr-only"
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
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
