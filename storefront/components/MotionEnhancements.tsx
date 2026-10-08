"use client";

import { useEffect } from "react";

export function MotionEnhancements() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const observed = new WeakSet<Element>();
    const observeContent = () => {
      if (!observer) return;
      const elements = document.querySelectorAll<HTMLElement>(".scroll-reveal");
      for (const element of elements) {
        if (observed.has(element)) continue;
        observed.add(element);
        element.setAttribute("data-motion-ready", "true");
        observer?.observe(element);
      }
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          entry.target.removeAttribute("data-motion-ready");
          observer?.unobserve(entry.target);
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
      observeContent();
    }

    // Adapted from 21st.dev ScrollExpandMedia's disclosed MIT scrollProgress clamp:
    // https://21st.dev/@arunachalam/components/scroll-expansion-hero
    const updateHero = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hero = document.querySelector<HTMLElement>(".hero");
        if (!hero) return;
        const distance = Math.max(hero.offsetHeight * 0.9, 1);
        const progress = Math.min(Math.max(window.scrollY / distance, 0), 1);
        hero.style.setProperty("--hero-scroll-progress", progress.toFixed(3));
      });
    };
    const mutations = new MutationObserver(observeContent);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", updateHero, { passive: true });
    updateHero();
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("scroll", updateHero);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
