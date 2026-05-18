import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Testimonial {
  quote: string;
  firstName: string;
  lastInitial: string;
  role: string;
  company: string;
  initials: string;
  avatarSrc?: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      'With better coding models, planning is where most of the dev time should be spent nowadays. PlanBridge makes that experience 10X better and thus increased my productivity.',
    firstName: 'Alex',
    lastInitial: 'B',
    role: 'Co-founder / CTO',
    company: 'Fanstake',
    initials: 'AB',
    avatarSrc: '/testimonials/alex_b.jpeg',
  },
  {
    quote: 'Opening up a browser with the ability to comment inline is awesome! Highly recommend PlanBridge.',
    firstName: 'Gururaj',
    lastInitial: 'S',
    role: 'Chief Product Officer',
    company: 'LeadLabs',
    initials: 'GS',
    avatarSrc: '/testimonials/guru.jpeg',
  },
  {
    quote:
      "I'd recommend this for any engineer that believes planning is the new point of leverage in agentic engineering",
    firstName: 'Larry',
    lastInitial: 'O',
    role: 'Distinguished Engineer',
    company: 'Homebound',
    initials: 'LO',
    avatarSrc: '/testimonials/larry_o.jpeg',
  },
  {
    quote:
      '[PlanBridge] is very convenient. It was so hard before to make comments to the various pieces in the plan to get it adjusted. And hard to read in the CLI.',
    firstName: 'Jacob',
    lastInitial: 'B',
    role: 'VP Engineering',
    company: 'Stellarus',
    initials: 'JB',
    avatarSrc: '/testimonials/jacob_b.jpeg',
  },
  {
    quote:
      "PlanBridge lets me get more quality iterations on a plan in half the time. Reviewing inline like a GitHub PR means I'm not pasting markdown into my Codex terminal like a savage.",
    firstName: 'Alex',
    lastInitial: 'K',
    role: 'Co-founder / CTO',
    company: 'Parallax',
    initials: 'AK',
  },
  {
    quote:
      'I think [PlanBridge] is really cool. My team is adopting it and I am going to tell everyone to start using it.',
    firstName: 'Sean',
    lastInitial: 'M',
    role: 'Director of Analytics',
    company: 'Gamechanger',
    initials: 'SM',
    avatarSrc: '/testimonials/sean_m.jpeg',
  },
];

export default function UserQuotes() {
  const [activePage, setActivePage] = useState(0);
  const [pageSize, setPageSize] = useState(3);
  const pageCount = Math.ceil(testimonials.length / pageSize);
  const canRotate = pageCount > 1;
  const activeTestimonials = useMemo(
    () => testimonials.slice(activePage * pageSize, activePage * pageSize + pageSize),
    [activePage, pageSize],
  );
  const gridColumnsClass =
    activeTestimonials.length === 1
      ? 'md:grid-cols-1'
      : activeTestimonials.length === 2
        ? 'md:grid-cols-2'
        : 'md:grid-cols-3';

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const applyPageSize = () => setPageSize(query.matches ? 3 : 1);
    applyPageSize();
    query.addEventListener('change', applyPageSize);
    return () => query.removeEventListener('change', applyPageSize);
  }, []);

  useEffect(() => {
    setActivePage(0);
  }, [pageSize]);

  const showPrevious = () => {
    setActivePage((current) => (current - 1 + pageCount) % pageCount);
  };

  const showNext = () => {
    setActivePage((current) => (current + 1) % pageCount);
  };

  return (
    <section className="border-t border-foreground bg-background px-8 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-base font-bold uppercase tracking-[0.16em] text-foreground">Testimonials</p>
            <h2 className="mt-8 max-w-5xl font-medium leading-[1.0] tracking-tight text-foreground text-[40px] sm:text-[64px] lg:text-[80px]">
              Engineers love PlanBridge
            </h2>
          </div>

          {canRotate && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={showPrevious}
                className="inline-flex h-12 w-12 items-center justify-center border border-foreground bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                aria-label="Show previous testimonial page"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={showNext}
                className="inline-flex h-12 w-12 items-center justify-center border border-foreground bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                aria-label="Show next testimonial page"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-10 h-px w-full bg-foreground sm:mt-16"></div>

        <div className={`mt-10 grid grid-cols-1 gap-px bg-foreground sm:mt-16 ${gridColumnsClass}`} aria-live="polite">
          {activeTestimonials.map((testimonial) => (
            <figure
              key={`${testimonial.firstName}-${testimonial.lastInitial}-${testimonial.company}`}
              className="m-0 flex min-h-[22rem] flex-col justify-between bg-background p-6 transition-opacity duration-200 sm:p-8 md:min-h-[28rem]"
            >
              <blockquote className="m-0 font-mono text-xl font-bold leading-tight text-foreground sm:text-2xl">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-12 flex items-center gap-5 border-t border-foreground pt-8">
                <Avatar testimonial={testimonial} />
                <span className="font-sans text-base leading-relaxed text-foreground">
                  <span className="block font-mono text-xl font-bold">
                    {testimonial.firstName} {testimonial.lastInitial}.
                  </span>
                  <span className="block">{testimonial.role}</span>
                  <span className="block">{testimonial.company}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        {canRotate && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActivePage(index)}
                className={`h-3 w-3 border border-foreground ${
                  activePage === index ? 'bg-foreground' : 'bg-background'
                }`}
                aria-label={`Show testimonial page ${index + 1} of ${pageCount}`}
                aria-current={activePage === index ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Avatar({ testimonial }: { testimonial: Testimonial }) {
  if (testimonial.avatarSrc) {
    return (
      <img
        src={testimonial.avatarSrc}
        alt=""
        className="h-20 w-20 flex-shrink-0 rounded-full border border-foreground object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <span
      className="inline-flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-foreground bg-muted font-mono text-xl font-bold text-foreground"
      aria-hidden="true"
    >
      {testimonial.initials}
    </span>
  );
}
