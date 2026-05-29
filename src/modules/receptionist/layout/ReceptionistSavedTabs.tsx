import { useNavigate } from 'react-router-dom';
import { clearOpenTabs, getOpenTabs, getTabLabel } from '@/lib/tabStorage';

export function ReceptionistSavedTabs() {
  const navigate = useNavigate();
  const openTabs = getOpenTabs();

  return (
    <div className="border-b border-slate-100 bg-white px-6 py-3 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {openTabs.length === 0 ? <div className="text-sm text-slate-400">No saved tabs</div> : null}
          {openTabs.map((path) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="rounded-lg bg-slate-50 px-3 py-1 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              {getTabLabel(path)}
            </button>
          ))}
        </div>
        <button onClick={clearOpenTabs} className="text-xs text-slate-500 hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}
