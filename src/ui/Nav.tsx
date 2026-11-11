export type NavTarget = 'board' | 'analytics' | 'import';

const ITEMS: Array<{ id: NavTarget; href: string; label: string }> = [
  { id: 'board', href: '#/', label: 'Доска риска' },
  { id: 'analytics', href: '#/analytics', label: 'Аналитика' },
  { id: 'import', href: '#/import', label: 'Свои данные' },
];

export function Nav({ active }: { active: NavTarget }) {
  return (
    <nav className="nav" aria-label="Разделы">
      {ITEMS.map((item) => (
        <a
          key={item.id}
          href={item.href}
          {...(item.id === active ? { 'aria-current': 'page' as const } : {})}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
