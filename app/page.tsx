const Arrow = () => <span aria-hidden="true">↗</span>;

function Placeholder({ type, size, className = "" }: { type: "Desktop" | "Mobile"; size: string; className?: string }) {
  return (
    <div className={`placeholder ${className}`} role="img" aria-label={`${type} image placeholder, ${size}`}>
      <span>{type} image</span>
      <strong>{size}</strong>
    </div>
  );
}

const proof = [
  ["$332k", "weekly GMV processed"],
  ["7+", "countries with venue partners"],
  ["20+", "reports across the business"],
];

const platform = [
  ["01", "Online reservations", "Prepayments, dynamic pricing, add-ons, events, ticketing, and a 3D birds-eye map that sells the exact spot."],
  ["02", "Front of house", "A live floor plan, automatic seating allocation, guest-list management, and inventory synced in real time."],
  ["03", "Marketing", "Every booking flows into Meta, Google, and GA4 with revenue attached. Every guest becomes part of the audience."],
];

const levers = [
  ["Prepayments & deposits", "The money arrives before the guest does."],
  ["Upsells & add-ons", "Sell bottles, cakes, transfers, and products around the clock."],
  ["Dynamic pricing", "Make more from the same inventory when demand moves."],
  ["Abandoned booking retargeting", "Bring guests back to the zone, date, and price they left."],
];

const faqs = [
  ["What is Clubtech?", "Clubtech is an all-in-one booking platform for beach clubs, day clubs, nightclubs, and hotel pools—online reservations, front-of-house operations, and marketing in a single system. Founded in Singapore, it processes $332k in weekly GMV and supports venue partners in over 7 countries."],
  ["How much does Clubtech cost?", "There is no monthly fee. Online bookings carry a 4% processing fee paid by the customer, and each venue pays a one-time $2,000 setup fee covering widget setup, system configuration, and staff training. The platform earns when the venue's online revenue grows."],
  ["How does Clubtech reduce no-shows?", "Guests commit before they arrive. Prepayments, deposits, and minimum spends are collected inside the booking flow, so the money arrives before the guest does—and capacity is locked in days ahead instead of guessed on the day."],
  ["Does Clubtech integrate with our existing POS and PMS?", "Yes. Clubtech sits on top of the existing stack rather than replacing it, with no major IT changes. Integrations include Opera PMS, Airwallex, Midtrans (QRIS, GoPay, OVO), Apple Pay, Google Pay, Meta Ads, Google Ads, GA4, and WhatsApp, with multi-currency support."],
  ["What makes Clubtech different from a restaurant reservation system?", "Clubtech sells the venue itself, not a time slot. The 3D birds-eye interactive map lets guests choose the exact furniture and zone, stack add-ons like bottles and transfers, and pay upfront—built for furniture, zones, and dayparts rather than dining covers."],
  ["How does onboarding work?", "A dedicated account lead runs five stages: onboarding, build, training, go-live, and optimization. The rollout is configured around what the venue actually sells, and 90-day hypercare with strategic data advisory continues after launch to improve conversion."],
];

const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

const delivery = [
  ["Onboarding", "Scope the venue, inventory, systems, and commercial model."],
  ["Build", "Configure a booking journey around what your venue actually sells."],
  ["Training", "Prepare the reservations, floor, door, and marketing teams."],
  ["Go-live", "Launch with a dedicated account lead and real-time support."],
  ["Optimize", "Use 90-day hypercare and strategic data advisory to improve conversion."],
];

export default function Home() {
  return (
    <main>
      <header className="nav-wrap">
        <nav className="nav" aria-label="Main navigation">
          <a href="#top" className="brand" aria-label="Clubtech home"><img src="/brand/clubtech-wordmark-white.png" alt="Clubtech" /></a>
          <div className="nav-links">
            <a href="#platform">Platform</a><a href="#booking">Booking</a><a href="#operations">Operations</a><a href="#intelligence">Intelligence</a><a href="#delivery">Delivery</a><a href="#pricing">Pricing</a><a href="https://www.clubtechglobal.com/blog">Blog</a>
          </div>
          <a className="button button-dark nav-cta" href="#contact">Book a demo <Arrow /></a>
          <details className="mobile-menu"><summary aria-label="Open navigation">Menu</summary><div><a href="#platform">Platform</a><a href="#booking">Booking</a><a href="#operations">Operations</a><a href="#intelligence">Intelligence</a><a href="#delivery">Delivery</a><a href="#pricing">Pricing</a><a href="https://www.clubtechglobal.com/blog">Blog</a><a href="#contact">Book a demo</a></div></details>
        </nav>
      </header>

      <section className="hero shell" id="top">
        <img className="hero-mark" src="/brand/clubtech-mark-white.png" alt="" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-content">
            <h1>World-class<br /><span className="no-wrap">venue operations &amp;</span><br /><span className="mint-text">revenue capture</span></h1>
            <p className="hero-copy">Turn furniture, zones, and dayparts into pre-paid revenue—then run the floor, own the guest data, and know what is booked before the doors open.</p>
            <div className="hero-actions">
              <a className="button button-dark" href="#contact">Book a demo <Arrow /></a>
              <a className="button button-light" href="#platform">See the platform <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-device" aria-label="Clubtech mobile booking experience video">
            <video autoPlay muted loop playsInline preload="metadata" poster="/brand/clubtech-mark-black-white-bg.png">
              <source src="/video/clubtech-hero-mobile.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      <section className="trust shell section-tight" aria-label="Company proof">
        <p className="small-label">Founded in Singapore. Built for the venue floor.</p>
        <div className="proof-grid">
          {proof.map(([number, label]) => <div className="proof" key={number}><strong>{number}</strong><span>{label}</span></div>)}
        </div>
        <div className="client-row"><span>Trusted by</span><b>FINNS</b><b>Ravana</b><b>Luna</b><b>Sol</b><b>4Play</b><b>Kàvo</b><b>Barra Cuda</b><b>lasmari</b></div>
      </section>

      <section className="section shell" id="platform">
        <div className="section-heading split-heading">
          <div><p className="eyebrow">All in one platform</p><h2>Reservation. Floor. <span className="indigo-text">Marketing.</span></h2></div>
          <p>One platform connects the guest&apos;s first tap to the team running service—and the campaigns that bring them back.</p>
        </div>
        <div className="platform-grid">
          {platform.map(([n, title, body]) => <article className="platform-card" key={n}><span className="number">{n}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}
        </div>
      </section>

      <section className="section shell feature-row" id="booking">
        <div className="feature-copy">
          <p className="eyebrow">The signature booking journey</p>
          <h2>Guests buy the spot, <span className="indigo-text">not “a sunbed.”</span></h2>
          <p>The 3D birds-eye interactive map turns the venue into the product. Guests explore real zones, select exact furniture, stack add-ons, and commit before arrival.</p>
          <ul><li>Select the exact furniture</li><li>Preview the experience</li><li>Add products in the same flow</li><li>Confirm in four taps</li></ul>
        </div>
        <Placeholder type="Desktop" size="1200 × 900 px" />
      </section>

      <section className="section dark-section" id="operations">
        <div className="shell">
          <div className="section-heading light split-heading">
            <div><p className="eyebrow">Revenue at every touchpoint</p><h2>Make more from the <span className="mint-text">same seats.</span></h2></div>
            <p>Clubtech captures revenue before, during, and after the reservation—not only at checkout.</p>
          </div>
          <div className="lever-grid">
            {levers.map(([title, body], i) => <article className="lever" key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section shell feature-row reverse">
        <Placeholder type="Desktop" size="1200 × 900 px" />
        <div className="feature-copy">
          <p className="eyebrow">The operator console</p>
          <h2>Know what is booked <span className="indigo-text">before the doors open.</span></h2>
          <p>Set the inventory the team actually sells. Run allocation from a live venue map. Keep guest details, promotions, and reports inside the same operating loop.</p>
          <div className="mini-grid"><span>Live floor plan</span><span>Automatic allocation</span><span>Real-time inventory</span><span>Guest-list management</span></div>
        </div>
      </section>

      <section className="section shell mobile-story" id="guest-data">
        <div className="section-heading centered">
          <p className="eyebrow">Every guest. Not only the booker.</p>
          <h2>Own the whole <span className="indigo-text">customer journey.</span></h2>
          <p>The main booker invites the group. Every guest shares their own details before arrival. The venue&apos;s audience grows with every reservation.</p>
        </div>
        <div className="phones"><Placeholder type="Mobile" size="1170 × 2532 px" /><Placeholder type="Mobile" size="1170 × 2532 px" /><Placeholder type="Mobile" size="1170 × 2532 px" /></div>
      </section>

      <section className="section soft-section" id="intelligence">
        <div className="shell feature-row">
          <div className="feature-copy">
            <p className="eyebrow">Guest intelligence</p>
            <h2>Read the business <span className="indigo-text">before the patterns arrive too late.</span></h2>
            <p>See revenue by hour, booking lead time, product mix, origin markets, and repeat behavior across 20+ reports—without rebuilding the week in a spreadsheet.</p>
            <a className="button button-dark" href="#contact">See it in action <Arrow /></a>
          </div>
          <Placeholder type="Desktop" size="1440 × 900 px" />
        </div>
      </section>

      <section className="section shell" id="delivery">
        <div className="section-heading centered"><p className="eyebrow">Built around your venue</p><h2>From scope to a <span className="indigo-text">stronger operating loop.</span></h2><p>No one-size-fits-all package. A dedicated lead stays with the rollout from onboarding through optimization.</p></div>
        <div className="timeline">
          {delivery.map(([title, body], i) => <article key={title}><span>{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}
        </div>
      </section>

      <section className="section shell pricing" id="pricing">
        <div><p className="eyebrow">Aligned commercials</p><h2>No monthly fee.</h2><p>The platform grows when online revenue grows. Simple setup. Clear processing.</p></div>
        <div className="price-card"><span>Online processing</span><strong>4%</strong><p>Paid by the customer</p></div>
        <div className="price-card"><span>One-time setup</span><strong>$2,000</strong><p>Per venue, including configuration and staff training</p></div>
      </section>

      <section className="section shell quote-section">
        <blockquote>“We have grown from simple on-the-day bookings with no financial guarantee… to now having millions of dollars worth of pre-paid bookings each month.”</blockquote>
        <div className="quote-meta"><div className="avatar-placeholder" aria-hidden="true">Mobile image<br /><b>1080 × 1080 px</b></div><p><strong>Beau Whittington</strong><br />CEO, FINNS Beach Club</p></div>
      </section>

      <section className="section shell faq" id="faq">
        <div className="section-heading centered"><p className="eyebrow">FAQ</p><h2>Questions operators <span className="indigo-text">ask.</span></h2></div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details className="faq-item" key={q}>
              <summary><h3>{q}</h3><span className="faq-toggle" aria-hidden="true">+</span></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      </section>

      <section className="closing dark-section" id="contact">
        <img className="closing-mark" src="/brand/clubtech-mark-white.png" alt="" aria-hidden="true" />
        <div className="shell centered"><p className="eyebrow">Your venue, pre-sold.</p><h2>See what Saturday looks like <span className="mint-text">on Wednesday.</span></h2><p>Book a focused walkthrough, configured around a premium venue like yours.</p><a className="button button-mint" href="mailto:info@clubtechglobal.com">Book a demo <Arrow /></a></div>
      </section>

      <footer className="footer shell">
        <div className="footer-top"><a href="#top" className="brand"><img src="/brand/clubtech-wordmark-white.png" alt="Clubtech" /></a><div><a href="#platform">Platform</a><a href="#booking">Booking</a><a href="#operations">Operations</a><a href="#intelligence">Intelligence</a><a href="#pricing">Pricing</a><a href="https://www.clubtechglobal.com/blog">Blog</a><a href="mailto:info@clubtechglobal.com">Contact</a></div></div>
        <div className="footer-wordmark"><img src="/brand/clubtech-wordmark-white.png" alt="Clubtech" /></div>
        <p className="copyright">© 2026 Clubtech, Inc.</p>
      </footer>
    </main>
  );
}
