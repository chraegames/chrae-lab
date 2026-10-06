import { ContentLayout, H2, P, UL, LI, A } from '../ContentLayout';

export function CoastFireContent() {
  return (
    <ContentLayout
      slug="coast-fire-calculator"
      title="Coast FIRE calculator"
      lede="Coast FIRE is the point where your invested savings will grow into a full retirement nest egg on their own — no further contributions needed. You just have to cover today's expenses until then."
    >
      <H2>What “Coast FIRE” actually means</H2>
      <P>
        Most FIRE math asks how much you need to retire <em>today</em>. Coast FIRE
        flips the question: how much do you need invested <em>right now</em> so that,
        left untouched, it compounds into your retirement target by the time you
        actually stop working? Hit that number and you've reached Coast FIRE — you can
        stop saving for retirement entirely and simply earn enough to pay current
        bills while the portfolio does the rest.
      </P>

      <H2>The formula</H2>
      <P>
        Coast FIRE is just the present value of your future retirement target. If you
        expect to need a nest egg of <strong>N</strong> at retirement, your money has{' '}
        <strong>t</strong> years to grow, and you assume a real (after-inflation)
        return of <strong>r</strong>, then:
      </P>
      <UL>
        <LI>
          <strong>Coast number = N ÷ (1 + r)<sup>t</sup></strong>
        </LI>
        <LI>
          Example: target a $1,500,000 nest egg, 25 years out, at a 5% real return →
          you need about <strong>$443,000 invested today</strong>. After that, you
          never have to contribute another dollar to retirement accounts.
        </LI>
      </UL>
      <P>
        The two assumptions that move this number the most are the return rate and the
        time horizon. A single percentage point of return, compounded over decades,
        swings the answer dramatically — which is exactly why a year-by-year model
        beats a one-line formula.
      </P>

      <H2>Why model it instead of using one formula</H2>
      <P>
        A closed-form Coast FIRE number assumes a single fixed return and a single
        retirement target. Real plans aren't that tidy: returns vary, expenses change,
        you may keep contributing for a few more years, and taxes eat into withdrawals
        later. Modeling the full path — contributions, growth, inflation, and eventual
        drawdown — shows you not just the Coast number but what happens on either side
        of it.
      </P>

      <H2>Model your Coast FIRE number</H2>
      <P>
        FIRE Planner runs the whole projection in your browser. Set your current
        balances, expected return, and the year you'd like to stop contributing, and
        watch whether the portfolio coasts to your target — or where it falls short.
        It's <A href="/">free, private, and requires no signup</A>; your numbers never
        leave your device.
      </P>
      <P>
        Related reading: the <A href="/4-percent-rule/">4% rule and safe withdrawal
        rates</A> covers how much that nest egg can actually pay out once you're there.
      </P>
    </ContentLayout>
  );
}
