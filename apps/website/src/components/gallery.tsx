import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/effect-creative';

import { Link } from '@tanstack/react-router';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import { A11y, Autoplay, EffectCreative, Keyboard } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

interface Entry {
  readonly id: string;
  readonly title: string;
  readonly alt: string;
  /** The widths each image was saved at, in pixels. */
  readonly full: readonly number[];
  readonly detail: readonly number[];
}

// scripts/screenshots.ts takes these from the web demo at every dev and build:
// a list, and for each shot the whole window and a crop a phone shows, each at
// a few widths for the browser to choose from.
const lists = import.meta.glob<Entry[]>('../assets/gallery/gallery.json', {
  eager: true,
  import: 'default',
});
const images = import.meta.glob<string>('../assets/gallery/*.webp', {
  eager: true,
  import: 'default',
});
/** A `srcset` of an image's widths, or nothing if one of them is missing. */
const set = (name: string, widths: readonly number[]) => {
  const urls = widths.map((w) => images[`../assets/gallery/${name}-${w}.webp`]);
  if (widths.length === 0 || urls.some((url) => !url)) return null;
  return {
    srcSet: urls.map((url, i) => `${url} ${widths[i]}w`).join(', '),
    src: urls.at(-1)!,
  };
};
const shots = (Object.values(lists)[0] ?? []).flatMap((entry) => {
  const full = set(entry.id, entry.full);
  const detail = set(`${entry.id}-detail`, entry.detail);
  return full && detail ? [{ ...entry, full, detail }] : [];
});

/** How wide a slide shows, as its frame below sets it. */
const SIZES = '(min-width: 640px) min(86vw, 72rem), 82vw';

/** It opens on the middle shot, with one either side. */
const START = Math.floor(shots.length / 2);

/** How long each shot shows while the gallery plays, in milliseconds. */
const DELAY = 5000;

/**
 * The shots either side of the current one wait at an angle, set back and
 * dimmed, as if on a curved wall, and swing round as they come forward.
 */
const side = (direction: 1 | -1) => ({
  translate: [`${direction * 90}%`, 0, -320] as [string, number, number],
  rotate: [0, direction * -28, 0] as [number, number, number],
  scale: 0.84,
  opacity: 0.45,
});

// Swiper's settings, made once: given new objects at each render, it would
// apply them again, and in the middle of a swipe that loses its place.
const modules = [A11y, Autoplay, EffectCreative, Keyboard];
const creative = { limitProgress: 2, perspective: true, prev: side(-1), next: side(1) };
const keyboard = { enabled: true, onlyInViewport: true };
const a11y = { containerMessage: 'Screenshots of Prism', slideRole: 'group' };
// A swipe or a pick restarts the wait rather than stopping it for good.
const autoplay = { delay: DELAY, disableOnInteraction: false };

/**
 * Where the creative effect puts the slide `i` places along while the middle
 * one is current, written into the server's page so it shows the carousel as
 * it will be, not a flat row that jumps once Swiper starts. Swiper sets the
 * same values when it does: each slide moved back over the ones before it, a
 * slide being as wide as the carousel, then to its side as `side` says.
 */
const placed = (i: number): React.CSSProperties => {
  const d = Math.max(-creative.limitProgress, Math.min(creative.limitProgress, i - START));
  const far = Math.abs(d);
  return {
    transform: `translate3d(${-i * 100 + d * 90}%, 0, ${-320 * far}px) rotateY(${-28 * d}deg) scale(${1 - 0.16 * far})`,
    opacity: Math.max(0, 1 - 0.55 * far),
    zIndex: shots.length - Math.abs(i - START),
  };
};

/**
 * Screenshots of Prism in a carousel that opens the interactive example on its
 * own page, so the home page does not load the web runtime for a visitor who
 * only reads. A phone shows the part of each that matters, and swipes.
 *
 * It moves on by itself while the page is scrolled to the top, unless the
 * visitor asked for less motion, and holds still once they scroll, to look
 * through it at their pace or to read on; and while the mouse or the keyboard
 * focus is on it, so a shot does not slide away as they reach for it.
 */
export function Gallery() {
  const [index, setIndex] = useState(START);
  const [playing, setPlaying] = useState(false);
  const swiper = useRef<SwiperClass | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  /** What holds the slideshow still, `view` being any scroll; it plays when nothing does. */
  const held = useRef({ view: true, hover: false, focus: false });

  /** Pauses or resumes the slideshow, as `held` says. */
  const sync = () => {
    const play = swiper.current?.autoplay;
    if (!play?.running) return;
    const { view, hover, focus } = held.current;
    const hold = view || hover || focus;
    if (hold && !play.paused) play.pause();
    else if (!hold && play.paused) play.resume();
  };
  const hold = (reason: keyof typeof held.current, value: boolean) => {
    held.current[reason] = value;
    sync();
  };

  useEffect(() => {
    const scrolled = () => hold('view', scrollY > 8);
    scrolled();
    addEventListener('scroll', scrolled, { passive: true });
    return () => removeEventListener('scroll', scrolled);
  }, []);

  if (shots.length === 0) return null;

  /** Keeps the current shot's label in view in the phone's scrolling row. */
  const reveal = (i: number) => {
    const list = row.current;
    const button = list?.children[i] as HTMLElement | undefined;
    if (list && button && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: button.offsetLeft - list.offsetLeft - 16, behavior: 'smooth' });
    }
  };

  const progress = (className: string) =>
    playing ? (
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 origin-left scale-x-(--progress) bg-current ${className}`}
      />
    ) : null;

  return (
    <div
      ref={root}
      style={{ '--progress': 0 } as React.CSSProperties}
      // Focus from the keyboard holds it; a click on a button does not.
      onFocus={(event) => hold('focus', event.target.matches(':focus-visible'))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hold('focus', false);
      }}
    >
      <div
        className="relative mx-auto w-[82%] max-w-6xl sm:w-[86%]"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') hold('hover', true);
        }}
        onPointerLeave={() => hold('hover', false)}
      >
        <Swiper
          modules={modules}
          effect="creative"
          creativeEffect={creative}
          // No loop: the first and the last are ends, and a drag past them
          // springs back. Only the slideshow goes round, back to the first.
          centeredSlides
          initialSlide={START}
          grabCursor
          slideToClickedSlide
          keyboard={keyboard}
          a11y={a11y}
          speed={800}
          autoplay={autoplay}
          // Its perspective before Swiper adds it, for the server's page.
          className="swiper-3d overflow-visible!"
          onSwiper={(instance) => {
            swiper.current = instance;
            reveal(START);
            if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
              instance.autoplay.stop();
              instance.params.speed = 0;
            }
            setPlaying(instance.autoplay.running);
            sync();
          }}
          onAutoplayStart={() => {
            setPlaying(true);
            sync();
          }}
          onAutoplayStop={() => setPlaying(false)}
          // Swiper resumes by itself once a slide comes to rest, scrolled or not.
          onAutoplayResume={sync}
          onAutoplayTimeLeft={(_, __, left) => {
            root.current?.style.setProperty('--progress', String(1 - left));
          }}
          onActiveIndexChange={(instance) => {
            setIndex(instance.activeIndex);
            reveal(instance.activeIndex);
          }}
        >
          {shots.map((shot, i) => (
            // A pixel of clear space round each slide puts its edge inside
            // what is drawn, where tilted it is smoothed, not on the edge of
            // the layer, where it shows steps.
            <SwiperSlide key={shot.id} className="p-px" style={placed(i)}>
              {/* Every slide is the same link, so nothing under a finger is
                  replaced as a slide comes forward mid-swipe. One at the side
                  is not tabbed to, and a click on it slides it forward. */}
              <Link
                to="/demo"
                aria-label={i === index ? 'Open interactive example' : shot.title}
                aria-hidden={i !== index}
                tabIndex={i === index ? 0 : -1}
                draggable={false}
                onClick={(event) => {
                  if (i !== index) event.preventDefault();
                }}
                className={`group/open relative block aspect-[4/3] overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 shadow-black/20 ring-fd-foreground/10 focus-visible:outline-none sm:aspect-video dark:shadow-black/60 ${i === index ? '' : 'cursor-pointer'}`}
              >
                <picture>
                  <source media="(max-width: 639px)" srcSet={shot.detail.srcSet} sizes={SIZES} />
                  <img
                    src={shot.full.src}
                    srcSet={shot.full.srcSet}
                    sizes={SIZES}
                    alt={shot.alt}
                    width={2560}
                    height={1440}
                    draggable={false}
                    className="size-full object-cover"
                  />
                </picture>
                <span
                  className={buttonVariants({
                    variant: 'primary',
                    className: `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 gap-2 whitespace-nowrap px-3 py-2 text-xs shadow-lg transition-opacity duration-300 group-hover/open:bg-fd-primary/90 group-focus-visible/open:ring-2 group-focus-visible/open:ring-fd-ring sm:px-5 sm:py-3 sm:text-base ${i === index ? 'opacity-100' : 'opacity-0'}`,
                  })}
                >
                  <Play aria-hidden className="size-4" />
                  Open interactive example
                </span>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div
        ref={row}
        role="group"
        aria-label="Choose a screenshot"
        className="mx-auto mt-6 flex max-w-6xl snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:grid sm:w-[86%] sm:grid-cols-5 sm:items-start sm:gap-3 sm:overflow-visible sm:px-0"
      >
        {shots.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={i === index}
            onClick={() => swiper.current?.slideTo(i)}
            className="group/shot relative shrink-0 cursor-pointer snap-start overflow-hidden rounded-full border px-3 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:outline-none aria-pressed:border-fd-primary aria-pressed:bg-fd-primary aria-pressed:text-fd-primary-foreground sm:overflow-visible sm:rounded-xl sm:border-0 sm:p-0 sm:text-left sm:aria-pressed:bg-transparent sm:aria-pressed:text-fd-foreground"
          >
            <span className="relative mb-2 hidden overflow-hidden rounded-lg ring-1 ring-fd-foreground/10 group-aria-pressed/shot:ring-2 group-aria-pressed/shot:ring-fd-primary sm:block">
              <img
                src={item.full.src}
                srcSet={item.full.srcSet}
                sizes="(min-width: 640px) 16vw, 1px"
                alt=""
                loading="lazy"
                width={2560}
                height={1440}
                className="aspect-video w-full object-cover opacity-70 transition-opacity group-hover/shot:opacity-100 group-aria-pressed/shot:opacity-100"
              />
              {i === index ? progress('h-1 text-fd-primary') : null}
            </span>
            {/* One line, whichever is active, so the row never changes height. */}
            <span className="block truncate">{item.title}</span>
            {i === index ? progress('h-0.5 opacity-50 sm:hidden') : null}
          </button>
        ))}
      </div>
    </div>
  );
}
