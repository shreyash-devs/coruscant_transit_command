interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  showAll: boolean;
  onToggleShowAll: (nextValue: boolean) => void;
}

export default function SearchBar({ value, onChange, showAll, onToggleShowAll }: SearchBarProps) {
  return (
    <div className="glass-panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by route ID, source, or destination"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={() => onToggleShowAll(!showAll)}
          className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70"
        >
          {showAll ? 'Hide Other Routes' : 'Show All Routes'}
        </button>
      </div>
    </div>
  );
}
