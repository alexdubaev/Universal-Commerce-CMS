import type { Brand, Category, Product, SiteSettings } from "./types";

export const defaultSettings: SiteSettings = {
  company_name: "СМ ТЕХНО",
  phone: "+7 (800) 550-12-34",
  email: "sales@example.test",
  primary_cta_text: "Отправить заявку",
  primary_cta_url: "/request",
};

export const brands: Brand[] = [
  { slug: "caterpillar", name: "Caterpillar", description: "Запчасти для строительной и карьерной техники.", accent: "#f7c400" },
  { slug: "komatsu", name: "Komatsu", description: "Оригинальные и альтернативные решения для Komatsu.", accent: "#f7c400" },
  { slug: "volvo", name: "Volvo", description: "Запчасти для строительной техники Volvo CE.", accent: "#f7c400" },
  { slug: "hitachi", name: "Hitachi", description: "Компоненты для экскаваторов и карьерной техники Hitachi.", accent: "#f7c400" },
  { slug: "jcb", name: "JCB", description: "Запчасти для экскаваторов, погрузчиков и телескопической техники.", accent: "#f7c400" },
  { slug: "doosan", name: "Doosan", description: "Запчасти для экскаваторов и погрузчиков Doosan.", accent: "#f7c400" },
  { slug: "john-deere", name: "John Deere", description: "Запчасти для сельскохозяйственной и строительной техники.", accent: "#f7c400" },
  { slug: "cnh", name: "CNH", description: "Запчасти Case IH и New Holland.", accent: "#f7c400" },
  { slug: "claas", name: "CLAAS", description: "Каталог деталей для комбайнов и сельхозтехники.", accent: "#f7c400" },
  { slug: "perkins", name: "Perkins", description: "Компоненты и расходные материалы для двигателей.", accent: "#f7c400" },
  { slug: "sany", name: "SANY", description: "Запчасти для современной спецтехники SANY.", accent: "#f7c400" },
];

export const mockCategories: Category[] = [
  { slug:"filters", title:"Фильтры", description:"Масляные, топливные, воздушные и гидравлические фильтры.", is_indexable:true },
  { slug:"engine", title:"Двигатель", description:"Компоненты двигателей и навесного оборудования.", is_indexable:true },
  { slug:"cooling", title:"Охлаждение", description:"Радиаторы, насосы и маслоохладители.", is_indexable:true },
  { slug:"hydraulics", title:"Гидравлика", description:"Гидронасосы, клапаны, распределители и ремкомплекты.", is_indexable:true },
  { slug:"attachments", title:"Рабочее оборудование", description:"Ковши, зубья, стрелы и элементы рабочего оборудования.", is_indexable:true },
  { slug:"undercarriage", title:"Ходовая часть", description:"Катки, ролики, цепи и другие компоненты ходовой.", is_indexable:true },
  { slug:"fuel", title:"Топливная система", description:"Форсунки, насосы и компоненты топливной системы.", is_indexable:true },
  { slug:"transmission", title:"Трансмиссия", description:"Редукторы, подшипниковые узлы и компоненты привода.", is_indexable:true },
];

const rows: Array<Omit<Product, "id">> = [
  { slug:"cat-1r-1808", title:"Фильтр масляный", sku:"1R-1808", brand:"Caterpillar", short_description:"Масляный фильтр для тяжёлой техники Caterpillar.", full_description:"Демонстрационная карточка масляного фильтра Caterpillar. Реальное описание, применяемость и характеристики будут загружаться из Directus.", price:8450, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"original", category:{slug:"filters",title:"Фильтры"}, specifications:{Тип:"Масляный фильтр",Применение:"Двигатель",Страна:"США"}, seo_title:"Фильтр Caterpillar 1R-1808" },
  { slug:"cat-320-0600", title:"Турбокомпрессор", sku:"320-0600", brand:"Caterpillar", short_description:"Турбокомпрессор двигателя.", price:98500, currency:"RUB", price_status:"fixed", availability_status:"on_request", part_type:"oem", category:{slug:"engine",title:"Двигатель"}, specifications:{Тип:"Турбокомпрессор",Состояние:"Новый"} },
  { slug:"cat-223-7962", title:"Маслоохладитель", sku:"223-7962", brand:"Caterpillar", short_description:"Маслоохладитель для системы двигателя.", price:124000, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"original", category:{slug:"cooling",title:"Охлаждение"} },
  { slug:"komatsu-207-27-00310", title:"Гидронасос", sku:"207-27-00310", brand:"Komatsu", short_description:"Гидравлический насос в сборе.", price:285000, currency:"RUB", price_status:"fixed", availability_status:"on_request", part_type:"oem", category:{slug:"hydraulics",title:"Гидравлика"} },
  { slug:"komatsu-205-70-19570", title:"Зуб ковша", sku:"205-70-19570", brand:"Komatsu", short_description:"Износостойкий зуб рабочего оборудования.", price:6900, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"analog", category:{slug:"attachments",title:"Рабочее оборудование"} },
  { slug:"volvo-voe14550092", title:"Насос гидравлический", sku:"VOE14550092", brand:"Volvo", short_description:"Гидравлический компонент для строительной техники Volvo.", price:198000, currency:"RUB", price_status:"fixed", availability_status:"on_request", part_type:"oem", category:{slug:"hydraulics",title:"Гидравлика"} },
  { slug:"hitachi-4633600", title:"Фильтр гидравлический", sku:"4633600", brand:"Hitachi", short_description:"Фильтрующий элемент гидравлической системы.", price:7800, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"analog", category:{slug:"filters",title:"Фильтры"} },
  { slug:"jcb-320-04542", title:"Насос водяной", sku:"320/04542", brand:"JCB", short_description:"Водяной насос системы охлаждения.", price:12800, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"oem", category:{slug:"cooling",title:"Охлаждение"} },
  { slug:"jcb-332-l8078", title:"Элемент стрелы", sku:"332/L8078", brand:"JCB", short_description:"Элемент рабочего оборудования.", price:null, currency:"RUB", price_status:"on_request", availability_status:"on_request", part_type:"original", category:{slug:"attachments",title:"Рабочее оборудование"} },
  { slug:"doosan-400504-00215", title:"Ролик опорный", sku:"400504-00215", brand:"Doosan", short_description:"Компонент ходовой части экскаватора.", price:38500, currency:"RUB", price_status:"fixed", availability_status:"on_request", part_type:"analog", category:{slug:"undercarriage",title:"Ходовая часть"} },
  { slug:"jd-re568158", title:"Фильтр масляный", sku:"RE568158", brand:"John Deere", short_description:"Фильтр для техники John Deere.", full_description:"Демонстрационная карточка товара John Deere с дополнительными OEM-кодами и связанными позициями.", price:3200, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"original", category:{slug:"filters",title:"Фильтры"}, seo_title:"John Deere RE568158 — фильтр масляный" },
  { slug:"jd-dz121294", title:"Топливная форсунка", sku:"DZ121294", brand:"John Deere", short_description:"Форсунка топливной системы.", price:74200, currency:"RUB", price_status:"fixed", availability_status:"on_request", part_type:"original", category:{slug:"fuel",title:"Топливная система"} },
  { slug:"cnh-378410a1", title:"Фильтр топливный", sku:"378410A1", brand:"CNH", short_description:"Топливный фильтр для техники CNH.", price:6800, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"original", category:{slug:"filters",title:"Фильтры"} },
  { slug:"claas-0000550380", title:"Подшипниковый узел", sku:"0000550380", brand:"CLAAS", short_description:"Деталь привода сельскохозяйственной техники.", price:null, currency:"RUB", price_status:"on_request", availability_status:"on_request", part_type:"original", category:{slug:"transmission",title:"Трансмиссия"} },
  { slug:"perkins-2654403", title:"Фильтр топливный", sku:"2654403", brand:"Perkins", short_description:"Топливный фильтр двигателя Perkins.", price:4100, currency:"RUB", price_status:"fixed", availability_status:"in_stock", part_type:"original", category:{slug:"filters",title:"Фильтры"} },
  { slug:"sany-1903085", title:"Компонент ходовой части", sku:"1903085", brand:"SANY", short_description:"Запасная часть для ходовой системы.", price:null, currency:"RUB", price_status:"on_request", availability_status:"on_request", part_type:"original", category:{slug:"undercarriage",title:"Ходовая часть"} }
];

export const mockProducts: Product[] = rows.map((row, index) => ({ id: `mock-${index + 1}`, ...row }));

export function findBrand(slug: string) {
  return brands.find((brand) => brand.slug === slug);
}

export function brandToSlug(name: string) {
  return brands.find((brand) => brand.name.toLowerCase() === name.toLowerCase())?.slug
    ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
