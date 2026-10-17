from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parent
html=(root/'home-page-reference.html').read_text(encoding='utf8')
checks=[]

def show_query(page, query):
    needle='const params=new URLSearchParams(location.search);'
    assert needle in html, 'Query initialization missing'
    document=html.replace(needle, f"const params=new URLSearchParams('?{query}');")
    page.set_content(document,wait_until='load')


def check(name,ok,detail=''):
    checks.append({'check':name,'ok':bool(ok),'detail':detail}); print(('PASS' if ok else 'FAIL'),name,detail)

with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for label,view in [('desktop',{'width':1536,'height':1024}),('mobile',{'width':390,'height':844})]:
    page=browser.new_page(viewport=view,device_scale_factor=1)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.set_content(html,wait_until='load');page.wait_for_timeout(120)
    # desktop + mobile primary view
    page.screenshot(path=str(root/f'home-hero-{label}.png'))
    w=page.evaluate('({client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth})')
    check(f'{label} no horizontal overflow',w['scroll']<=w['client'],str(w))
    check(f'{label} hero screenshot / title',page.locator('h1').inner_text()=='Главная страница')
    check(f'{label} no console errors',not errors,str(errors))
    page.get_by_role('tab',name='Секции').click()
    page.screenshot(path=str(root/f'home-sections-{label}.png'))
    check(f'{label} sections tab active',page.locator('#tab-sections').get_attribute('aria-selected')=='true')
    page.locator('#section-title').fill('Демо изменённая секция')
    check(f'{label} section dirty separate',not page.locator('#section-save').is_disabled() and page.locator('#parent-save').is_disabled())
    page.locator('#section-save').click()
    check(f'{label} independent section save',page.locator('.section-item.active strong').inner_text()=='Демо изменённая секция')
    page.get_by_role('tab',name='SEO').click()
    if label=='desktop':page.screenshot(path=str(root/'home-seo-desktop.png'))
    page.locator('#seo-title').fill('Новый SEO заголовок')
    check(f'{label} snippet reactive',page.locator('#snippet-title').inner_text()=='Новый SEO заголовок')
    check(f'{label} parent edit save enabled',not page.locator('#parent-save').is_disabled())
    page.locator('#parent-save').click()
    check(f'{label} parent save clears dirty',page.locator('#parent-save').is_disabled())
    page.get_by_role('tab',name='Первый экран').click()
    page.locator('#search-disclosure').click()
    check(f'{label} search group expands',page.locator('#search-details').is_visible())
    if label=='desktop':page.screenshot(path=str(root/'home-search-expanded.png'))
    check(f'{label} no page errors end',not errors,str(errors))
    page.close()
  page=browser.new_page(viewport={'width':1536,'height':1024});show_query(page,'tab=main');page.screenshot(path=str(root/'home-overview-desktop.png'));check('main tab reference shows core fields',page.locator('#main-h1').is_visible());page.close()
  page=browser.new_page(viewport={'width':1536,'height':1024});show_query(page,'tab=hero&state=conflict');page.screenshot(path=str(root/'home-conflict-desktop.png'));check('conflict state disables parent save',page.locator('#conflict-banner').is_visible());page.close()
  page=browser.new_page(viewport={'width':390,'height':844});show_query(page,'tab=hero&state=readonly');check('readonly disables fields',page.locator('#hero-title').is_disabled());page.close()
  page=browser.new_page(viewport={'width':390,'height':844});show_query(page,'state=empty');check('empty singleton shows no create action',page.get_by_text('Запись главной страницы не найдена').is_visible());page.close()
  for width in (320,350,430,768,1024):
    page=browser.new_page(viewport={'width':width,'height':900})
    page.set_content(html,wait_until='load')
    page.locator('#hero-title').fill('Длинный заголовок для проверки адаптивности ' * 5)
    dims=page.evaluate('({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})')
    check(f'{width}px long text stays in viewport',dims['client']>=dims['scroll'],str(dims))
    page.close()
  page=browser.new_page(viewport={'width':1536,'height':1024})
  page.set_content(html,wait_until='load')
  page.get_by_role('tab',name='Первый экран').focus()
  page.keyboard.press('ArrowRight')
  check('keyboard right selects sections',page.get_by_role('tab',name='Секции').get_attribute('aria-selected')=='true')
  page.locator('#versions-button').click()
  check('versions explains without publication',page.locator('#modal-root').is_visible() and page.get_by_role('dialog').is_visible())
  page.keyboard.press('Escape')
  check('versions dialog escape closes',not page.locator('#modal-root').is_visible())
  page.close()
  browser.close()

(root/'reference-checks.json').write_text(json.dumps({'checks':checks,'pass':sum(x['ok'] for x in checks),'fail':sum(not x['ok'] for x in checks)},ensure_ascii=False,indent=2),encoding='utf8')
if not all(x['ok'] for x in checks):raise SystemExit('failed checks')
