/**
 * Renders the monthly budget table for the adult phase.
 *
 * props.budget — output from computeMonthlyBudget (via /game/budget)
 */
export default function BudgetBreakdown({ budget }) {
  if (!budget) return null;

  const fmt = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Monthly Budget</h3>
      <div className="budget-grid">

        <span className="budget-label">Annual salary</span>
        <span className="budget-val">{fmt(budget.annual_salary)}</span>

        <span className="budget-label">Gross / month</span>
        <span className="budget-val">{fmt(budget.gross_monthly)}</span>

        <div className="budget-divider" />

        <span className="budget-label" style={{ color: '#ef4444' }}>Federal tax</span>
        <span className="budget-val" style={{ color: '#ef4444' }}>–{fmt(budget.deductions.federal_tax)}</span>

        <span className="budget-label" style={{ color: '#ef4444' }}>FICA</span>
        <span className="budget-val" style={{ color: '#ef4444' }}>–{fmt(budget.deductions.fica)}</span>

        <span className="budget-label" style={{ color: '#ef4444' }}>Retirement</span>
        <span className="budget-val" style={{ color: '#ef4444' }}>–{fmt(budget.deductions.retirement)}</span>

        <div className="budget-divider" />

        <span className="budget-label budget-total">Take-home</span>
        <span className="budget-val budget-total">{fmt(budget.net_monthly)}</span>

        <div className="budget-divider" />

        <span className="budget-label">Rent</span>
        <span className="budget-val">–{fmt(budget.expenses.rent)}</span>

        <span className="budget-label">Groceries</span>
        <span className="budget-val">–{fmt(budget.expenses.groceries)}</span>

        <span className="budget-label">Transport</span>
        <span className="budget-val">–{fmt(budget.expenses.transport)}</span>

        <span className="budget-label">Utilities</span>
        <span className="budget-val">–{fmt(budget.expenses.utilities)}</span>

        <span className="budget-label">Healthcare</span>
        <span className="budget-val">–{fmt(budget.expenses.healthcare)}</span>

        {budget.expenses.student_loan > 0 && <>
          <span className="budget-label">Student loan</span>
          <span className="budget-val">–{fmt(budget.expenses.student_loan)}</span>
        </>}

        <div className="budget-divider" />

        <span className="budget-label budget-total">Net cash flow</span>
        <span className={`budget-val budget-total ${budget.is_solvent ? 'solvent-yes' : 'solvent-no'}`}>
          {budget.is_solvent ? '+' : ''}{fmt(budget.net_cash_flow)}
        </span>

        <span className="budget-label">Status</span>
        <span className={`budget-val ${budget.is_solvent ? 'solvent-yes' : 'solvent-no'}`}>
          {budget.is_solvent ? 'Solvent ✓' : 'Insolvent ✗'}
        </span>

      </div>
    </div>
  );
}
