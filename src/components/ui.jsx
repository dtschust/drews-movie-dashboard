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
