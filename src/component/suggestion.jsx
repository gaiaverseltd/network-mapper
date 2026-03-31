import Search from "../layout/explore/search";

export default function Suggestion({ bio = false, filters = {}, onFiltersChange }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <Search bio={bio} filters={filters} onFiltersChange={onFiltersChange} />
    </div>
  );
}
