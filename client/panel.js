/* global __adobe_cep__ */
(function () {
  'use strict';
  const VERSION = 'v1.4.2';
  const BUILD = 'basic-github-auto-update';
  const SLOT_IDS = ['A', 'B'];
  const CONTROL_TYPES = ['position', 'rotation', 'scale'];
  const LABELS = { position: '位移', rotation: '旋转', scale: '缩放', all: '全部' };
  const MODE_LABELS = ['平滑', '线性', '柔停', '呼吸', '流动'];
  const state = {
    activeSlot: 'A',
    dualWindow: false,
    filter: 'all',
    hideMirror: false,
    showChildren: false,
    autoLoadManaged: localStorage.getItem('aemgrAutoLoadManaged') !== '0',
    compList: [],
    globalOptions: [],
    activeHostCompId: null,
    activeHostCompManaged: false,
    paramClipboard: null,
    globalClipboard: null,
    editingPreset: null,
    editingPresetData: null,
    slots: {
      A: { compId: null, locked: false, comp: null, groups: [], lastSignature: '' },
      B: { compId: null, locked: false, comp: null, groups: [], lastSignature: '' }
    }
  };
  const $ = (selector) => document.querySelector(selector);
  const esc = (text) => String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const html = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function evalHost(fn, args, done) {
    const serialized = args.map((arg) => '"' + esc(typeof arg === 'string' ? arg : JSON.stringify(arg)) + '"').join(',');
    if (!window.__adobe_cep__) { done({ ok: false, message: '请在 After Effects 的 CEP 面板中打开此插件。' }); return; }
    window.__adobe_cep__.evalScript(fn + '(' + serialized + ')', (raw) => {
      try { done(JSON.parse(raw)); } catch (_) { done({ ok: false, message: raw || 'AE 未返回有效数据。' }); }
    });
  }

  $('#version-badge').textContent = VERSION + ' · ' + BUILD;
  let pendingUpdate = null;
  function setUpdateStatus(message) { const el = $('#update-status'); if (el) el.textContent = '更新：' + message; }
  function checkForUpdates(showNotice) {
    if (!window.AEAMUpdater) { setUpdateStatus('当前环境不支持检查'); return; }
    setUpdateStatus('正在检查 GitHub…');
    window.AEAMUpdater.check(VERSION.replace(/^v/, ''), (result) => {
      if (!result.ok) { setUpdateStatus('检查失败：' + result.message); if (showNotice) notice('检查更新失败：' + result.message); return; }
      pendingUpdate = result.update || null;
      $('#prepare-update').disabled = !pendingUpdate;
      if (pendingUpdate) {
        setUpdateStatus('发现 v' + pendingUpdate.version + '：' + (pendingUpdate.notes || '可下载'));
        if (showNotice) notice('发现基础版 v' + pendingUpdate.version + '，可点击“下载并退出后安装”。');
      } else {
        setUpdateStatus('已是最新基础版');
        if (showNotice) notice('当前已经是最新基础版。');
      }
    });
  }
  function prepareUpdate() {
    if (!pendingUpdate || !window.AEAMUpdater) { notice('请先检查更新。'); return; }
    if (!window.confirm('更新包会先下载。请保存工程；随后完全退出 After Effects，更新将自动覆盖“基础版”目录。\n\n是否继续？')) return;
    $('#prepare-update').disabled = true; setUpdateStatus('正在下载 v' + pendingUpdate.version + '…');
    window.AEAMUpdater.prepare(pendingUpdate, (result) => {
      if (!result.ok) { setUpdateStatus('安装准备失败：' + result.message); $('#prepare-update').disabled = false; notice('更新失败：' + result.message); return; }
      setUpdateStatus('v' + pendingUpdate.version + ' 已就绪；退出 AE 后自动安装');
      notice('更新包已下载。请现在完全退出 After Effects；安装器会在 AE 关闭后自动完成更新。');
    });
  }
  function notice(message) { const el = $('#notice'); el.hidden = !message; el.textContent = message || ''; }
  function visibleSlotIds() { return state.dualWindow ? SLOT_IDS : ['A']; }
  function slot(id) { return state.slots[id]; }
  function activeSlot() { return slot(state.activeSlot); }
  function setActiveSlot(id) { state.activeSlot = id; $('#comp-lock').checked = !!slot(id).locked; renderShell(true); }
  function forceRefresh(withCatalog) { SLOT_IDS.forEach((id) => { slot(id).lastSignature = ''; }); refresh({ catalog: !!withCatalog }); }
  function pollActiveComp() {
    if (document.hidden || !state.autoLoadManaged || state.dualWindow || slot('A').locked) return;
    evalHost('AEMGR_getActiveCompSummary', [], (result) => {
      if (!result.ok || !result.activeCompId || !result.managed || result.activeCompId === state.activeHostCompId) return;
      state.activeHostCompId = result.activeCompId;
      state.activeHostCompManaged = true;
      slot('A').compId = result.activeCompId;
      forceRefresh(false);
    });
  }

  function refreshCompList(done) {
    evalHost('AEMGR_listManagedComps', [], (result) => {
      if (result.ok) { state.compList = result.comps || []; state.activeHostCompId = result.activeCompId || null; state.activeHostCompManaged = !!result.activeManaged; }
      evalHost('AEMGR_listGlobalOptions', [], (globals) => {
        if (globals.ok) state.globalOptions = globals.options || [];
        if (done) done(result);
      });
    });
  }
  function refresh(options) {
    const complete = () => {
      const ids = visibleSlotIds();
      let pending = ids.length;
      ids.forEach((id) => refreshSlot(id, () => { pending -= 1; if (!pending) renderShell(false); }));
    };
    if (options && options.catalog) refreshCompList(complete); else complete();
  }
  function refreshSlot(id, done) {
    const data = slot(id);
    const requested = (id === 'A' && !data.locked) ? (state.activeHostCompManaged ? state.activeHostCompId : data.compId) : data.compId;
    if (!requested && id !== 'A') { data.comp = null; data.groups = []; data.lastSignature = ''; done(); return; }
    evalHost('AEMGR_getPanelState', [{ compId: requested, includeChildren: state.showChildren }], (result) => {
      if (!result.ok) {
        data.comp = null; data.groups = []; data.lastSignature = '';
        if (id === state.activeSlot) notice(result.message);
      } else {
        data.comp = result.comp; data.groups = result.groups || [];
        if (!data.locked) data.compId = result.comp.id;
      }
      done();
    });
  }

  function renderShell(skipSignature) {
    $('#comp-lock').checked = !!activeSlot().locked;
    $('#dual-window').checked = !!state.dualWindow;
    const root = $('#slots');
    root.className = 'slot-grid' + (state.dualWindow ? ' compare' : '');
    const signature = JSON.stringify({
      dualWindow: state.dualWindow,
      activeSlot: state.activeSlot,
      filter: state.filter,
      hideMirror: state.hideMirror,
      comps: state.compList.map((comp) => comp.id + ':' + comp.name),
      globalOptions: state.globalOptions,
      slots: visibleSlotIds().map((id) => ({ id, comp: slot(id).comp, groups: slot(id).groups, locked: slot(id).locked }))
    });
    if (!skipSignature && signature === root.dataset.signature) return;
    root.dataset.signature = signature;
    root.innerHTML = '';
    visibleSlotIds().forEach((id) => root.appendChild(renderSlot(id)));
  }
  function renderSlot(id) {
    const data = slot(id);
    const panel = document.createElement('section');
    panel.className = 'slot-panel' + (id === state.activeSlot ? ' active' : '');
    panel.onclick = (event) => { if (!event.target.closest('button,input,label,select,.anchor-picker')) setActiveSlot(id); };
    const header = document.createElement('div');
    header.className = 'slot-header';
    header.innerHTML = '<div class="slot-meta"><div class="slot-name">' + (data.comp ? html(data.comp.name) : '未绑定合成') + '</div><div class="slot-size">' + (data.comp ? data.comp.width + '×' + data.comp.height : '选择一个合成用于双窗口对比') + '</div></div>' + (state.dualWindow ? '<div class="slot-tools"><button class="slot-map" title="按同名图层映射到另一个窗口">' + (id === 'A' ? '动画映射 →' : '← 动画映射') + '</button><select title="绑定此窗口的合成"></select><button class="bind-current" title="将 AE 当前活动合成绑定到此窗口">当前合成</button></div>' : '');
    const mapButton = header.querySelector('.slot-map');
    if (mapButton) mapButton.onclick = (event) => { event.stopPropagation(); animationMapFrom(id); };
    const select = header.querySelector('select');
    if (select) {
      select.innerHTML = '<option value="">选择合成</option>' + state.compList.map((comp) => '<option value="' + html(comp.id) + '">' + html(comp.name) + ' (' + comp.width + '×' + comp.height + ')</option>').join('');
      select.value = data.compId || '';
      select.onchange = (event) => { data.compId = event.target.value || null; data.locked = !!data.compId; setActiveSlot(id); forceRefresh(); };
      header.querySelector('.bind-current').onclick = (event) => {
        event.stopPropagation();
        if (!state.activeHostCompId) { notice('AE 当前没有活动合成。'); return; }
        data.compId = state.activeHostCompId; data.locked = true; setActiveSlot(id); forceRefresh();
      };
    }
    panel.appendChild(header);
    const layers = document.createElement('div'); layers.className = 'layers';
    if (!data.comp) layers.innerHTML = '<div class="empty">请选择或绑定一个合成。</div>'; else renderLayersInto(layers, id, data);
    panel.appendChild(layers);
    return panel;
  }
  function activeControls(layer) { return layer.controls.filter((c) => c.exists); }
  function shouldShow(layer) {
    if (state.hideMirror && layer.mirror && layer.mirror.group && (layer.mirror.role === 2 || /01$/.test(layer.name))) return false;
    return state.filter === 'all' || activeControls(layer).some((c) => c.type === state.filter);
  }
  function renderLayersInto(root, id, data) {
    let count = 0;
    data.groups.forEach((group) => {
      const shown = group.layers.filter(shouldShow); if (!shown.length) return;
      const container = document.createElement('div');
      if (group.depth) {
        container.className = 'child-group';
        const label = document.createElement('div'); label.className = 'child-label'; label.textContent = '↳ ' + group.name; container.appendChild(label);
      }
      shown.forEach((layer) => { container.appendChild(renderLayer(layer, id)); count += 1; });
      root.appendChild(container);
    });
    if (!count) root.innerHTML = '<div class="empty">当前筛选没有已添加的动画图层。</div>';
  }
  function renderLayer(layer, slotId) {
    const fragment = $('#layer-template').content.cloneNode(true); const card = fragment.querySelector('.layer-card');
    card.classList.toggle('selected', !!layer.selected);
    card.onclick = (event) => {
      if (event.target.closest('button,input,label,.anchor-picker,select')) return;
      setActiveSlot(slotId);
      selectLayer(layer, { additive: event.ctrlKey || event.metaKey || event.shiftKey, selected: !layer.selected });
    };
    card.oncontextmenu = (event) => { event.preventDefault(); setActiveSlot(slotId); selectLayer(layer, { additive: true, selected: true }, false); showContextMenu(event, layer); };
    card.querySelector('.index').textContent = '#' + layer.index;
    const nameInput = card.querySelector('.layer-name-input');
    nameInput.value = layer.name;
    nameInput.onclick = (event) => event.stopPropagation();
    nameInput.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); nameInput.blur(); } if (event.key === 'Escape') { nameInput.value = layer.name; nameInput.blur(); } };
    nameInput.onchange = () => renameLayer(layer, nameInput.value);
    card.querySelector('.layer-title small').textContent = layer.typeLabel;
    const thumb = card.querySelector('.thumb'); const symbol = thumb.querySelector('span'); symbol.textContent = layer.typeIcon;
    if (layer.thumbnailPath) {
      thumb.classList.add('has-image');
      const image = document.createElement('img'); image.src = 'file:///' + encodeURI(layer.thumbnailPath.replace(/\\/g, '/'));
      image.onerror = () => { image.remove(); thumb.classList.remove('has-image'); };
      thumb.appendChild(image);
    }
    const mirrorSlot = card.querySelector('.mirror-slot');
    if (layer.mirror && layer.mirror.group) {
      const before = document.createElement('span'); before.textContent = '#' + layer.index;
      const link = document.createElement('button'); link.className = 'mirror-toggle' + (layer.mirror.linked ? ' active' : ''); link.textContent = layer.mirror.linked ? '<关联>' : '<未关联>'; link.title = layer.mirror.linked ? '镜像关联已开启，点击关闭' : '镜像关联已关闭，点击开启';
      link.onclick = (event) => { event.stopPropagation(); setActiveSlot(slotId); setMirrorLink(layer, !layer.mirror.linked); };
      const after = document.createElement('span'); after.textContent = (layer.mirror.peers && layer.mirror.peers.length) ? '#' + layer.mirror.peers.join(' #') : '#?';
      const mirrorLine = document.createElement('span'); mirrorLine.className = 'relation-line mirror-relation';
      mirrorLine.appendChild(before); mirrorLine.appendChild(link); mirrorLine.appendChild(after); mirrorSlot.appendChild(mirrorLine);
    }
    mirrorSlot.appendChild(globalSelector(layer));
    card.querySelector('.refresh-thumb').onclick = (event) => { event.stopPropagation(); refreshThumbnail(layer); };
    card.querySelector('.remove-layer').onclick = (event) => { event.stopPropagation(); removeAll(layer); };
    const list = card.querySelector('.control-list');
    CONTROL_TYPES.forEach((type) => list.appendChild(renderControl(layer, type, layer.controls.find((c) => c.type === type))));
    const rotation = layer.controls.find((control) => control.type === 'rotation');
    if (rotation && rotation.exists) thumb.appendChild(anchorPicker(layer));
    return card;
  }
  function renderControl(layer, type, control) {
    const row = document.createElement('section'); row.className = 'property';
    const head = document.createElement('div'); head.className = 'property-head';
    head.innerHTML = '<b>' + LABELS[type] + '</b><button class="add-control">' + (control && control.exists ? '已添加' : '添加' + LABELS[type]) + '</button><label class="toggle"><input type="checkbox" ' + (control && control.enabled ? 'checked' : '') + '><i></i>启用</label><button class="remove-control" title="彻底移除">×</button>';
    const add = head.querySelector('.add-control'); const toggle = head.querySelector('input'); const remove = head.querySelector('.remove-control');
    add.disabled = !!(control && control.exists); toggle.disabled = !(control && control.exists); remove.disabled = !(control && control.exists);
    add.onclick = () => update(layer, type, { create: true, enabled: true });
    toggle.onchange = () => update(layer, type, { enabled: toggle.checked });
    remove.onclick = () => removeControl(layer, type);
    row.appendChild(head);
    if (control && control.exists) {
      if (type === 'position') { row.appendChild(slider('Y', control.yAmplitude, 0, 100, (v) => update(layer, type, { yAmplitude: v }))); row.appendChild(slider('X', control.xAmplitude, 0, 100, (v) => update(layer, type, { xAmplitude: v }))); }
      else row.appendChild(slider('幅度', control.amplitude, 0, type === 'rotation' ? 100 : 50, (v) => update(layer, type, { amplitude: v })));
      row.appendChild(slider('偏移', control.offsetFrames, 0, 49, (v) => update(layer, type, { offsetFrames: v }), true));
      row.appendChild(modeSelect(control.motionMode, (v) => update(layer, type, { motionMode: v })));
      row.appendChild(slider('强度', control.motionStrength, 0, 100, (v) => update(layer, type, { motionStrength: v })));
    }
    return row;
  }
  function modeSelect(value, onChange) {
    const line = document.createElement('label'); line.className = 'params mode-param';
    line.innerHTML = '<span>节奏</span><select><option value="0">平滑</option><option value="1">线性</option><option value="2">柔停</option><option value="3">呼吸</option><option value="4">流动</option></select>';
    const select = line.querySelector('select'); select.value = String(Math.max(0, Math.min(4, Math.round(Number(value || 0)))));
    select.onchange = () => onChange(Number(select.value));
    return line;
  }
  function slider(label, value, min, max, onChange, snapRange) {
    const line = document.createElement('label'); line.className = 'params';
    const initial = clamp(Number(value || 0), min, max);
    const step = snapRange ? 5 : 1;
    line.innerHTML = '<span>' + label + '</span><input class="range-input" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + snapForRange(initial, snapRange) + '"><input class="number-input" type="number" min="' + min + '" max="' + max + '" step="1" value="' + initial + '">';
    const range = line.querySelector('.range-input'); const number = line.querySelector('.number-input');
    const syncRange = (commit) => { const next = clamp(Number(range.value || 0), min, max); number.value = next; if (commit) onChange(next); };
    const syncNumber = () => { const next = clamp(Number(number.value || 0), min, max); number.value = next; range.value = snapForRange(next, snapRange); onChange(next); };
    range.oninput = () => syncRange(false); range.onchange = () => syncRange(true);
    number.onchange = syncNumber; number.onkeydown = (event) => { if (event.key === 'Enter') number.blur(); };
    return line;
  }
  function snapForRange(value, enabled) { if (!enabled) return value; return value >= 49 ? 49 : Math.round(value / 5) * 5; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)); }
  function anchorPicker(layer) {
    const box = document.createElement('div'); box.className = 'anchor-picker'; const dot = document.createElement('i'); dot.className = 'anchor-dot';
    const x = layer.anchor && layer.anchor.width ? (layer.anchor.x / layer.anchor.width) * 100 : 50; const y = layer.anchor && layer.anchor.height ? (layer.anchor.y / layer.anchor.height) * 100 : 50;
    dot.style.left = Math.max(0, Math.min(100, x)) + '%'; dot.style.top = Math.max(0, Math.min(100, y)) + '%'; box.appendChild(dot);
    box.title = '拖动或点击以设置旋转锚点（保持画面位置）';
    let dragging = false;
    const setAnchor = (event) => {
      const rect = box.getBoundingClientRect();
      const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      dot.style.left = (xRatio * 100) + '%'; dot.style.top = (yRatio * 100) + '%';
      update(layer, 'anchor', { xRatio, yRatio });
    };
    const preview = (event) => { if (dragging) { dot.style.left = Math.max(0, Math.min(100, ((event.clientX - box.getBoundingClientRect().left) / box.getBoundingClientRect().width) * 100)) + '%'; dot.style.top = Math.max(0, Math.min(100, ((event.clientY - box.getBoundingClientRect().top) / box.getBoundingClientRect().height) * 100)) + '%'; } };
    const finish = (event) => { if (dragging) { dragging = false; setAnchor(event); } window.removeEventListener('mousemove', preview); window.removeEventListener('mouseup', finish); };
    box.onmousedown = (event) => { dragging = true; event.preventDefault(); preview(event); window.addEventListener('mousemove', preview); window.addEventListener('mouseup', finish); };
    return box;
  }

  function update(layer, type, patch) {
    evalHost('AEMGR_updateControl', [layer.compId, layer.index, type, patch], (result) => {
      notice(result.ok ? '' : result.message);
      if (!result.ok) return;
      if (type === 'anchor' || patch.create) forceRefresh();
      else patchLocalControl(layer, type, patch);
    });
  }
  function selectLayer(layer, patch, shouldRefresh) {
    evalHost('AEMGR_selectLayer', [layer.compId, layer.index, patch], (result) => {
      notice(result.ok ? '' : result.message);
      if (!result.ok) return;
      patchLocalSelection(layer, patch);
      if (shouldRefresh !== false) renderShell(true);
    });
  }
  function patchLocalControl(layer, type, patch) {
    const control = layer.controls.find((item) => item.type === type);
    if (!control) return;
    Object.keys(patch).forEach((key) => { if (key !== 'create') control[key] = patch[key]; });
  }
  function patchLocalSelection(layer, patch) {
    if (!patch.additive) visibleSlotIds().forEach((id) => allLayers(id).forEach((item) => { item.selected = false; }));
    layer.selected = !!patch.selected;
  }
  function setGlobalLinks(layer, groups) {
    evalHost('AEMGR_setGlobalLinks', [layer.compId, layer.index, groups || {}], (result) => {
      notice(result.message);
      if (result.ok) forceRefresh();
    });
  }
  function createGlobalLink(layer) {
    evalHost('AEMGR_createGlobalLink', [layer.compId, layer.index, 'all'], (result) => {
      notice(result.message);
      if (result.ok) forceRefresh(true);
    });
  }
  function renameLayer(layer, name) {
    const next = String(name || '').trim();
    if (!next || next === layer.name) { renderShell(true); return; }
    evalHost('AEMGR_renameLayer', [layer.compId, layer.index, next], (result) => {
      notice(result.message);
      if (!result.ok) { renderShell(true); return; }
      layer.name = result.name || next;
      renderShell(true);
    });
  }
  function setMirrorLink(layer, enabled) { evalHost('AEMGR_setMirrorLink', [layer.compId, layer.index, String(enabled)], (result) => { notice(result.message); forceRefresh(); }); }
  function removeControl(layer, type) { evalHost('AEMGR_removeControl', [layer.compId, layer.index, type], (result) => { notice(result.ok ? '' : result.message); forceRefresh(); }); }
  function removeAll(layer) { evalHost('AEMGR_removeAll', [layer.compId, layer.index], (result) => { notice(result.ok ? '' : result.message); forceRefresh(true); }); }
  function allLayers(slotId) { return slot(slotId).groups.reduce((list, group) => list.concat(group.layers), []); }
  function selectedLayers(slotId) { return allLayers(slotId).filter((layer) => layer.selected).sort((a, b) => a.index - b.index); }
  function selectedLayersInVisibleSlots() { return visibleSlotIds().reduce((list, id) => list.concat(selectedLayers(id)), []); }
  function controlParams(control, includeStrength) {
    if (!control || !control.exists) return null;
    const data = { create: true, enabled: !!control.enabled, offsetFrames: Number(control.offsetFrames || 0), motionMode: Number(control.motionMode || 0) };
    if (includeStrength !== false) data.motionStrength = Number(control.motionStrength || 50);
    if (control.type === 'position') { data.xAmplitude = Number(control.xAmplitude || 0); data.yAmplitude = Number(control.yAmplitude || 0); }
    else data.amplitude = Number(control.amplitude || 0);
    return data;
  }
  function layerParams(layer, scope, includeStrength) {
    const out = {};
    CONTROL_TYPES.forEach((type) => {
      if (scope !== 'all' && scope !== type) return;
      const params = controlParams(layer.controls.find((control) => control.type === type), includeStrength);
      if (params) out[type] = params;
    });
    return out;
  }
  function paramsSummary(layer) {
    return CONTROL_TYPES.map((type) => {
      const control = layer.controls.find((item) => item.type === type);
      if (!control || !control.exists) return LABELS[type] + '<无>';
      const parts = type === 'position' ? ['X' + Number(control.xAmplitude || 0), 'Y' + Number(control.yAmplitude || 0)] : ['幅度' + Number(control.amplitude || 0)];
      parts.push('偏移' + Number(control.offsetFrames || 0));
      parts.push(MODE_LABELS[Math.max(0, Math.min(4, Math.round(Number(control.motionMode || 0))))]);
      return LABELS[type] + '<' + parts.join(',') + '>';
    }).join(' ');
  }
  function paramsSummaryFromData(data) {
    if (!data) return '无参数';
    return CONTROL_TYPES.map((type) => {
      const item = data[type];
      if (!item) return LABELS[type] + '<无>';
      const parts = type === 'position' ? ['X' + Number(item.xAmplitude || 0), 'Y' + Number(item.yAmplitude || 0)] : ['幅度' + Number(item.amplitude || 0)];
      parts.push('偏移' + Number(item.offsetFrames || 0));
      parts.push(MODE_LABELS[Math.max(0, Math.min(4, Math.round(Number(item.motionMode || 0))))]);
      return LABELS[type] + '<' + parts.join(',') + '>';
    }).join(' ');
  }
  function copyParams(layer, scope) {
    const data = layerParams(layer, scope, true);
    if (!Object.keys(data).length) { notice('这个图层没有可复制的动画参数。'); return; }
    state.paramClipboard = data;
    localStorage.setItem('aemgrParamClipboard', JSON.stringify(data));
    notice(scope === 'all' ? '已复制全部动画参数。' : '已复制' + LABELS[scope] + '参数。');
  }
  function globalLinkText(links) {
    if (!links) return '';
    const parts = [];
    if (links.position) parts.push('P' + pad2(links.position));
    if (links.rotation) parts.push('R' + pad2(links.rotation));
    if (links.scale) parts.push('C' + pad2(links.scale));
    return parts.join(' ');
  }
  function globalValue(links) {
    if (!links) return '';
    return CONTROL_TYPES.map((type) => links[type] ? type.charAt(0) + links[type] : '').filter(Boolean).join('|');
  }
  function globalSelector(layer) {
    const wrap = document.createElement('label');
    wrap.className = 'global-select-row';
    wrap.innerHTML = '<span>全局</span><select title="选择这个图层匹配的全局关联"><option value="">无</option></select><button class="global-create" title="将此图层现有动画参数创建为新的全局关联">存为全局</button>';
    const select = wrap.querySelector('select');
    state.globalOptions.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
    const value = globalValue(layer.globalLinks);
    if (value && !Array.from(select.options).some((option) => option.value === value)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = globalLinkText(layer.globalLinks);
      select.appendChild(option);
    }
    select.value = value;
    select.onfocus = () => { if (select.options.length > 10) select.size = 10; };
    select.onblur = () => { select.size = 0; };
    select.onchange = (event) => {
      event.stopPropagation();
      const option = state.globalOptions.find((item) => item.value === select.value);
      select.size = 0; select.blur();
      setGlobalLinks(layer, option ? option.groups : {});
    };
    wrap.querySelector('.global-create').onclick = (event) => { event.stopPropagation(); createGlobalLink(layer); };
    return wrap;
  }
  function pad2(value) { const number = Math.max(0, Math.round(Number(value || 0))); return number < 10 ? '0' + number : String(number); }
  function copyGlobalLink(layer, scope) {
    evalHost('AEMGR_copyGlobalLink', [layer.compId, layer.index, scope], (result) => {
      if (result.ok && result.data) {
        state.globalClipboard = result.data;
        localStorage.setItem('aemgrGlobalClipboard', JSON.stringify(result.data));
      }
      notice(result.message);
      forceRefresh(false);
    });
  }
  function pasteGlobalLink(layer, scope) {
    const data = state.globalClipboard || JSON.parse(localStorage.getItem('aemgrGlobalClipboard') || 'null');
    if (!data) { notice('还没有复制过全局关联。'); return; }
    const filtered = { params: {}, groups: {} };
    CONTROL_TYPES.forEach((type) => {
      if (scope !== 'all' && scope !== type) return;
      if (data.params && data.params[type] && data.groups && data.groups[type]) { filtered.params[type] = data.params[type]; filtered.groups[type] = data.groups[type]; }
    });
    if (!Object.keys(filtered.groups).length) { notice('剪贴板里没有这个类型的全局关联。'); return; }
    evalHost('AEMGR_pasteGlobalLink', [layer.compId, layer.index, filtered], (result) => { notice(result.message); forceRefresh(); });
  }
  function pasteParams(layer, scope) {
    const data = state.paramClipboard || JSON.parse(localStorage.getItem('aemgrParamClipboard') || 'null');
    if (!data) { notice('还没有复制过参数。'); return; }
    const targets = scope === 'all' ? Object.keys(data) : [scope];
    applyPatches(layer, targets.filter((type) => data[type]).map((type) => ({ type, patch: data[type] })));
  }
  function applyPatches(layer, entries, done) {
    if (!entries.length) { notice('没有可粘贴的参数。'); if (done) done(false); return; }
    let index = 0;
    const next = () => {
      if (index >= entries.length) { if (done) done(true); else forceRefresh(); return; }
      const item = entries[index++];
      evalHost('AEMGR_updateControl', [layer.compId, layer.index, item.type, item.patch], (result) => { if (!result.ok) notice(result.message); next(); });
    };
    next();
  }
  function showContextMenu(event, layer) {
    const menu = $('#context-menu');
    const row = (action, label) => '<button data-action="' + action + '">' + label + '</button>';
    menu.innerHTML = CONTROL_TYPES.concat(['all']).map((type) => row('copy-' + type, '复制' + LABELS[type])).join('') + '<hr>' + CONTROL_TYPES.concat(['all']).map((type) => row('paste-' + type, '粘贴' + LABELS[type])).join('') + '<hr>' + CONTROL_TYPES.concat(['all']).map((type) => row('globalcopy-' + type, '全局关联复制' + LABELS[type])).join('') + '<hr>' + CONTROL_TYPES.concat(['all']).map((type) => row('globalpaste-' + type, '全局关联粘贴' + LABELS[type])).join('');
    menu.hidden = false; menu.style.left = '0px'; menu.style.top = '0px';
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(event.clientX, window.innerWidth - rect.width - 8)) + 'px';
    menu.style.top = Math.max(6, Math.min(event.clientY, window.innerHeight - rect.height - 8)) + 'px';
    menu.onclick = (click) => {
      const button = click.target.closest('button'); if (!button) return;
      const parts = button.dataset.action.split('-'); menu.hidden = true;
      if (parts[0] === 'copy') copyParams(layer, parts[1]);
      else if (parts[0] === 'paste') pasteParams(layer, parts[1]);
      else if (parts[0] === 'globalcopy') copyGlobalLink(layer, parts[1]);
      else pasteGlobalLink(layer, parts[1]);
    };
  }
  function presetStore() { try { return JSON.parse(localStorage.getItem('aemgrPresets') || '{}') || {}; } catch (_) { return {}; } }
  function savePresetStore(data) { localStorage.setItem('aemgrPresets', JSON.stringify(data)); renderPresetList(); }
  function renderPresetList() {
    const select = $('#preset-list'); const presets = presetStore(); const names = Object.keys(presets).sort();
    select.innerHTML = names.length ? names.map((name) => '<option value="' + html(name) + '">' + html(name) + '</option>').join('') : '<option value="">无预设</option>';
    renderPresetPreview();
  }
  function renderPresetPreview() {
    const box = $('#preset-param-preview'); if (!box) return;
    const presets = presetStore(); const name = $('#preset-list').value; const data = state.editingPresetData || presets[name];
    box.textContent = data ? paramsSummaryFromData(data) : '参数：无';
  }
  function savePreset() {
    const layers = selectedLayersInVisibleSlots(); if (!layers.length) { notice('请先在插件里选中一个图层。'); return; }
    const data = layerParams(layers[0], 'all', true); if (!Object.keys(data).length) { notice('选中图层没有可保存的动画参数。'); return; }
    const defaultName = layers[0].name;
    const name = window.prompt('预设名称', defaultName); if (!name) return;
    const presets = presetStore(); presets[name] = data; savePresetStore(presets); $('#preset-list').value = name; notice('已保存预设：' + name);
    renderPresetPreview();
  }
  function applyPreset() {
    const name = $('#preset-list').value; const presets = presetStore(); const data = presets[name]; const layers = selectedLayersInVisibleSlots();
    if (!data) { notice('请选择一个预设。'); return; }
    if (!layers.length) { notice('请先在插件里选中要应用预设的图层。'); return; }
    let pending = layers.length;
    layers.forEach((layer) => applyPatches(layer, Object.keys(data).map((type) => ({ type, patch: data[type] })), () => { pending -= 1; if (!pending) { notice('已应用预设：' + name); forceRefresh(); } }));
  }
  function deletePreset() {
    const name = $('#preset-list').value; if (!name) return;
    const presets = presetStore(); delete presets[name]; savePresetStore(presets); notice('已删除预设：' + name);
  }
  function editPreset() {
    const oldName = $('#preset-list').value; const presets = presetStore(); if (!oldName || !presets[oldName]) { notice('请选择一个要编辑的预设。'); return; }
    state.editingPreset = oldName; state.editingPresetData = JSON.parse(JSON.stringify(presets[oldName]));
    $('#preset-name-input').value = oldName;
    $('#preset-editor').hidden = false;
    renderPresetPreview();
  }
  function replaceEditingPresetData() {
    if (!state.editingPreset) { notice('请先点击编辑预设。'); return; }
    const layers = selectedLayersInVisibleSlots(); if (!layers.length) { notice('请先在插件里选中一个图层。'); return; }
    const data = layerParams(layers[0], 'all', true); if (!Object.keys(data).length) { notice('选中图层没有可写入预设的动画参数。'); return; }
    state.editingPresetData = data; renderPresetPreview(); notice('已读取选中图层参数，点击保存编辑后生效。');
  }
  function savePresetEdit() {
    if (!state.editingPreset) return;
    const nextName = $('#preset-name-input').value.trim(); if (!nextName) { notice('预设名称不能为空。'); return; }
    const presets = presetStore();
    if (nextName !== state.editingPreset) delete presets[state.editingPreset];
    presets[nextName] = state.editingPresetData || {};
    state.editingPreset = null; state.editingPresetData = null; $('#preset-editor').hidden = true;
    savePresetStore(presets); $('#preset-list').value = nextName; renderPresetPreview(); notice('已编辑预设：' + nextName);
  }
  function cancelPresetEdit() {
    state.editingPreset = null; state.editingPresetData = null; $('#preset-editor').hidden = true; renderPresetPreview();
  }
  function addSelected() {
    const data = activeSlot();
    evalHost('AEMGR_addSelectedLayers', [data.locked ? data.compId : null], (result) => {
      notice(result.message);
      if (result.ok && !data.compId && state.activeHostCompId) data.compId = state.activeHostCompId;
      forceRefresh(true);
    });
  }
  function refreshThumbnail(layer) { evalHost('AEMGR_refreshLayerThumbnail', [layer.compId, layer.index], (result) => { notice(result.message); forceRefresh(); }); }
  function refreshVisibleThumbnails() {
    const ids = visibleSlotIds().filter((id) => slot(id).comp);
    if (!ids.length) { notice('当前没有可刷新的动画面板。'); return; }
    let pending = ids.length;
    const messages = [];
    ids.forEach((id) => {
      evalHost('AEMGR_refreshThumbnails', [slot(id).comp.id, String(state.showChildren)], (result) => {
        messages.push((id === 'A' ? '左侧' : '右侧') + '：' + result.message);
        pending -= 1;
        if (!pending) { notice(messages.join('  ')); forceRefresh(); }
      });
    });
  }
  function animationMapFrom(sourceSlotId) {
    if (!state.dualWindow || !slot('A').comp || !slot('B').comp) { notice('请先开启双窗口动画编辑，并让 A/B 两边都绑定合成。'); return; }
    const targetSlotId = sourceSlotId === 'A' ? 'B' : 'A';
    const sourceName = slot(sourceSlotId).comp.name; const targetName = slot(targetSlotId).comp.name;
    if (!window.confirm('动画映射需要保证图层名称完全一致。\n\n确认从合成《' + sourceName + '》映射到合成《' + targetName + '》？\n\n如果目标合成的同名图层还没有添加到动画插件，会自动添加后再完成映射。')) return;
    const sourceId = slot(sourceSlotId).comp.id;
    const targetId = slot(targetSlotId).comp.id;
    evalHost('AEMGR_mapAnimationsByName', [sourceId, targetId], (result) => { notice(result.message); forceRefresh(true); });
  }
  function batch(mode) {
    const data = activeSlot();
    if (!data.comp) { notice('请先选择当前槽位的合成。'); return; }
    if (state.filter === 'all') { notice('请先筛选位移、旋转或缩放，再批量偏移。'); return; }
    evalHost('AEMGR_batchOffsets', [data.comp.id, state.filter, mode, state.showChildren], (result) => { notice(result.message); forceRefresh(); });
  }

  document.addEventListener('click', (event) => { const menu = $('#context-menu'); if (!event.target.closest('#context-menu')) menu.hidden = true; });
  $('#dual-window').onchange = (event) => { state.dualWindow = event.target.checked; if (!state.dualWindow) setActiveSlot('A'); else renderShell(true); forceRefresh(true); };
  $('#auto-load-managed').checked = state.autoLoadManaged;
  $('#auto-load-managed').onchange = (event) => { state.autoLoadManaged = event.target.checked; localStorage.setItem('aemgrAutoLoadManaged', state.autoLoadManaged ? '1' : '0'); notice(state.autoLoadManaged ? '已开启自动跟随：只加载已管理的合成。' : '已关闭自动跟随：请用“刷新面板”或手动绑定合成。'); };
  document.querySelectorAll('[data-filter]').forEach((button) => button.onclick = () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('selected', item === button)); forceRefresh(); });
  $('#add-selected').onclick = addSelected;
  $('#comp-lock').onchange = (event) => { const data = activeSlot(); data.locked = event.target.checked; if (data.locked && data.comp) data.compId = data.comp.id; forceRefresh(); };
  $('#show-children').onchange = (event) => { state.showChildren = event.target.checked; forceRefresh(); };
  $('#hide-mirror').onclick = () => { state.hideMirror = !state.hideMirror; $('#hide-mirror').classList.toggle('selected', state.hideMirror); renderShell(true); };
  $('#refresh-visible-thumbs').onclick = refreshVisibleThumbnails;
  $('#mirror-selected').onclick = () => { const data = activeSlot(); if (!data.comp) { notice('请先选择当前槽位的合成。'); return; } evalHost('AEMGR_mirrorSelectedLayers', [data.comp.id], (result) => { notice(result.message); forceRefresh(); }); };
  $('#save-preset').onclick = savePreset; $('#apply-preset').onclick = applyPreset; $('#edit-preset').onclick = editPreset; $('#delete-preset').onclick = deletePreset;
  $('#preset-list').onchange = renderPresetPreview;
  $('#preset-replace').onclick = replaceEditingPresetData;
  $('#preset-save-edit').onclick = savePresetEdit;
  $('#preset-cancel-edit').onclick = cancelPresetEdit;
  $('#refresh-panel').onclick = () => forceRefresh(true);
  $('#clear-cache').onclick = () => evalHost('AEMGR_clearThumbnailCache', [], (result) => { notice(result.message); forceRefresh(); });
  $('#random-offset').onclick = () => batch('random'); $('#even-offset').onclick = () => batch('even');
  $('#check-update').onclick = () => checkForUpdates(true);
  $('#prepare-update').onclick = prepareUpdate;
  renderPresetList();
  setInterval(pollActiveComp, 8000); refresh({ catalog: true }); checkForUpdates(false);
}());
