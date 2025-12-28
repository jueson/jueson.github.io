// 简单的书签管理逻辑（localStorage），包含搜索、分类、增删改、导出/导入（JSON/OPML）
// 在生产环境可替换为后端 API 请求

const STORAGE_KEY = 'nav_bookmarks_v1';

// 初始示例数据
const sampleData = [
  {
    id: genId(), title: "Google", url: "https://www.google.com",
    desc: "搜索引擎", categories: ["工具","搜索"], icon: "https://www.google.com/favicon.ico"
  },
  {
    id: genId(), title: "MDN Web Docs", url: "https://developer.mozilla.org",
    desc: "前端标准与文档", categories: ["开发","文档"], icon: "https://developer.mozilla.org/static/img/favicon144.png"
  },
  {
    id: genId(), title: "GitHub", url: "https://github.com",
    desc: "代码托管平台", categories: ["开发","工具"], icon: "https://github.githubassets.com/favicons/favicon.png"
  }
];

// DOM
const $cards = document.getElementById('cards');
const $search = document.getElementById('search');
const $categoryList = document.getElementById('categoryList');
const $categoryFilter = document.getElementById('categoryFilter');
const $addBtn = document.getElementById('addBtn');
const $modal = document.getElementById('modal');
const $modalTitle = document.getElementById('modalTitle');
const $bookmarkForm = document.getElementById('bookmarkForm');
const $cancelBtn = document.getElementById('cancelBtn');
const $exportJsonBtn = document.getElementById('exportJsonBtn');
const $exportOpmlBtn = document.getElementById('exportOpmlBtn');
const $importFile = document.getElementById('importFile');

let bookmarks = load();
let editingId = null;
let activeCategory = '';

// 初始化
renderAll();

// 事件
$search.addEventListener('input', renderAll);
$addBtn.addEventListener('click', () => openModal());
$cancelBtn.addEventListener('click', closeModal);
$bookmarkForm.addEventListener('submit', onSubmit);
$exportJsonBtn.addEventListener('click', exportJSON);
$exportOpmlBtn.addEventListener('click', exportOPML);
$importFile.addEventListener('change', importJSON);

// 渲染所有：分类列表 + 卡片
function renderAll() {
  renderCategories();
  renderCards();
}

function renderCategories() {
  const categories = getAllCategories(bookmarks);
  // 分类侧栏
  $categoryList.innerHTML = '';
  const liAll = document.createElement('li');
  liAll.textContent = '全部';
  liAll.className = !activeCategory ? 'active' : '';
  liAll.onclick = () => { activeCategory = ''; renderAll(); };
  $categoryList.appendChild(liAll);

  categories.forEach(cat => {
    const li = document.createElement('li');
    li.textContent = `${cat} (${countInCategory(bookmarks, cat)})`;
    li.className = activeCategory === cat ? 'active' : '';
    li.onclick = () => { activeCategory = cat; renderAll(); };
    $categoryList.appendChild(li);
  });

  // 顶部筛选 select
  $categoryFilter.innerHTML = '<option value="">所有分类</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  $categoryFilter.value = activeCategory;
  $categoryFilter.onchange = () => { activeCategory = $categoryFilter.value; renderAll(); };
}

function renderCards() {
  const q = ($search.value || '').trim().toLowerCase();
  const filtered = bookmarks.filter(b => {
    if (activeCategory && !b.categories.includes(activeCategory)) return false;
    if (!q) return true;
    return (b.title + ' ' + (b.desc||'') + ' ' + (b.categories||[]).join(' ')).toLowerCase().includes(q);
  });

  $cards.innerHTML = '';
  if (filtered.length === 0) {
    $cards.innerHTML = '<p style="color:#64748b">未找到书签，试试添加一个或清除筛选。</p>';
    return;
  }

  filtered.forEach(b => {
    const card = document.createElement('div');
    card.className = 'card';

    const fav = document.createElement('div');
    fav.className = 'favicon';
    const img = document.createElement('img');
    img.src = b.icon || `https://www.google.com/s2/favicons?domain=${(new URL(b.url)).hostname}`;
    img.alt = b.title;
    fav.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const h4 = document.createElement('h4');
    const a = document.createElement('a');
    a.href = b.url; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = b.title;
    h4.appendChild(a);
    const p = document.createElement('p');
    p.textContent = b.desc || '';
    const tags = document.createElement('div');
    tags.style.marginTop = '8px';
    tags.style.fontSize = '12px';
    tags.style.color = '#475569';
    tags.textContent = b.categories.join(' · ');

    meta.appendChild(h4);
    meta.appendChild(p);
    meta.appendChild(tags);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.onclick = () => openModal(b.id);
    const delBtn = document.createElement('button');
    delBtn.textContent = '删除';
    delBtn.onclick = () => { if (confirm('确认删除该书签？')) { removeBookmark(b.id); } };

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    card.appendChild(fav);
    card.appendChild(meta);
    card.appendChild(actions);

    $cards.appendChild(card);
  });
}

function openModal(id) {
  editingId = id || null;
  $modal.classList.remove('hidden');
  $modal.setAttribute('aria-hidden','false');
  if (editingId) {
    $modalTitle.textContent = '编辑书签';
    const item = bookmarks.find(x=>x.id===editingId);
    $bookmarkForm.title.value = item.title;
    $bookmarkForm.url.value = item.url;
    $bookmarkForm.desc.value = item.desc || '';
    $bookmarkForm.categories.value = (item.categories||[]).join(', ');
    $bookmarkForm.icon.value = item.icon || '';
  } else {
    $modalTitle.textContent = '添加书签';
    $bookmarkForm.reset();
  }
}

function closeModal() {
  editingId = null;
  $modal.classList.add('hidden');
  $modal.setAttribute('aria-hidden','true');
}

function onSubmit(e) {
  e.preventDefault();
  const form = $bookmarkForm;
  const item = {
    title: form.title.value.trim(),
    url: form.url.value.trim(),
    desc: form.desc.value.trim(),
    categories: form.categories.value.split(',').map(s=>s.trim()).filter(Boolean),
    icon: form.icon.value.trim()
  };
  if (editingId) {
    updateBookmark(editingId, item);
  } else {
    addBookmark(item);
  }
  closeModal();
}

function addBookmark(data) {
  const newItem = { id: genId(), ...data };
  bookmarks.unshift(newItem);
  save();
  renderAll();
}

function updateBookmark(id, data) {
  const idx = bookmarks.findIndex(b=>b.id===id);
  if (idx===-1) return;
  bookmarks[idx] = { ...bookmarks[idx], ...data };
  save();
  renderAll();
}

function removeBookmark(id) {
  bookmarks = bookmarks.filter(b=>b.id!==id);
  save();
  renderAll();
}

// storage
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return sampleData.slice();
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('load error',e);
    return sampleData.slice();
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

// helpers
function genId() { return Math.random().toString(36).slice(2,10); }
function getAllCategories(list) {
  const s = new Set();
  list.forEach(b => (b.categories||[]).forEach(c=>s.add(c)));
  return Array.from(s).sort();
}
function countInCategory(list, cat) {
  return list.filter(b => (b.categories||[]).includes(cat)).length;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]); }

// 导出 JSON
function exportJSON() {
  const dataStr = JSON.stringify(bookmarks, null, 2);
  downloadFile('bookmarks.json', dataStr, 'application/json');
}

// 导出 OPML（简单实现，兼容常见导入）
function exportOPML() {
  const title = '书签导出';
  const now = new Date().toISOString();
  const outlines = bookmarks.map(b => {
    const cats = (b.categories||[]).join(', ');
    const text = escapeXml(b.title);
    const url = escapeXml(b.url);
    const desc = escapeXml(b.desc || '');
    const attrs = `text="${text}" title="${text}" type="link" xmlUrl="${url}"`;
    // 把分类和描述放入 _note
    return `<outline ${attrs} _note="${escapeXml(`分类:${cats} 描述:${desc}`)}" />`;
  }).join('\n    ');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${now}</dateCreated>
  </head>
  <body>
    <outline text="${escapeXml(title)}">
    ${outlines}
    </outline>
  </body>
</opml>`;
  downloadFile('bookmarks.opml', xml, 'text/xml');
}

function escapeXml(s){ return String(s).replace(/[<>&'"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }

function downloadFile(filename, content, mime='text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 导入 JSON（仅 JSON）
function importJSON(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('格式错误：期待数组');
      // 简单合并：保留现有并添加新项（去重可按 URL）
      const existingUrls = new Set(bookmarks.map(b=>b.url));
      const toAdd = data.map(d => ({
        id: genId(),
        title: d.title || d.name || '未命名',
        url: d.url || d.xmlUrl || '',
        desc: d.desc || '',
        categories: d.categories || (d.tags? d.tags.split(',').map(s=>s.trim()).filter(Boolean):[]),
        icon: d.icon || ''
      })).filter(item => item.url && !existingUrls.has(item.url));
      bookmarks = toAdd.concat(bookmarks);
      save();
      renderAll();
      alert(`导入完成，新增 ${toAdd.length} 条（重复项已跳过）`);
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  };
  reader.readAsText(f);
  // 清空选择，允许重复导入同一文件
  e.target.value = '';
}