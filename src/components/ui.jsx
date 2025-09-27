export function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'btn';
  const variantClass = variant === 'outline' ? 'btn-outline' : 'btn-primary';
  return <button className={`${base} ${variantClass} ${className}`} {...props} />;
}

export function Input(props) {
  return <input className={`input ${props.className || ''}`} {...props} />;
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`card-header ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`card-content ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Badge({ children, className = '' }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function Alert({ children, className = '' }) {
  return <div role="alert" className={`alert ${className}`}>{children}</div>;
}

// Lightweight modal/dialog
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full sm:max-w-lg sm:rounded-lg bg-card text-card-foreground border border-border shadow-lg p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <div className="text-lg font-semibold mb-3">{title}</div> : null}
        <div className="mb-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2">{footer}</div> : null}
        <button
          aria-label="Close"
          className="absolute top-2 right-2 text-muted-foreground hover:opacity-80"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}
