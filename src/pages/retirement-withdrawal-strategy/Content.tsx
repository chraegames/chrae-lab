import { ContentLayout, H2, P, UL, LI, A } from '../ContentLayout';

export function WithdrawalStrategyContent() {
  return (
    <ContentLayout
      slug="retirement-withdrawal-strategy"
      title="Tax-efficient withdrawal strategy"
      lede="Two retirees with identical portfolios can pay very different amounts of tax — purely because of the order in which they draw down their accounts. Withdrawal sequencing is one of the few free levers in retirement planning."
    >
      <H2>Why the order matters</H2>
      <P>
        Retirement savings usually live in three buckets that are taxed differently
        when you spend them:
      </P>
      <UL>
        <LI>
          <strong>Taxable brokerage.</strong> Only the <em>gains</em> are taxed, at
          capital-gains rates — often the lowest bill per dollar withdrawn.
        </LI>
        <LI>
          <strong>Traditional / IRA.</strong> Every dollar withdrawn is ordinary
          income, taxed at your marginal rate.
        </LI>
        <LI>
          <strong>Roth.</strong> Qualified withdrawals are tax-free, which makes Roth
          the most valuable bucket to preserve and the most flexible to tap.
        </LI>
      </UL>
      <P>
        Because the U.S. uses graduated tax brackets, <em>how much</em> you pull from
        the taxable IRA in any one year decides which bracket that income lands in.
        Draw too much in a single year and you push the top slice into a higher bracket;
        spread it out and you can fill the lower brackets cheaply year after year.
      </P>

      <H2>Common sequencing approaches</H2>
      <UL>
        <LI>
          <strong>Taxable → traditional → Roth.</strong> The conventional default:
          spend the lightly-taxed brokerage first and let tax-advantaged accounts keep
          compounding, saving Roth for last.
        </LI>
        <LI>
          <strong>Bracket-filling.</strong> Each year, draw just enough from the
          traditional IRA to “fill up” a target bracket, then top up spending from Roth
          or brokerage. This smooths ordinary income across decades.
        </LI>
        <LI>
          <strong>Proportional.</strong> Draw from all three in fixed proportions to
          keep the relative balances — and thus future flexibility — intact.
        </LI>
      </UL>
      <P>
        There's no single winner; the best sequence depends on your balances, your
        spending, and the tax brackets in play each year. That's a lot of interacting
        variables to optimize by hand.
      </P>

      <H2>Let an optimizer do the sequencing</H2>
      <P>
        FIRE Planner includes a withdrawal optimizer that searches for a tax-efficient
        drawdown schedule across your brokerage, Roth, and IRA balances — proportionally
        drawing down accounts while respecting a cash target and early-withdrawal age
        limits. It runs entirely in your browser, so you can try different spending
        levels and watch the resulting tax bill in real time.
      </P>
      <P>
        <A href="/">Open the planner</A> to model your own accounts — free, private, no
        signup. For the spending side of the question, see{' '}
        <A href="/4-percent-rule/">the 4% rule and safe withdrawal rates</A>.
      </P>
    </ContentLayout>
  );
}
