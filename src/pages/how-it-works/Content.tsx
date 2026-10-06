import { ContentLayout, H2, P, UL, LI, A } from '../ContentLayout';

export function HowItWorksContent() {
  return (
    <ContentLayout
      slug="how-it-works"
      title="How FIRE Planner works"
      lede="An honest look under the hood: what the model computes, the tax assumptions it makes, and — just as important — what it deliberately leaves out. Knowing the limits is what makes a projection useful."
    >
      <H2>Everything runs in your browser</H2>
      <P>
        There is no server and no account. The simulation, the withdrawal optimizer,
        and the charts all run as JavaScript on your own device. Your plans are saved
        to your browser's localStorage, and you can export or import them as JSON files
        you control. Clear your browser data and everything is gone — nothing is stored
        anywhere else.
      </P>

      <H2>What it models</H2>
      <UL>
        <LI>Income and expenses across a horizon you choose, with inflation applied to expenses.</LI>
        <LI>Investment growth on brokerage, Roth, and traditional/IRA balances at a return rate you set.</LI>
        <LI>Withdrawals to cover any shortfall, including an optimizer that picks a tax-efficient drawdown order.</LI>
        <LI>Illustrative U.S. federal income tax and long-term capital-gains tax, bracket by bracket.</LI>
        <LI>Year-by-year “actuals” you can record as real life diverges from the plan.</LI>
      </UL>

      <H2>The tax assumptions</H2>
      <P>
        Taxes are <strong>illustrative, not advice</strong>. The model uses{' '}
        <strong>2026 Married Filing Jointly</strong> brackets and a $32,200 standard
        deduction (from IRS Rev. Proc. 2025-32). Other filing statuses — single, head
        of household, married filing separately — are not yet supported.
      </P>
      <P>
        The IRS 59½ early-withdrawal rule is approximated as “the calendar year you
        turn 60,” because the planner captures your birth year but not your birth
        month. That's exact for December births and up to about six months conservative
        for January births.
      </P>

      <H2>What it deliberately skips</H2>
      <P>
        A planner that pretended to model everything would be harder to trust, not
        easier. These are knowingly out of scope:
      </P>
      <UL>
        <LI>State and local taxes.</LI>
        <LI>Social Security and pensions.</LI>
        <LI>Required Minimum Distributions (RMDs).</LI>
        <LI>NIIT, Medicare IRMAA surcharges, and the Roth 5-year rule.</LI>
        <LI>Roth conversions.</LI>
        <LI>Return variability and sequence-of-returns risk — returns are a single fixed rate.</LI>
        <LI>Inflation on income (only expenses are inflated).</LI>
      </UL>
      <P>
        Because returns are fixed rather than randomized, treat the output as a
        deterministic “if these assumptions hold” path, not a probability. It's a tool
        for understanding the shape of a plan and the trade-offs between choices — not a
        forecast, and not financial advice.
      </P>

      <H2>Try it</H2>
      <P>
        <A href="/">Open the planner</A> and build a scenario in a couple of minutes —
        free, private, no signup. To dig into specific concepts, see{' '}
        <A href="/4-percent-rule/">the 4% rule</A>,{' '}
        <A href="/retirement-withdrawal-strategy/">withdrawal strategy</A>, or{' '}
        <A href="/coast-fire-calculator/">Coast FIRE</A>.
      </P>
    </ContentLayout>
  );
}
