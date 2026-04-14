const STAT_COLORS = {
  academic:   '#a78bfa',
  financial:  '#f59e0b',
  work_ethic: '#10b981',
  social:     '#3b82f6',
};

const STAT_LABELS = {
  academic:   'Academic',
  financial:  'Financial',
  work_ethic: 'Work Ethic',
  social:     'Social',
};

/**
 * Renders all four core stat bars.
 * props.stats = { academic, financial, work_ethic, social }
 * props.prev  = optional previous stats (shows delta arrows)
 */
export default function StatBar({ stats, prev }) {
  const keys = ['academic', 'work_ethic', 'financial', 'social'];

  return (
    <div className="stat-list">
      {keys.map(key => {
        const val  = Math.round(stats[key] ?? 0);
        const pval = prev ? Math.round(prev[key] ?? 0) : null;
        const delta = pval != null ? val - pval : null;
        const color = STAT_COLORS[key];

        return (
          <div className="stat-row" key={key}>
            <span className="stat-label">{STAT_LABELS[key]}</span>
            <div className="stat-track">
              <div
                className="stat-fill"
                style={{ width: `${val}%`, background: color }}
              />
            </div>
            <span className="stat-value" style={{ color }}>
              {val}
              {delta !== null && delta !== 0 && (
                <span style={{ fontSize: '0.7rem', color: delta > 0 ? '#10b981' : '#ef4444' }}>
                  {delta > 0 ? ` +${delta}` : ` ${delta}`}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
