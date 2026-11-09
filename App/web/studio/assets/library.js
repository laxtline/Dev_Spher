/* Offline study library. No CDN, framework, build step, or account required. */
'use strict';
window.CODELAB_OFFLINE_PACKS ||= {};
const OfflineLibrary = {
  catalog: window.CODELAB_OFFLINE_CATALOG,
  page: 0, pageSize: 40, selected: null, tab: 'statement', solutionIndex: 0,
  filters: {search:'', difficulty:'', source:'', language:'', status:''},
  loads: new Map(), worker: null,
  h(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  label(lang) { return ({python:'Python',javascript:'JavaScript',cpp:'C++',c:'C',java:'Java',sql:'SQL',rust:'Rust'})[lang] || lang; },
  source(id) { return this.catalog.sources.find(s => s.id === id)?.label || id; },
  state() { return Store.get('library_progress', {}); },
  advancedHeader(){
    App.mode='advanced';document.body.dataset.mode='advanced';document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode==='advanced'));
    const bar=document.createElement('nav');bar.className='advanced-workspace-nav';bar.setAttribute('aria-label','Advanced workspace');
    bar.innerHTML='<strong>Advanced</strong><button class="btn-ghost" onclick="App.setMode(\'advanced\')">Coding problems</button><button class="btn-ghost" onclick="App.setMode(\'advanced\');Academy.setCodingCategory(\'dsa\')">DSA &amp; roadmaps</button><button class="btn-primary" aria-current="page" onclick="Navigation.open({view:\'library\'})">Offline Library</button>';
    this.root.querySelector('.advanced-workspace-nav')?.remove();this.root.prepend(bar);
  },
  cacheName(){return 'codelab-library-v2-'+encodeURIComponent(new URL('./',document.baseURI).pathname)+'-'+this.catalog.revision;},
  init() {
    this.root = document.getElementById('view-library');
    this.root.addEventListener('click', event => {
      const button = event.target.closest('[data-lib-action]');
      if (!button) return;
      const action = button.dataset.libAction;
      if (action === 'open') this.open(button.dataset.key);
      else if (action === 'back') { if(typeof Navigation!=='undefined')Navigation.open({view:'library'});else{history.replaceState(null, '', '#library');this.render();} }
      else if (action === 'page') { this.page += Number(button.dataset.delta); this.results(); this.root.scrollTop = 0; }
      else if (action === 'star') this.toggleStar(button.dataset.key);
      else if (action === 'tab') { this.tab = button.dataset.tab; this.reader(); }
      else if (action === 'review') this.toggleReviewed();
      else if (action === 'copy') copyText(this.currentSolution().code, 'Solution copied');
      else if (action === 'download') { const s = this.currentSolution(); download(s.name, s.code, 'text/plain'); }
      else if (action === 'draft-download') download(this.selected.key + '.txt', this.draft(), 'text/plain');
      else if (action === 'offline') this.saveOffline();
      else if (action === 'sources') this.showSources();
      else if (action === 'export') DataIO.exportProgress();
      else if (action === 'license') { const p=button.dataset.path; download(p.split('/').pop(),window.CODELAB_INLINE_LICENSES[p],'text/plain'); }
    });
    this.root.addEventListener('input', event => {
      const el = event.target;
      if (el.dataset.filter) { this.filters[el.dataset.filter] = el.value; this.page = 0; this.results(); }
      if (el.id === 'lib-draft') this.saveText('draft', el.value);
      if (el.id === 'lib-notes') this.saveText('notes', el.value);
    });
    this.root.addEventListener('change', event => {
      const el = event.target;
      if (el.dataset.filter) { this.filters[el.dataset.filter] = el.value; this.page = 0; this.results(); }
      if (el.id === 'lib-solution') { this.solutionIndex = Number(el.value); this.reader(); }
      if (el.id === 'lib-document') { this.documentIndex = Number(el.value); this.reader(); }
    });
    const resize = () => document.documentElement.style.setProperty('--nav-height', document.getElementById('navbar').offsetHeight + 'px');
    new ResizeObserver(resize).observe(document.getElementById('navbar'));
    resize();
    if (!window.CODELAB_STANDALONE && 'serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
      this.registrationPromise = navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).catch(() => null);
    }
    if (location.hash.startsWith('#library')) this.routeHash();
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#library') && Router.current !== 'library') Router.go('library');
      if (location.hash.startsWith('#library/')) this.routeHash();
      else if (location.hash === '#library' && this.selected) this.render();
    });
  },
  routeHash() {
    const hash = location.hash;
    if (Router.current !== 'library') Router.go('library');
    const key = hash.slice('#library/'.length);
    if (hash.startsWith('#library/') && this.catalog.entries.some(e => e.key === key) && this.selected?.key !== key) this.open(key);
  },
  render() {
    this.openToken = {};
    this.selected = null;
    const h = v => this.h(v), stats = this.catalog.stats;
    const options = (values, selected, labels = v => v) => values.map(v => `<option value="${h(v)}" ${v === selected ? 'selected' : ''}>${h(labels(v))}</option>`).join('');
    const languages = [...new Set(this.catalog.entries.flatMap(e => e.languages))].sort();
    this.root.innerHTML = `<div class="lib-top"><div><div class="lib-eyebrow">Your local study collection</div><h1>Offline Library</h1><p class="lib-muted">Problem statements, reference solutions, and a space to work through your approach.</p></div><div class="lib-actions">${window.CODELAB_STANDALONE?'<span class="lib-status">Single HTML edition · library embedded</span>':'<a class="btn-ghost" href="CodeLab-Offline.html" download>Download single HTML</a>'}<button class="btn-ghost" data-lib-action="sources">Sources</button><button class="btn-ghost" data-lib-action="export">Export progress</button><button class="btn-primary lib-offline-button" data-lib-action="offline">Save for offline</button></div></div>
      <p class="lib-status" id="lib-cache-status" role="status"></p>
      <div class="lib-stats"><div><strong>${stats.entries.toLocaleString()}</strong><span>study entries</span></div><div><strong>${stats.solutions.toLocaleString()}</strong><span>unique solutions</span></div><div><strong>${languages.length}</strong><span>languages</span></div><div><strong>${stats.images}</strong><span>local diagrams</span></div><div><strong id="lib-reviewed-count">${Object.values(this.state()).filter(s => s.reviewed).length}</strong><span>reviewed by you</span></div></div>
      <div class="lib-filters"><input type="search" aria-label="Search offline library" data-filter="search" placeholder="Search by title, LeetCode ID, or topic…" value="${h(this.filters.search)}">
      <select aria-label="Filter difficulty" data-filter="difficulty"><option value="">All difficulties</option>${options(['Easy','Medium','Hard','Unknown'], this.filters.difficulty)}</select>
      <select aria-label="Filter source" data-filter="source"><option value="">All sources</option>${options(this.catalog.sources.map(s => s.id), this.filters.source, v => this.source(v))}</select>
      <select aria-label="Filter language" data-filter="language"><option value="">All languages</option>${options(languages, this.filters.language, v => this.label(v))}</select>
      <select aria-label="Filter progress" data-filter="status"><option value="">All progress</option>${options(['bookmarked','reviewed','unreviewed'], this.filters.status)}</select></div>
      <div id="lib-result-summary" class="lib-muted" role="status"></div><div id="lib-results" class="lib-results" style="margin-top:10px"></div><div id="lib-pagination" class="lib-pager"></div>
      <p class="lib-muted">Reference collection · Imported entries do not have automatic grading. Use Problems for judged exercises.</p>`;
    this.results();
    this.cacheStatus(this.offlineMessage || (location.protocol === 'file:' ? 'Local folder · All bundled reading assets are available on disk.' : navigator.onLine ? 'Save the full collection on this device before going offline.' : 'Offline · You can open entries previously saved on this device.'));
  },
  filtered() {
    const f = this.filters, state = this.state();
    const query = f.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return this.catalog.entries.filter(e => query.every(term => `${e.number || ''} ${e.title} ${e.tags.join(' ')}`.toLowerCase().includes(term)) &&
      (!f.difficulty || e.difficulty === f.difficulty) && (!f.source || e.sources.includes(f.source)) &&
      (!f.language || e.languages.includes(f.language)) && (!f.status ||
      (f.status === 'bookmarked' ? state[e.key]?.star : f.status === 'reviewed' ? state[e.key]?.reviewed : !state[e.key]?.reviewed)));
  },
  results() {
    const list = this.filtered(), state = this.state(), h = v => this.h(v);
    this.page = Math.max(0, Math.min(this.page, Math.ceil(list.length / this.pageSize) - 1));
    const first = this.page * this.pageSize, rows = list.slice(first, first + this.pageSize);
    document.getElementById('lib-result-summary').textContent = `${list.length.toLocaleString()} entries found`;
    document.getElementById('lib-results').innerHTML = rows.length ? `<table class="lib-table"><thead><tr><th aria-label="Bookmark">★</th><th>Problem / topic</th><th>Difficulty</th><th class="lib-language-col">Solutions</th></tr></thead><tbody>${rows.map(e => `<tr><td><button class="lib-star" data-lib-action="star" data-key="${e.key}" aria-label="Bookmark ${h(e.title)}" aria-pressed="${!!state[e.key]?.star}">${state[e.key]?.star ? '★' : '☆'}</button></td><td><button class="lib-title-button" data-lib-action="open" data-key="${e.key}">${e.number ? e.number + '. ' : ''}${h(e.title)}${state[e.key]?.reviewed ? ' ✓' : ''}</button><div class="lib-row-meta">${e.sources.map(s => h(this.source(s))).join(' · ')}${!e.hasStatement ? ' · Solution only' : ''}</div></td><td><span class="badge ${h(e.difficulty)}">${h(e.difficulty === 'Unknown' ? 'Unspecified' : e.difficulty)}</span></td><td class="lib-language-col"><div>${e.languages.map(v => h(this.label(v))).join(' · ') || 'Reading'}</div><div class="lib-row-meta">${e.solutionCount} solution${e.solutionCount === 1 ? '' : 's'}</div></td></tr>`).join('')}</tbody></table>` : '<div class="lib-empty">No matches. Try a different search or clear a filter.</div>';
    document.getElementById('lib-pagination').innerHTML = `<span class="lib-muted">${list.length ? first + 1 : 0}–${Math.min(first + this.pageSize, list.length)} of ${list.length}</span><div class="lib-actions"><button class="btn-ghost" data-lib-action="page" data-delta="-1" ${this.page === 0 ? 'disabled' : ''}>← Previous</button><button class="btn-ghost" data-lib-action="page" data-delta="1" ${first + this.pageSize >= list.length ? 'disabled' : ''}>Next →</button></div>`;
    document.getElementById('lib-reviewed-count').textContent = Object.values(state).filter(s => s.reviewed).length;
  },
  async load(entry) {
    if (window.CODELAB_OFFLINE_PACKS[entry.key]) return window.CODELAB_OFFLINE_PACKS[entry.key];
    if (!this.loads.has(entry.chunk)) {
      this.loads.set(entry.chunk, new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = entry.chunk;
        script.onload = () => { script.remove(); resolve(); };
        script.onerror = () => { script.remove(); this.loads.delete(entry.chunk); reject(new Error('This pack is not saved on this device. Reconnect and choose Save for offline, or open the downloaded project folder.')); };
        document.head.appendChild(script);
      }));
    }
    await this.loads.get(entry.chunk);
    const result = window.CODELAB_OFFLINE_PACKS[entry.key];
    if (!result) throw new Error('Pack does not match the catalog. Reload to update the library.');
    return result;
  },
  async open(key) {
    const entry = this.catalog.entries.find(e => e.key === key);
    if (!entry) return;
    const token = this.openToken = {};
    this.root.innerHTML = '<div class="lib-empty" role="status">Opening study entry…</div>';
    try {
      const record = await this.load(entry);
      if (this.openToken !== token || Router.current !== 'library') return;
      this.selected = record; this.tab = record.documents.length ? 'statement' : 'solutions';
      this.solutionIndex = 0; this.documentIndex = 0;
      if(typeof Navigation!=='undefined')Navigation.record({view:'library',arg:key});else history.replaceState(null, '', '#library/' + key);
      this.reader(); this.root.scrollTop = 0;
    } catch (error) {
      if (this.openToken !== token || Router.current !== 'library') return;
      this.root.innerHTML = `<button class="btn-ghost" data-lib-action="back">← Library</button><p class="lib-note" role="alert">${this.h(error.message)}</p><button class="btn-ghost" data-lib-action="open" data-key="${key}">Retry</button>`;
    }
  },
  toggleStar(key) {
    const state = this.state(); state[key] = {...state[key], star:!state[key]?.star}; Store.set('library_progress', state);
    if (this.selected) this.reader(); else this.results();
  },
  toggleReviewed() {
    const key = this.selected.key, state = this.state(); state[key] = {...state[key], reviewed:!state[key]?.reviewed};
    Store.set('library_progress', state); this.reader();
  },
  currentSolution() { return this.selected.solutions[this.solutionIndex]; },
  draft() { return Store.getRaw('library_draft_' + this.selected.key, ''); },
  saveText(kind, text) { Store.setRaw('library_' + kind + '_' + this.selected.key, text); },
  reader() {
    const r = this.selected; if (!r) return;
    const h = v => this.h(v), state = this.state()[r.key] || {};
    const tabs = [['statement','Reading'],['solutions',`Solutions (${r.solutions.length})`],['practice','My workspace']];
    this.root.innerHTML = `<div class="lib-reader"><button class="btn-ghost" data-lib-action="back">← Back to library</button><h1>${r.number ? r.number + '. ' : ''}${h(r.title)}</h1><div class="lib-actions"><span class="badge ${h(r.difficulty)}">${h(r.difficulty === 'Unknown' ? 'Difficulty unspecified' : r.difficulty)}</span><button class="btn-ghost" data-lib-action="star" data-key="${r.key}" aria-pressed="${!!state.star}">${state.star ? '★ Bookmarked' : '☆ Bookmark'}</button><button class="btn-ghost" data-lib-action="review" aria-pressed="${!!state.reviewed}">${state.reviewed ? '✓ Reviewed' : 'Mark reviewed'}</button></div><div class="lib-tabs" role="tablist" aria-label="Study entry">${tabs.map(([id,title]) => `<button role="tab" aria-selected="${this.tab === id}" data-lib-action="tab" data-tab="${id}">${title}</button>`).join('')}</div><div id="lib-tab-body" role="tabpanel"></div></div>`;
    const body = document.getElementById('lib-tab-body');
    if (this.tab === 'statement') {
      if (!r.documents.length) { body.innerHTML = '<div class="lib-note">This entry contains reference code only. No problem statement was included in the source folder.</div>'; return; }
      const doc = r.documents[this.documentIndex || 0];
      body.innerHTML = `<label class="lib-muted" for="lib-document">Reading source </label><select id="lib-document">${r.documents.map((d,i) => `<option value="${i}" ${i === (this.documentIndex || 0) ? 'selected' : ''}>${h(this.source(d.source))} — ${h(d.path)}</option>`).join('')}</select><div class="lib-origin">Source: ${h(this.source(doc.source))} / ${h(doc.path)}</div><article class="lib-content" id="lib-reading"></article>`;
      const html = marked.parse(doc.text.replace(/^\[TOC\]\s*$/gm, ''));
      const fragment = DOMPurify.sanitize(html, {RETURN_DOM_FRAGMENT:true, FORBID_TAGS:['style','form','input','button','iframe','video','audio'], FORBID_ATTR:['style','srcset']});
      const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
      const heading = fragment.firstElementChild;
      if (heading?.matches('h1,h2') && normalize(heading.textContent) === normalize((r.number || '') + r.title)) heading.remove();
      const difficulty = fragment.firstElementChild;
      if (difficulty?.matches('h3') && difficulty.textContent.trim() === r.difficulty) difficulty.remove();
      fragment.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (!/^offline\/images\/[a-f0-9]{20}\.(png|jpe?g|gif|webp)$/.test(src)) {
          const label = document.createElement('span'); label.className = 'lib-note'; label.textContent = img.alt || 'Diagram not included in this offline pack.'; img.replaceWith(label);
        } else { if(window.CODELAB_INLINE_IMAGES?.[src])img.src=window.CODELAB_INLINE_IMAGES[src];img.loading = 'lazy'; img.alt ||= 'Problem diagram'; }
      });
      fragment.querySelectorAll('a').forEach(a => {
        if (/^https?:\/\//i.test(a.getAttribute('href') || '')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        else a.removeAttribute('href');
      });
      document.getElementById('lib-reading').append(fragment);
    } else if (this.tab === 'solutions') {
      if (!r.solutions.length) { body.innerHTML = '<div class="lib-note">No separate solution files were supplied for this entry. The reading may contain an explanation or inline code.</div>'; return; }
      const s = this.currentSolution();
      body.innerHTML = `<div class="lib-actions"><label for="lib-solution" class="lib-muted">Reference solution</label><select id="lib-solution">${r.solutions.map((s,i) => `<option value="${i}" ${i === this.solutionIndex ? 'selected' : ''}>${h(this.label(s.language))} · ${h(s.name)} · ${h(this.source(s.origins[0].source))}</option>`).join('')}</select><button class="btn-ghost" data-lib-action="copy">Copy</button><button class="btn-ghost" data-lib-action="download">Download file</button></div><div class="lib-origin">${s.origins.map(o => `${h(this.source(o.source))} / ${h(o.path)}`).join('<br>')}</div><pre class="lib-code"><code>${h(s.code)}</code></pre><p class="lib-note">Reference code may use LeetCode classes, helper types, or dependencies. It may need a test harness before it runs locally.</p>`;
    } else {
      body.innerHTML = `<p class="lib-note">Your draft and notes save automatically in this browser. Export progress to back them up. Use the existing editor to run code; this workspace works without loading an editor runtime.</p><label for="lib-draft">Your solution / scratchpad</label><textarea id="lib-draft" class="lib-scratch" spellcheck="false" placeholder="Work through your own solution here…">${h(this.draft())}</textarea><div class="lib-actions"><button class="btn-ghost" data-lib-action="draft-download">Download draft</button></div><label for="lib-notes">Approach &amp; revision notes</label><textarea id="lib-notes" class="lib-scratch lib-notes" placeholder="Key idea, complexity, edge cases…">${h(Store.getRaw('library_notes_' + r.key, ''))}</textarea>`;
      document.getElementById('lib-draft').addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); const el = e.target; el.setRangeText('    ', el.selectionStart, el.selectionEnd, 'end'); this.saveText('draft', el.value); }
      });
    }
  },
  showSources() {
    const h = v => this.h(v);
    this.root.innerHTML = `<div class="lib-reader"><button class="btn-ghost" data-lib-action="back">← Back to library</button><h1>Sources &amp; import details</h1><div class="lib-content">${this.catalog.sources.map(s => `<h2>${h(s.label)}</h2><p>${s.importedFiles.toLocaleString()} source files processed from ${h(s.folder)}.</p><p>${s.licenses.length ? s.licenses.map(p => window.CODELAB_INLINE_LICENSES?.[p]?`<button class="btn-ghost" data-lib-action="license" data-path="${h(p)}">Download ${h(p.split('/').pop())}</button>`:`<a href="${h(p)}" target="_blank" rel="noopener">${h(p.split('/').pop())}</a>`).join(' · ') : 'No license file was included in this source download.'}</p>`).join('')}<h2>Folders inspected without a dataset import</h2>${this.catalog.skipped.map(s => `<p><strong>${h(s.folder)}</strong><br>${h(s.reason)}</p>`).join('')}<p>Statements, metadata and solutions are kept as supplied. Unknown difficulties remain unspecified. Identical solution files within an entry are merged with their source paths retained.</p><p>${this.catalog.stats.missingImages} external diagrams could not be bundled. These show a placeholder rather than making an online image request.</p></div></div>`;
  },
  cacheStatus(message) {
    this.offlineMessage = message;
    const el = document.getElementById('lib-cache-status'); if (el) el.textContent = message;
  },
  async saveOffline() {
    if (this.saving) return;
    if (window.CODELAB_STANDALONE) { this.cacheStatus('Single-file edition: library packs, diagrams, formulas and local editing are already embedded in this HTML.'); return; }
    if (location.protocol === 'file:') { this.cacheStatus('You are using the local project. Keep the full folder together; all library packs are already on disk.'); return; }
    if (!('caches' in window) || !('serviceWorker' in navigator)) { this.cacheStatus('Offline saving needs HTTPS or localhost. You can also download and open the complete project folder.'); return; }
    this.saving = true;
    try {
      this.cacheStatus('Preparing offline storage…');
      const registration=await this.registrationPromise;if(!registration)throw new Error('Service worker could not be installed');
      if(navigator.serviceWorker.controller&&(registration.waiting||registration.installing))throw new Error('Apply the available app update first, then save this version for offline use');
      let timer;
      try {
        await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Offline storage setup timed out')), 20000); })]);
      } finally { clearTimeout(timer); }
      const cache = await caches.open(this.cacheName());
      const files = RuntimeAssets.allFiles();
      let done = 0;
      for (const file of files) {
        const url = new URL(file, location.href).href;
        if (!(await cache.match(url))) {
          try {
            let response;
            for(let attempt=0;attempt<2;attempt++){
              try{response=await fetch(url,{cache:'reload'});if(!response.ok)throw new Error('HTTP '+response.status);break;}
              catch(error){if(attempt)throw error;this.cacheStatus(`Retrying offline file: ${file}`);await new Promise(resolve=>setTimeout(resolve,150));}
            }
            await cache.put(url,response);
          }
          catch(error){throw new Error(`Could not save ${file}: ${error.message}`);}
        }
        this.cacheStatus(`Saving offline library… ${++done} / ${files.length} files`);
      }
      if(await RuntimeAssets.saved()!=='ready')throw new Error('Some app files were not saved; retry to complete this version');
      this.cacheStatus('Ready offline. Full app, library, Python, SQL and Monaco are saved on this device. C/C++/Java cloud compilation needs internet.');
    } catch (error) { this.cacheStatus('Offline save incomplete: ' + error.message + '. Reconnect and retry; saved files will be reused.'); }
    finally { this.saving = false; }
  }
};
for(const method of ['render','reader','showSources']){const original=OfflineLibrary[method];OfflineLibrary[method]=function(...args){const result=original.apply(this,args);if(Router.current==='library')this.advancedHeader();return result;};}
window.addEventListener('DOMContentLoaded', () => OfflineLibrary.init());
