import React, { useEffect, useRef, useState } from 'react';

interface ParallaxImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Fraction of scroll distance the image lags behind (0 = static, ~0.15 = noticeable) */
  speed?: number;
}

/**
 * Scroll-parallax image for full-bleed hero backdrops.
 *
 * MUST be placed inside a `position: relative/absolute` + `overflow: hidden`
 * parent. The image is rendered 130% tall, anchored 15% above the top, so
 * downward drift never reveals a gap. Finds the nearest scrollable ancestor
 * (music shell <main>, or window) and translates on scroll via rAF.
 */
export const ParallaxImage: React.FC<ParallaxImageProps> = ({ speed = 0.15, style, className = '', ...imgProps }) => {
  const ref = useRef<HTMLImageElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let scroller: HTMLElement | null = null;
    let node = el.parentElement;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 4) {
        scroller = node;
        break;
      }
      node = node.parentElement;
    }
    const maxDrift = 80; // px — always inside the 15% overscan

    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
      const rect = el.getBoundingClientRect();
      const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const visible = rect.bottom > viewTop && rect.top < viewTop + window.innerHeight;
      setOffset(visible ? Math.min(scrollTop * speed, maxDrift) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

    update();
    if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });
    else window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (scroller) scroller.removeEventListener('scroll', onScroll);
      else window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [speed]);

  return (
    <img
      ref={ref}
      {...imgProps}
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '-15%',
        height: '130%',
        width: '100%',
        objectFit: 'cover',
        transform: `translateY(${offset}px)`,
        willChange: 'transform',
        ...style,
      }}
    />
  );
};

export default ParallaxImage;
