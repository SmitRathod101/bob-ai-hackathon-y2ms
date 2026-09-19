import WhatIfTab from './WhatIfTab';
import { GitCompare } from 'lucide-react';

export default function WhatIfPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-purple-500" />
          What-If Analysis
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Compare multiple disruption scenarios side-by-side to make informed decisions
        </p>
      </div>
      <WhatIfTab />
    </div>
  );
}
