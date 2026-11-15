import { Link } from 'react-router-dom';

// A surface. Pass `to` to make the whole card a link; `as` to change the element.
export default function Card({ to, as: Tag = 'div', className = '', children, ...rest }) {
  const cls = ['ui-card', to && 'ui-card-link', className].filter(Boolean).join(' ');
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
