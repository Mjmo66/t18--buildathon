// Small status label. tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'.
export default function Badge({ tone = 'neutral', className = '', children, ...rest }) {
  return (
    <span className={`badge badge-${tone} ${className}`} {...rest}>
      {children}
    </span>
  );
}
