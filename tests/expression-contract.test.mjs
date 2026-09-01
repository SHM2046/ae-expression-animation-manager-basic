import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const host = fs.readFileSync(new URL('../host/animation-manager.jsx', import.meta.url), 'utf8');
test('表达式使用固定 2 秒和 25fps 偏移', () => {
  assert.match(host, /time\+o\/25/);
  assert.match(host, /\)\/2/);
  assert.match(host, /CYCLE_FRAMES = 50/);
});
test('每种表达式都有可扫描标记', () => {
  assert.match(host, /MARKER = "\/\/ AEMGR:v1:"/);
  assert.match(host, /MARKER \+ type/);
  assert.match(host, /expression\(type\)/);
});
test('面板提供管理所需主要操作', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  for (const fn of ['AEMGR_addSelectedLayers', 'AEMGR_updateControl', 'AEMGR_removeAll', 'AEMGR_selectLayer', 'AEMGR_renameLayer', 'AEMGR_mirrorSelectedLayers', 'AEMGR_setMirrorLink', 'AEMGR_clearThumbnailCache', 'AEMGR_listManagedComps', 'AEMGR_refreshLayerThumbnail', 'AEMGR_createGlobalLink', 'AEMGR_copyGlobalLink', 'AEMGR_pasteGlobalLink']) assert.match(panel, new RegExp(fn));
});
test('参数支持数值输入并限制最新幅度范围', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  assert.match(panel, /class="number-input"/);
  assert.match(panel, /slider\('Y', control\.yAmplitude, 0, 100/);
  assert.match(panel, /type === 'rotation' \? 100 : 50/);
});
test('缩略图按需使用 saveFrameToPng 且不走渲染队列', () => {
  assert.match(host, /saveFrameToPng/);
  assert.match(host, /缩略图按需生成/);
  assert.doesNotMatch(host, /thumbnailForLayer\(comp, selected\[i\], true\)/);
  assert.match(host, /preview_"\s*\+\s*\(\(new Date\(\)\)\.getTime\(\)\)/);
  assert.match(host, /file\.length > 0/);
  assert.doesNotMatch(host, /renderQueue/);
});
test('节奏模式、镜像关联、右键菜单和预设入口存在', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert.match(host, /Motion Mode/);
  assert.match(host, /Motion Strength/);
  assert.match(host, /function waveExpression/);
  assert.match(host, /mode==4/);
  assert.match(panel, /柔停/);
  assert.match(panel, /呼吸/);
  assert.match(panel, /流动/);
  assert.match(host, /Mirror Link/);
  assert.match(host, /mirrorPeerIndices/);
  assert.match(host, /Global Position Group/);
  assert.match(panel, /全局关联复制/);
  assert.match(panel, /globalLinkText/);
  assert.match(panel, /showContextMenu/);
  assert.match(panel, /aemgrPresets/);
  assert.match(html, /preset-list/);
  assert.match(html, /clear-cache/);
});
test('单窗口和双窗口动画编辑切换入口存在', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert.match(panel, /SLOT_IDS = \['A', 'B'\]/);
  assert.match(panel, /dualWindow: false/);
  assert.match(panel, /function visibleSlotIds/);
  assert.match(html, /dual-window/);
  assert.doesNotMatch(html, /apply-a-to-b/);
  assert.doesNotMatch(html, /transfer-scope/);
});
test('缩略图可按单个图层强制刷新', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert.match(host, /AEMGR_refreshLayerThumbnail/);
  assert.match(host, /clearThumbnailForLayer/);
  assert.match(panel, /refreshThumbnail/);
  assert.doesNotMatch(panel, /thumbnailBust/);
  assert.doesNotMatch(panel, /\?aemgr=/);
  assert.match(html, /refresh-thumb/);
});
test('镜像使用基础属性值而不是当前表达式帧结果', () => {
  assert.match(host, /function expressionState/);
  assert.match(host, /prop\.expressionEnabled = false/);
  assert.match(host, /restoreExpressionState/);
});
test('面板显示版本号和构建号', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert.match(panel, /VERSION = 'v1\.4\.1'/);
  assert.match(panel, /BUILD = 'basic-github-auto-update'/);
  assert.match(html, /version-badge/);
});
test('可改名、存为全局，并且自动加载只跟随已管理合成', () => {
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert.match(host, /AEMGR_renameLayer/);
  assert.match(host, /AEMGR_createGlobalLink/);
  assert.match(host, /AEMGR_listManagedComps/);
  assert.match(host, /hasManagedLayers/);
  assert.match(host, /copy\.name = "镜像_" \+ layer\.name/);
  assert.match(panel, /autoLoadManaged/);
  assert.match(panel, /activeHostCompManaged/);
  assert.match(panel, /!result\.managed/);
  assert.match(panel, /function renameLayer/);
  assert.match(panel, /function createGlobalLink/);
  assert.match(html, /auto-load-managed/);
  assert.match(html, /layer-name-input/);
});
test('基础版安装与高阶版隔离，并保留可恢复的基础版备份', () => {
  const install = fs.readFileSync(new URL('../install.ps1', import.meta.url), 'utf8');
  const uninstall = fs.readFileSync(new URL('../uninstall.ps1', import.meta.url), 'utf8');
  assert.match(install, /CSXS\.8/);
  assert.match(install, /CSXS\.13/);
  assert.match(install, /Remove-Item/);
  assert.match(install, /AEExpressionAnimationManagerBasic/);
  assert.match(install, /Move-Item/);
  assert.match(uninstall, /AEExpressionAnimationManagerBasic/);
  assert.match(uninstall, /DeleteInsteadOfBackup/);
  assert.match(uninstall, /Remove-Item/);
});
test('紧凑布局将三个属性横向排列，锚点覆盖在缩略图上', () => {
  const css = fs.readFileSync(new URL('../client/panel.css', import.meta.url), 'utf8');
  const panel = fs.readFileSync(new URL('../client/panel.js', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(210px, 1fr\)\)/);
  assert.match(css, /\.slot-grid\.compare \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.thumb\.has-image \.refresh-thumb/);
  assert.match(css, /\.remove-layer \{ top: 4px; right: 4px/);
  assert.doesNotMatch(css, /\.slot-grid\.compare \{ grid-template-columns: 1fr/);
  assert.match(css, /\.anchor-picker \{ position: absolute/);
  assert.match(panel, /thumb\.appendChild\(anchorPicker\(layer\)\)/);
});
