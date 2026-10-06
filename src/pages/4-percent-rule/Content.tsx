import { ContentLayout, H2, P, UL, LI, A } from '../ContentLayout';

export function FourPercentContent() {
  return (
    <ContentLayout
      slug="4-percent-rule"
      title="The 4% rule, explained"
      lede="The 4% rule is the most-cited shorthand in retirement planning: withdraw 4% of your portfolio in year one, adjust for inflation each year after, and your money has historically lasted about 30 years. It's a useful starting point — and a poor stopping point."
    >
      <H2>Where the number comes from</H2>
      <P>
        The rule traces to the 1990s “Trinity Study” and William Bengen's research,
        which tested historical U.S. stock-and-bond portfolios against decades of
        market data. The finding: a 4% initial withdrawal rate, rising with inflation,
        survived almost every historical 30-year window. Flip it around and you get the
        famous corollary — you need roughly <strong>25× your annual spending</strong>{' '}
        invested to retire (because 1 ÷ 0.04 = 25).
      </P>

      <H2>What it gets right</H2>
      <UL>
        <LI>
          It turns a vague goal (“enough to retire”) into a concrete target you can
          actually save toward.
        </LI>
        <LI>
          It bakes in inflation adjustments, so your spending power is held roughly
          constant.
        </LI>
        <LI>
          It's conservative enough that in many historical periods retirees <em>ended
          richer</em> than they started.
        </LI>
      </UL>

      <H2>Where it breaks down</H2>
      <P>
        The 4% rule is a backward-looking average, and averages hide the cases that
        actually sink a plan:
      </P>
      <UL>
        <LI>
          <strong>Sequence-of-returns risk.</strong> A bad market in your first few
          retirement years does far more damage than the same crash later — the rule's
          single percentage can't see that.
        </LI>
        <LI>
          <strong>Long horizons.</strong> 4% was calibrated to ~30 years. Retire early
          for a 45- or 50-year horizon and the safe rate drops.
        </LI>
        <LI>
          <strong>Taxes and account location.</strong> A withdrawal from a traditional
          IRA isn't worth the same as one from a Roth or brokerage account. The rule
          ignores tax entirely.
        </LI>
        <LI>
          <strong>Flat spending.</strong> Real spending isn't a smooth inflation-
          adjusted line — it lumps and dips across a retirement.
        </LI>
      </UL>

      <H2>A better approach: model your own rate</H2>
      <P>
        Treat 4% as a sanity check, not a guarantee. The way to know whether{' '}
        <em>your</em> plan holds is to project it year by year — actual balances,
        actual expenses, inflation, and the taxes due on each withdrawal — and watch
        whether the portfolio survives your specific horizon.
      </P>
      <P>
        FIRE Planner does exactly that in your browser: set your spending, returns, and
        time horizon and see your effective withdrawal rate evolve, instead of trusting
        one number.{' '}
        <A href="/">Open the planner</A> — it's free and private, with no signup.
      </P>
      <P>
        Related: <A href="/retirement-withdrawal-strategy/">tax-efficient withdrawal
        strategy</A> covers <em>which</em> accounts to draw from, and{' '}
        <A href="/coast-fire-calculator/">the Coast FIRE calculator</A> covers getting
        to the nest egg in the first place.
      </P>
    </ContentLayout>
  );
}
