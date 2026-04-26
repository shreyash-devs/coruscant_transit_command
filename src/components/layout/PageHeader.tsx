interface PageHeaderProps {
  title: string;
  description: string;
  rightContent?: React.ReactNode;
}

export default function PageHeader({ title, description, rightContent }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </header>
  );
}
