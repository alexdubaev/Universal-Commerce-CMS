"use client";

import { useMemo, useState } from "react";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({
  title,
  brand,
  sku,
  mainImage,
  images,
}: {
  title: string;
  brand: string;
  sku: string;
  mainImage?: string | null;
  images: ProductImage[];
}) {
  const gallery = useMemo(() => {
    const seen = new Set<string>();
    const result: ProductImage[] = [];
    if (mainImage) {
      seen.add(mainImage);
      result.push({ image: mainImage, alt_text: title });
    }
    for (const image of images) {
      if (!image.image || seen.has(image.image)) continue;
      seen.add(image.image);
      result.push(image);
    }
    return result;
  }, [images, mainImage, title]);

  const [selected, setSelected] = useState(0);
  const current = gallery[Math.min(selected, Math.max(0, gallery.length - 1))];

  if (!current) {
    return (
      <div className="product-placeholder product-placeholder-compact" aria-label={`Для ${brand} ${sku} фото не предоставлено`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
        <span>Фото не предоставлено</span>
      </div>
    );
  }

  return (
    <div className="product-gallery">
      <img
        className="product-main-image"
        src={`/api/assets/${current.image}`}
        alt={current.alt_text || title}
      />
      {gallery.length > 1 && (
        <div className="product-thumbs" aria-label="Галерея товара">
          {gallery.slice(0, 8).map((image, index) => (
            <button
              className={index === selected ? "active" : ""}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Показать изображение ${index + 1}`}
              aria-pressed={index === selected}
              key={image.image}
            >
              <img
                src={`/api/assets/${image.image}`}
                alt={image.alt_text || `${title}, изображение ${index + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
