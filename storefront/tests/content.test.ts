import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directusFetch: vi.fn(),
}));

vi.mock("../lib/directus", () => ({
  allowMockFallback: () => false,
  isMockMode: () => false,
  directusFetch: mocks.directusFetch,
}));

import {
  getCmsHome,
  getCmsPage,
  getCmsSiteSettings,
  getNavigation,
} from "../lib/content";

describe("CMS content adapter", () => {
  beforeEach(() => {
    mocks.directusFetch.mockReset();
  });

  it("maps Directus singleton site_settings returned as an object", async () => {
    mocks.directusFetch.mockResolvedValueOnce({
      data: {
        company_name: "СМ ТЕХНО",
        phone: "+7 900 000-00-00",
        email: "sales@example.test",
        primary_cta_text: "Заявка",
        primary_cta_url: "/request",
        city: "Санкт-Петербург",
        inn: "1234567890",
      },
    });

    const settings = await getCmsSiteSettings();
    expect(settings.company_name).toBe("СМ ТЕХНО");
    expect(settings.city).toBe("Санкт-Петербург");
    expect(settings.inn).toBe("1234567890");
  });

  it("drops unsafe navigation URLs instead of rewriting them", async () => {
    mocks.directusFetch.mockResolvedValueOnce({
      data: [
        { id: "1", label: "Каталог", url: "/catalog", location: "header" },
        { id: "2", label: "Bad", url: "javascript:alert(1)", location: "header" },
      ],
    });

    const navigation = await getNavigation("header");
    expect(navigation).toEqual([
      expect.objectContaining({ label: "Каталог", url: "/catalog" }),
    ]);
  });

  it("loads a published page and its visible sections", async () => {
    mocks.directusFetch
      .mockResolvedValueOnce({
        data: [{
          id: "page-1",
          title: "Доставка",
          slug: "delivery",
          page_type: "delivery",
          h1: "Доставка по России",
          intro: "Условия поставки",
          is_indexable: true,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          id: "section-1",
          section_type: "steps",
          title: "Как мы работаем",
          text: "Четыре шага",
          is_visible: true,
        }],
      });

    const page = await getCmsPage("delivery");
    expect(page?.h1).toBe("Доставка по России");
    expect(page?.sections).toHaveLength(1);
    expect(page?.sections[0]).toMatchObject({
      section_type: "steps",
      title: "Как мы работаем",
    });
  });

  it("maps published home singleton and sections", async () => {
    mocks.directusFetch
      .mockResolvedValueOnce({
        data: {
          id: "home-1",
          status: "published",
          h1: "Главная",
          hero_title: "Найдём нужную деталь",
          hero_text: "Поиск по артикулу",
          hero_search_placeholder: "Артикул или OEM",
          is_indexable: true,
        },
      })
      .mockResolvedValueOnce({
        data: [{
          id: "home-section-1",
          section_type: "cta",
          title: "Есть список?",
          button_text: "Отправить",
          button_url: "/request",
        }],
      });

    const home = await getCmsHome();
    expect(home?.hero_title).toBe("Найдём нужную деталь");
    expect(home?.sections[0]).toMatchObject({
      section_type: "cta",
      button_url: "/request",
    });
  });

  it("does not expose a draft home page", async () => {
    mocks.directusFetch.mockResolvedValueOnce({
      data: {
        id: "home-1",
        status: "draft",
        h1: "Draft",
        hero_title: "Draft",
        hero_text: "Draft",
      },
    });

    await expect(getCmsHome()).resolves.toBeNull();
  });
});
