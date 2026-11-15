// Shown when a list is empty. icon: emoji or element; action: e.g. a <Button>.
export default function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      {title && <p className="empty-title">{title}</p>}
      {children && <div className="empty-body">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
