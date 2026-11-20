// 站点样式：文章按网站原样渲染。取文章页时顺带收集页面里的 CSS，
// 把选择器限定到 .pc-site 之下（不影响 App 自己的界面），存到本机供离线使用
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { fetchText } from './site.js';

const STYLE_FILE = 'catalog/site-style.css';
const MAX_AGE = 6 * 60 * 60 * 1000;
export const SCOPE = '.pc-site';

// 按顶层逗号拆选择器列表（括号里的逗号不拆，如 :is(a, b)）
function splitSelectors(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts.map((s) => s.trim()).filter(Boolean);
}

// html / body / :root 都映射到 .pc-site 本身；紧跟的 .class、:pseudo 仍挂在它身上（如 html.css-loaded → .pc-site.css-loaded）
function scopeSelector(sel) {
  let rest = sel;
  let compound = '';
  let matched = false;
  for (;;) {
    const m = rest.match(/^(html|body|:root)(?![\w-])((?:[.#:[][^\s>+~]*)?)\s*(>\s*)?/);
    if (!m) break;
    matched = true;
    compound += m[2];
    rest = rest.slice(m[0].length);
  }
  if (!matched) return `${SCOPE} ${sel}`;
  return rest ? `${SCOPE}${compound} ${rest}` : `${SCOPE}${compound}`;
}

function scopeRules(rules) {
  const out = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      out.push(`${splitSelectors(rule.selectorText).map(scopeSelector).join(', ')} { ${rule.style.cssText} }`);
    } else if (rule instanceof CSSMediaRule) {
      out.push(`@media ${rule.conditionText} { ${scopeRules(rule.cssRules).join('\n')} }`);
    } else if (rule instanceof CSSSupportsRule) {
      out.push(`@supports ${rule.conditionText} { ${scopeRules(rule.cssRules).join('\n')} }`);
    } else if (rule instanceof CSSKeyframesRule || rule instanceof CSSFontFaceRule) {
      out.push(rule.cssText);
    }
  }
  return out;
}

export function scopeCss(text) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text.replace(/@import[^;]+;/g, ''));
  return scopeRules(sheet.cssRules).join('\n');
}

class SiteStyle {
  constructor() {
    this.css = '';
    this.fetchedAt = 0;
  }

  async load() {
    try {
      const { data } = await Filesystem.readFile({ path: STYLE_FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
      const cached = JSON.parse(data);
      this.css = cached.css;
      this.fetchedAt = cached.fetchedAt;
    } catch (e) {
      // 还没取过文章
    }
  }

  get stale() {
    return !this.css || Date.now() - this.fetchedAt > MAX_AGE;
  }

  // doc：已解析的文章页。外链样式表按页面顺序取回，与页内 <style> 一起限定作用域
  async refreshFrom(doc) {
    const sources = [];
    for (const node of doc.querySelectorAll('link[rel="stylesheet"], link[as="style"], style')) {
      if (node.tagName === 'STYLE') {
        sources.push(Promise.resolve(node.textContent));
      } else {
        const href = node.getAttribute('href');
        if (!href || /^(https?:)?\/\//.test(href)) continue;
        sources.push(fetchText(href.split('?')[0]).catch(() => ''));
      }
    }
    const css = scopeCss((await Promise.all(sources)).join('\n'));
    if (!css) return;
    this.css = css;
    this.fetchedAt = Date.now();
    await Filesystem.writeFile({
      path: STYLE_FILE, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true,
      data: JSON.stringify({ fetchedAt: this.fetchedAt, css }),
    });
  }

  apply() {
    let el = document.getElementById('pc-site-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'pc-site-style';
      document.head.appendChild(el);
    }
    if (el.textContent !== this.css) el.textContent = this.css;
  }
}

export const siteStyle = new SiteStyle();
