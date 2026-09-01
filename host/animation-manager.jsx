/* AE Expression Animation Manager - ExtendScript host bridge */
#target aftereffects
(function () {
  var PREFIX = "AEMGR";
  var MARKER = "// AEMGR:v1:";
  var CYCLE_SECONDS = 2;
  var CYCLE_FRAMES = 50;
  function reply(data) { return JSON.stringify(data); }
  function parse(text) { try { return JSON.parse(text); } catch (e) { return {}; } }
  function fail(message) { return reply({ ok: false, message: message }); }
  function findComp(id) { var i, item; for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item instanceof CompItem && String(item.id) === String(id)) return item; } return null; }
  function getActiveComp(preferredId) { var comp = preferredId ? findComp(preferredId) : null; if (comp) return comp; return app.project && app.project.activeItem instanceof CompItem ? app.project.activeItem : null; }
  function fx(layer, name) { return layer.property("ADBE Effect Parade").property(PREFIX + " " + name); }
  function addSlider(layer, name, value) { var effect = fx(layer, name); if (!effect) { effect = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control"); effect.name = PREFIX + " " + name; } effect.property(1).setValue(value); return effect; }
  function number(layer, name, fallback) { var effect = fx(layer, name); return effect ? effect.property(1).value : fallback; }
  function clamp(value, min, max) { value = Number(value); if (isNaN(value)) value = 0; return Math.max(min, Math.min(max, value)); }
  function registered(layer) { return !!fx(layer, "Registered"); }
  function controlNames(type) { if (type === "position") return ["Position Enabled", "Position X Amplitude", "Position Y Amplitude", "Position Offset Frames", "Position X Direction", "Position Motion Mode", "Position Motion Strength", "Global Position Group"]; if (type === "rotation") return ["Rotation Enabled", "Rotation Amplitude", "Rotation Offset Frames", "Rotation Direction", "Rotation Motion Mode", "Rotation Motion Strength", "Global Rotation Group"]; return [cap(type) + " Enabled", cap(type) + " Amplitude", cap(type) + " Offset Frames", cap(type) + " Motion Mode", cap(type) + " Motion Strength", "Global " + cap(type) + " Group"]; }
  function cap(text) { return text.charAt(0).toUpperCase() + text.substr(1); }
  function transformProperty(layer, type) { var transform = layer.property("ADBE Transform Group"); if (type === "position") return transform.property("ADBE Position"); if (type === "rotation") return transform.property("ADBE Rotate Z"); if (type === "scale") return transform.property("ADBE Scale"); return null; }
  function isSupported(layer) { return layer && !layer.threeDLayer && !layer.property("ADBE Transform Group").property("ADBE Position").dimensionsSeparated; }
  function propertyHasExternalExpression(prop, type) { return prop.expressionEnabled && prop.expression && prop.expression.indexOf(MARKER + type) !== 0; }
  function waveExpression(title) {
    return "var mode=Math.round(thisLayer.effect(\"" + PREFIX + " " + title + " Motion Mode\")(1));\nvar strength=thisLayer.effect(\"" + PREFIX + " " + title + " Motion Strength\")(1)/100;\nvar t=((time+o/25)%2)/2; if(t<0)t+=1;\nvar s=Math.sin(2*Math.PI*t); var w=s;\nfunction tri(x){return x<.25?4*x:(x<.75?2-4*x:-4+4*x);}\nif(mode==1){w=tri(t);} else if(mode==2){var a=Math.abs(s); var shaped=1-Math.pow(1-a,1+strength*1.8); w=s<0?-shaped:shaped;} else if(mode==3){var tt=t+0.035*strength*Math.sin(4*Math.PI*t); w=Math.sin(2*Math.PI*tt);} else if(mode==4){var flow=(Math.sin(2*Math.PI*t)+0.18*strength*Math.sin(4*Math.PI*t+Math.PI/3)+0.08*strength*Math.sin(6*Math.PI*t+Math.PI/5))/(1+0.26*strength); w=flow;}\n";
  }
  function expression(type) {
    var common = "// AEMGR:v1:" + type + "\nvar p=thisLayer.effect(\"" + PREFIX + " ";
    if (type === "position") return common + "Position Enabled\")(1);\nvar x=thisLayer.effect(\"" + PREFIX + " Position X Amplitude\")(1);\nvar y=thisLayer.effect(\"" + PREFIX + " Position Y Amplitude\")(1);\nvar o=thisLayer.effect(\"" + PREFIX + " Position Offset Frames\")(1);\nvar xd=1; try{xd=thisLayer.effect(\"" + PREFIX + " Position X Direction\")(1);}catch(e){}\n" + waveExpression("Position") + "value+[x*w*p*xd,y*w*p];";
    var title = cap(type); var unit = type === "rotation" ? "" : "/100";
    return common + title + " Enabled\")(1);\nvar a=thisLayer.effect(\"" + PREFIX + " " + title + " Amplitude\")(1)/2;\nvar o=thisLayer.effect(\"" + PREFIX + " " + title + " Offset Frames\")(1);\n" + waveExpression(title) + (type === "scale" ? "value*(1+(a*w*p)/100);" : "var d=1; try{d=thisLayer.effect(\"" + PREFIX + " Rotation Direction\")(1);}catch(e){}\nvalue+a*w*p*d;");
  }
  function ensureControl(layer, type) {
    var prop = transformProperty(layer, type); if (!prop) throw new Error("图层没有可用的 " + type + " 属性。");
    if (propertyHasExternalExpression(prop, type)) throw new Error("“" + layer.name + "”的此属性已有非本插件表达式，已跳过。");
    addSlider(layer, "Registered", 1);
    if (type === "position") { addSlider(layer, "Position Enabled", 1); addSlider(layer, "Position X Amplitude", number(layer, "Position X Amplitude", 0)); addSlider(layer, "Position Y Amplitude", number(layer, "Position Y Amplitude", 0)); addSlider(layer, "Position Offset Frames", number(layer, "Position Offset Frames", 0)); addSlider(layer, "Position X Direction", number(layer, "Position X Direction", 1)); addSlider(layer, "Position Motion Mode", number(layer, "Position Motion Mode", 0)); addSlider(layer, "Position Motion Strength", number(layer, "Position Motion Strength", 50)); }
    else { var title = cap(type); addSlider(layer, title + " Enabled", 1); addSlider(layer, title + " Amplitude", number(layer, title + " Amplitude", 0)); addSlider(layer, title + " Offset Frames", number(layer, title + " Offset Frames", 0)); addSlider(layer, title + " Motion Mode", number(layer, title + " Motion Mode", 0)); addSlider(layer, title + " Motion Strength", number(layer, title + " Motion Strength", 50)); if (type === "rotation") addSlider(layer, "Rotation Direction", number(layer, "Rotation Direction", 1)); }
    prop.expression = expression(type); prop.expressionEnabled = true;
  }
  function removeNamed(layer, names) { var i, item; for (i = names.length - 1; i >= 0; i--) { item = fx(layer, names[i]); if (item) item.remove(); } }
  function thumbnailFolder() { var folder = new Folder(Folder.temp.fsName + "/AEMGR_Thumbnails"); if (!folder.exists) folder.create(); return folder; }
  function firstThumbnail(folder, prefix) { var files = folder.getFiles(prefix + "*.png"), i, file, best = null, bestTime = 0; if (!files) return null; for (i = 0; i < files.length; i++) { file = files[i]; try { if (file instanceof File && file.exists && file.length > 0 && file.modified.getTime() >= bestTime) { best = file; bestTime = file.modified.getTime(); } } catch (ignore) {} } return best ? best.fsName : null; }
  function thumbnailPrefix(comp, layer, source) { return "aemgr_" + comp.id + "_" + layer.index + "_" + source.id + "_"; }
  function waitForFile(file, timeoutMs) {
    var start = (new Date()).getTime(), last = -1, stable = 0, size = 0;
    while (((new Date()).getTime() - start) < timeoutMs) {
      if (file.exists) {
        try { size = file.length; } catch (ignore) { size = 1; }
        if (size > 0 && size === last) { stable++; if (stable >= 2) return true; }
        else { stable = 0; last = size; }
      }
      $.sleep(120);
    }
    return file.exists;
  }
  function renderThumbnail(comp, layer, force) {
    var source, folder, prefix, existing, failed, tempComp, previewLayer, file, width, height, result = null;
    try {
      if (!(layer instanceof AVLayer) || !layer.source) return null;
      source = layer.source; folder = thumbnailFolder(); prefix = thumbnailPrefix(comp, layer, source);
      existing = firstThumbnail(folder, prefix); if (existing && !force) return existing; failed = new File(folder.fsName + "/" + prefix + "unavailable.txt"); if (failed.exists && !force) return null; if (failed.exists && force) failed.remove();
      width = Math.max(1, Number(source.width) || 160); height = Math.max(1, Number(source.height) || 90);
      file = new File(folder.fsName + "/" + prefix + "preview_" + ((new Date()).getTime()) + ".png");
      if (source instanceof CompItem && source.saveFrameToPng) {
        source.saveFrameToPng(source.time, file);
      } else {
        tempComp = app.project.items.addComp(PREFIX + " Thumbnail Temp", width, height, 1, 1, 25);
        tempComp.hideShyLayers = true; previewLayer = tempComp.layers.add(source);
        previewLayer.property("ADBE Transform Group").property("ADBE Position").setValue([width / 2, height / 2]);
        tempComp.saveFrameToPng(0, file);
      }
      result = waitForFile(file, 3000) ? file.fsName : null;
      if (!result) throw new Error("saveFrameToPng 未在 3 秒内写入 PNG 文件。");
    } catch (error) { result = null; try { failed.open("w"); failed.write(String(error)); failed.close(); } catch (writeFailure) {} }
    finally {
      try { if (tempComp) tempComp.remove(); } catch (removeCompError) {}
    }
    return result;
  }
  function clearThumbnailForLayer(comp, layer) {
    var source, folder, prefix, files, i, removed = 0;
    try {
      if (!(layer instanceof AVLayer) || !layer.source) return 0;
      source = layer.source; folder = thumbnailFolder(); prefix = thumbnailPrefix(comp, layer, source);
      files = folder.getFiles(prefix + "*");
      for (i = 0; i < files.length; i++) { try { if (files[i] instanceof File) { files[i].remove(); removed++; } } catch (ignore) {} }
    } catch (e) {}
    return removed;
  }
  function thumbnailForLayer(comp, layer, allowRender) {
    var source = layer.source, path = null, folder, prefix;
    try { if (source && source.file && /\.(png|jpe?g|gif|bmp)$/i.test(source.file.name)) path = source.file.fsName; } catch (ignore) {}
    if (path) return path;
    try { if (source) { folder = thumbnailFolder(); prefix = thumbnailPrefix(comp, layer, source); path = firstThumbnail(folder, prefix); } } catch (cacheError) {}
    return path || (allowRender ? renderThumbnail(comp, layer, true) : null);
  }
  function mirrorGroup(layer) { return number(layer, "Mirror Group", 0); }
  function mirrorLinked(layer) { return mirrorGroup(layer) && number(layer, "Mirror Link", 0) > 0.5; }
  function globalGroupName(type) { return "Global " + (type === "position" ? "Position" : cap(type)) + " Group"; }
  function globalGroup(layer, type) { return number(layer, globalGroupName(type), 0); }
  function globalLinks(layer) {
    var out = {}, types = ["position", "rotation", "scale"], i, type, group;
    for (i = 0; i < types.length; i++) { type = types[i]; group = globalGroup(layer, type); if (group) out[type] = group; }
    return out;
  }
  function nextGlobalGroup(type) {
    var max = 0, i, comp, j, layer, group;
    for (i = 1; i <= app.project.numItems; i++) {
      comp = app.project.item(i);
      if (!(comp instanceof CompItem)) continue;
      for (j = 1; j <= comp.numLayers; j++) {
        layer = comp.layer(j);
        if (registered(layer)) { group = globalGroup(layer, type); if (group > max) max = group; }
      }
    }
    return max + 1;
  }
  function groupValue(groups) { var out = []; if (groups.position) out.push("p" + groups.position); if (groups.rotation) out.push("r" + groups.rotation); if (groups.scale) out.push("s" + groups.scale); return out.join("|"); }
  function groupLabel(groups) { var out = []; if (groups.position) out.push("P" + pad2(groups.position)); if (groups.rotation) out.push("R" + pad2(groups.rotation)); if (groups.scale) out.push("C" + pad2(groups.scale)); return out.join(" "); }
  function groupSortKey(groups) { var mask = (groups.position ? 4 : 0) + (groups.rotation ? 2 : 0) + (groups.scale ? 1 : 0), rank = mask === 7 ? 0 : (mask === 4 ? 1 : (mask === 2 ? 2 : (mask === 1 ? 3 : (mask === 6 ? 4 : (mask === 5 ? 5 : 6))))); return rank * 1000000 + (Number(groups.position) || 9999) * 10000 + (Number(groups.rotation) || 9999) * 100 + (Number(groups.scale) || 9999); }
  function pad2(value) { value = Math.max(0, Math.round(Number(value) || 0)); return value < 10 ? "0" + value : String(value); }
  function sourceForGlobalGroup(type, group, exceptLayer) {
    var i, comp, j, layer;
    if (!group) return null;
    for (i = 1; i <= app.project.numItems; i++) {
      comp = app.project.item(i);
      if (!(comp instanceof CompItem)) continue;
      for (j = 1; j <= comp.numLayers; j++) {
        layer = comp.layer(j);
        if (layer !== exceptLayer && registered(layer) && globalGroup(layer, type) === group && fx(layer, type === "position" ? "Position Enabled" : cap(type) + " Enabled")) return layer;
      }
    }
    return null;
  }
  function linkedGlobalLayers(layer, type) {
    var group = globalGroup(layer, type), out = [], i, comp, j, candidate;
    if (!group) return out;
    for (i = 1; i <= app.project.numItems; i++) {
      comp = app.project.item(i);
      if (!(comp instanceof CompItem)) continue;
      for (j = 1; j <= comp.numLayers; j++) {
        candidate = comp.layer(j);
        if (candidate !== layer && registered(candidate) && globalGroup(candidate, type) === group) out.push(candidate);
      }
    }
    return out;
  }
  function mirrorPeerIndices(comp, layer) {
    var group = mirrorGroup(layer), out = [], i, candidate;
    if (!group) return out;
    for (i = 1; i <= comp.numLayers; i++) {
      candidate = comp.layer(i);
      if (candidate !== layer && registered(candidate) && mirrorGroup(candidate) === group) out.push(candidate.index);
    }
    return out;
  }
  function linkedLayers(comp, layer) {
    var group = mirrorGroup(layer), out = [], i, candidate;
    if (!group || !mirrorLinked(layer)) return out;
    for (i = 1; i <= comp.numLayers; i++) {
      candidate = comp.layer(i);
      if (candidate !== layer && registered(candidate) && mirrorLinked(candidate) && mirrorGroup(candidate) === group) out.push(candidate);
    }
    return out;
  }
  function layerInfo(comp, layer, allowRender) {
    var controls = [], types = ["position", "rotation", "scale"], i, type, prop, exists, base, source = layer.source;
    for (i = 0; i < types.length; i++) { type = types[i]; prop = transformProperty(layer, type); exists = !!fx(layer, cap(type) + " Enabled"); if (type === "position") exists = !!fx(layer, "Position Enabled"); base = prop && prop.numKeys === 0 ? prop.value : null; controls.push({ type: type, exists: exists, enabled: exists ? number(layer, type === "position" ? "Position Enabled" : cap(type) + " Enabled", 0) > 0.5 : false, xAmplitude: number(layer, "Position X Amplitude", 0), yAmplitude: number(layer, "Position Y Amplitude", 0), amplitude: number(layer, cap(type) + " Amplitude", 0), offsetFrames: number(layer, type === "position" ? "Position Offset Frames" : cap(type) + " Offset Frames", 0), motionMode: number(layer, (type === "position" ? "Position" : cap(type)) + " Motion Mode", 0), motionStrength: number(layer, (type === "position" ? "Position" : cap(type)) + " Motion Strength", 50), canEditBase: type !== "position" && prop && prop.numKeys === 0, baseValue: type === "scale" && base ? base[0] : base }); }
    var rect; try { rect = layer.sourceRectAtTime(comp.time, false); } catch (e) { rect = { left: 0, top: 0, width: source ? source.width : 100, height: source ? source.height : 100 }; }
    var anchor = layer.property("ADBE Transform Group").property("ADBE Anchor Point").value;
    var path = thumbnailForLayer(comp, layer, !!allowRender);
    var label = layer instanceof TextLayer ? "文字图层" : layer instanceof ShapeLayer ? "形状图层" : layer instanceof AVLayer && layer.source instanceof CompItem ? "预合成" : "素材图层";
    return { compId: String(comp.id), index: layer.index, name: layer.name, selected: !!layer.selected, typeLabel: label, typeIcon: layer instanceof TextLayer ? "T" : layer instanceof ShapeLayer ? "◇" : layer instanceof AVLayer && layer.source instanceof CompItem ? "◆" : "▣", thumbnailPath: path, mirror: { group: mirrorGroup(layer), linked: mirrorLinked(layer), role: number(layer, "Mirror Role", /01$/.test(layer.name) ? 2 : 1), peers: mirrorPeerIndices(comp, layer) }, globalLinks: globalLinks(layer), controls: controls, anchor: { x: anchor[0] - rect.left, y: anchor[1] - rect.top, width: rect.width || 100, height: rect.height || 100 } };
  }
  function managedLayers(comp, allowRender) { var out = [], i, layer; for (i = 1; i <= comp.numLayers; i++) { layer = comp.layer(i); if (registered(layer)) out.push(layerInfo(comp, layer, allowRender)); } return out; }
  function hasManagedLayers(comp) { var i; if (!comp) return false; for (i = 1; i <= comp.numLayers; i++) { if (registered(comp.layer(i))) return true; } return false; }
  function collectGroups(comp, includeChildren, depth, seen, out, allowRender) { var i, layer, child; if (seen[String(comp.id)]) return; seen[String(comp.id)] = true; out.push({ name: comp.name, depth: depth, layers: managedLayers(comp, !!allowRender) }); if (!includeChildren) return; for (i = 1; i <= comp.numLayers; i++) { layer = comp.layer(i); if (layer instanceof AVLayer && layer.source instanceof CompItem) { child = layer.source; collectGroups(child, true, depth + 1, seen, out, allowRender); } } }
  $.global.AEMGR_listManagedComps = function () {
    try {
      var items = [], i, item, active = app.project && app.project.activeItem instanceof CompItem ? app.project.activeItem : null;
      if (!app.project) return fail("当前没有打开 AE 项目。");
      for (i = 1; i <= app.project.numItems; i++) {
        item = app.project.item(i);
        if (item instanceof CompItem && hasManagedLayers(item)) items.push({ id: String(item.id), name: item.name, width: item.width, height: item.height });
      }
      return reply({ ok: true, activeCompId: active ? String(active.id) : null, activeManaged: active ? hasManagedLayers(active) : false, comps: items });
    } catch (e) { return fail(e.toString()); }
  };
  $.global.AEMGR_getActiveCompSummary = function () {
    try {
      var active = app.project && app.project.activeItem instanceof CompItem ? app.project.activeItem : null;
      return reply({ ok: true, activeCompId: active ? String(active.id) : null, managed: active ? hasManagedLayers(active) : false });
    } catch (e) { return fail(e.toString()); }
  };
  $.global.AEMGR_listGlobalOptions = function () {
    try {
      var map = {}, options = [], i, comp, j, layer, groups, value;
      if (!app.project) return reply({ ok: true, options: [] });
      for (i = 1; i <= app.project.numItems; i++) {
        comp = app.project.item(i);
        if (!(comp instanceof CompItem)) continue;
        for (j = 1; j <= comp.numLayers; j++) {
          layer = comp.layer(j);
          if (!registered(layer)) continue;
          groups = globalLinks(layer); value = groupValue(groups);
          if (value && !map[value]) { map[value] = true; options.push({ value: value, label: groupLabel(groups), groups: groups, sortKey: groupSortKey(groups) }); }
        }
      }
      options.sort(function (a, b) { return a.sortKey - b.sortKey || a.label.localeCompare(b.label); });
      return reply({ ok: true, options: options });
    } catch (e) { return fail(e.toString()); }
  };
  $.global.AEMGR_getPanelState = function (requestText) { try { var request = parse(requestText), comp = getActiveComp(request.compId), groups = []; if (!comp) return fail("请先激活一个合成。"); collectGroups(comp, !!request.includeChildren, 0, {}, groups); return reply({ ok: true, comp: { id: String(comp.id), name: comp.name, width: comp.width, height: comp.height }, groups: groups }); } catch (e) { return fail(e.toString()); } };
  $.global.AEMGR_addSelectedLayers = function (compId) { var comp = getActiveComp(compId), i, layer, count = 0, skipped = 0; if (!comp) return fail("请先激活一个合成。"); app.beginUndoGroup("AEMGR 添加动画图层"); try { for (i = 1; i <= comp.numLayers; i++) { layer = comp.layer(i); if (layer.selected) { if (isSupported(layer)) { addSlider(layer, "Registered", 1); count++; } else skipped++; } } } finally { app.endUndoGroup(); } return reply({ ok: true, message: count ? "已添加 " + count + " 个图层；缩略图按需生成，可点击缩略图刷新按钮。" + (skipped ? " 已跳过 " + skipped + " 个 3D/分离维度图层。" : "") : "没有可添加的 2D 图层。" }); };
  function applyControlPatch(layer, type, patch) {
    var prop, title = cap(type), modeName = (type === "position" ? "Position" : title);
    if (patch.create) ensureControl(layer, type);
    if (patch.enabled !== undefined) addSlider(layer, type === "position" ? "Position Enabled" : title + " Enabled", patch.enabled ? 1 : 0);
    if (patch.xAmplitude !== undefined) addSlider(layer, "Position X Amplitude", clamp(patch.xAmplitude, 0, 100));
    if (patch.yAmplitude !== undefined) addSlider(layer, "Position Y Amplitude", clamp(patch.yAmplitude, 0, 100));
    if (patch.amplitude !== undefined) addSlider(layer, title + " Amplitude", clamp(patch.amplitude, 0, type === "rotation" ? 100 : 50));
    if (patch.offsetFrames !== undefined) addSlider(layer, type === "position" ? "Position Offset Frames" : title + " Offset Frames", clamp(patch.offsetFrames, 0, 49));
    if (patch.motionMode !== undefined) addSlider(layer, modeName + " Motion Mode", clamp(Math.round(patch.motionMode), 0, 4));
    if (patch.motionStrength !== undefined) addSlider(layer, modeName + " Motion Strength", clamp(patch.motionStrength, 0, 100));
    prop = transformProperty(layer, type);
    if (prop && (patch.create || patch.motionMode !== undefined || patch.motionStrength !== undefined)) { prop.expression = expression(type); prop.expressionEnabled = true; }
  }
  function syncLinkedControl(comp, layer, type, patch) {
    var links = linkedLayers(comp, layer), globals = linkedGlobalLayers(layer, type), i;
    for (i = 0; i < links.length; i++) { if (isSupported(links[i])) applyControlPatch(links[i], type, patch); }
    for (i = 0; i < globals.length; i++) { if (isSupported(globals[i])) applyControlPatch(globals[i], type, patch); }
  }
  $.global.AEMGR_updateControl = function (compId, index, type, patchText) { var comp = findComp(compId), layer, patch = parse(patchText); if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer || !isSupported(layer)) return fail("图层不支持 2D 控制。"); app.beginUndoGroup("AEMGR 更新控制"); try { if (type === "anchor") { return updateAnchor(comp, layer, patch); } applyControlPatch(layer, type, patch); syncLinkedControl(comp, layer, type, patch); } catch (e) { return fail(e.toString()); } finally { app.endUndoGroup(); } return reply({ ok: true, message: "" }); };
  $.global.AEMGR_selectLayer = function (compId, index, patchText) { var comp = findComp(compId), patch = parse(patchText), i, layer; if (!comp) return fail("目标合成已不可用。"); app.beginUndoGroup("AEMGR 选择图层"); try { if (!patch.additive) for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false; layer = comp.layer(Number(index)); if (!layer) return fail("目标图层已不可用。"); layer.selected = !!patch.selected; comp.openInViewer(); } finally { app.endUndoGroup(); } return reply({ ok: true, message: "" }); };
  $.global.AEMGR_renameLayer = function (compId, index, name) { var comp = findComp(compId), layer, next = String(name || "").replace(/^\s+|\s+$/g, ""); if (!comp) return fail("目标合成已不可用。"); if (!next) return fail("图层名称不能为空。"); layer = comp.layer(Number(index)); if (!layer) return fail("目标图层已不可用。"); app.beginUndoGroup("AEMGR 修改图层名称"); try { layer.name = next; } finally { app.endUndoGroup(); } return reply({ ok: true, message: "已同步修改 AE 时间轴图层名称。", name: layer.name }); };
  function updateAnchor(comp, layer, patch) { var transform = layer.property("ADBE Transform Group"), anchor = transform.property("ADBE Anchor Point"), position = transform.property("ADBE Position"), scale = transform.property("ADBE Scale"), rotation = transform.property("ADBE Rotate Z"), old = anchor.value, rect = layer.sourceRectAtTime(comp.time, false), next = [rect.left + rect.width * patch.xRatio, rect.top + rect.height * patch.yRatio], delta = [next[0] - old[0], next[1] - old[1]], s = scale.value, r = rotation.value * Math.PI / 180, dx = delta[0] * s[0] / 100, dy = delta[1] * s[1] / 100, rotated = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)], p;
    if (anchor.numKeys || position.numKeys) throw new Error("锚点或位置已有关键帧，首版不能安全保持画面位置。"); anchor.setValue(next); p = position.value; position.setValue([p[0] + rotated[0], p[1] + rotated[1]]); return reply({ ok: true, message: "" }); }
  function anchorRatio(comp, layer) { var rect, anchor; try { rect = layer.sourceRectAtTime(comp.time, false); } catch (e) { rect = { left: 0, top: 0, width: layer.source ? layer.source.width : 100, height: layer.source ? layer.source.height : 100 }; } anchor = layer.property("ADBE Transform Group").property("ADBE Anchor Point").value; return { xRatio: rect.width ? (anchor[0] - rect.left) / rect.width : 0.5, yRatio: rect.height ? (anchor[1] - rect.top) / rect.height : 0.5 }; }
  function applyAnchorRatio(comp, layer, ratio) { try { updateAnchor(comp, layer, ratio); } catch (ignore) {} }
  function removeControlOnLayer(layer, type) { var prop = transformProperty(layer, type); if (prop && prop.expression && prop.expression.indexOf(MARKER + type) === 0) { prop.expression = ""; prop.expressionEnabled = false; } removeNamed(layer, controlNames(type)); }
  $.global.AEMGR_removeControl = function (compId, index, type) { var comp = findComp(compId), layer, links, i; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); app.beginUndoGroup("AEMGR 移除控制"); try { links = linkedLayers(comp, layer); removeControlOnLayer(layer, type); for (i = 0; i < links.length; i++) removeControlOnLayer(links[i], type); } finally { app.endUndoGroup(); } return reply({ ok: true, message: "" }); };
  $.global.AEMGR_removeAll = function (compId, index) { var types = ["position", "rotation", "scale"], i, comp = findComp(compId); if (!comp) return fail("目标合成已不可用。"); app.beginUndoGroup("AEMGR 清理图层控制"); try { for (i = 0; i < types.length; i++) { var layer = comp.layer(Number(index)), prop = transformProperty(layer, types[i]); if (prop && prop.expression && prop.expression.indexOf(MARKER + types[i]) === 0) { prop.expression = ""; prop.expressionEnabled = false; } removeNamed(layer, controlNames(types[i])); } removeNamed(comp.layer(Number(index)), ["Registered"]); } finally { app.endUndoGroup(); } return reply({ ok: true, message: "" }); };
  $.global.AEMGR_batchOffsets = function (compId, type, mode, includeChildrenText) { var comp = findComp(compId), groups = [], layers = [], i, j, candidate, name, value; if (!comp) return fail("目标合成已不可用。"); collectGroups(comp, includeChildrenText === "true", 0, {}, groups); for (i = 0; i < groups.length; i++) for (j = 0; j < groups[i].layers.length; j++) { candidate = groups[i].layers[j]; if (fx(findComp(candidate.compId).layer(candidate.index), type === "position" ? "Position Enabled" : cap(type) + " Enabled")) { candidate.groupOrder = i; layers.push(candidate); } }
    layers.sort(function (a, b) { return a.groupOrder === b.groupOrder ? a.index - b.index : a.groupOrder - b.groupOrder; }); app.beginUndoGroup("AEMGR 批量偏移"); try { for (i = 0; i < layers.length; i++) { value = mode === "random" ? Math.floor(Math.random() * CYCLE_FRAMES) : (layers.length <= 1 ? 0 : Math.round(i * (CYCLE_FRAMES - 1) / (layers.length - 1))); name = type === "position" ? "Position Offset Frames" : cap(type) + " Offset Frames"; addSlider(findComp(layers[i].compId).layer(layers[i].index), name, value); } } finally { app.endUndoGroup(); } return reply({ ok: true, message: layers.length ? "已为 " + layers.length + " 个图层设置" + (mode === "random" ? "随机" : "平均") + "偏移。" : "当前筛选没有可批量处理的图层。" }); };
  $.global.AEMGR_setMirrorLink = function (compId, index, enabledText) { var comp = findComp(compId), layer, group, value, i, candidate; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer) return fail("目标图层已不可用。"); group = mirrorGroup(layer); if (!group) return fail("此图层没有镜像关联。"); value = String(enabledText) === "true" ? 1 : 0; app.beginUndoGroup("AEMGR 镜像关联"); try { for (i = 1; i <= comp.numLayers; i++) { candidate = comp.layer(i); if (mirrorGroup(candidate) === group) addSlider(candidate, "Mirror Link", value); } } finally { app.endUndoGroup(); } return reply({ ok: true, message: value ? "镜像关联已开启。" : "镜像关联已关闭。" }); };
  $.global.AEMGR_clearThumbnailCache = function () { var folder = thumbnailFolder(), files, i, removed = 0; try { files = folder.getFiles("*"); for (i = 0; i < files.length; i++) { try { if (files[i] instanceof File) { files[i].remove(); removed++; } } catch (ignore) {} } return reply({ ok: true, message: "已清除 " + removed + " 个缩略图缓存文件。" }); } catch (e) { return fail(e.toString()); } };
  $.global.AEMGR_refreshThumbnails = function (compId, includeChildrenText) { var comp = findComp(compId), groups = [], i, j, layerInfoItem, layer, refreshed = 0, failed = 0, removed = 0; if (!comp) return fail("目标合成已不可用。"); collectGroups(comp, includeChildrenText === "true", 0, {}, groups, false); for (i = 0; i < groups.length; i++) { for (j = 0; j < groups[i].layers.length; j++) { layerInfoItem = groups[i].layers[j]; comp = findComp(layerInfoItem.compId); if (!comp) continue; layer = comp.layer(layerInfoItem.index); removed += clearThumbnailForLayer(comp, layer); try { if (thumbnailForLayer(comp, layer, true)) refreshed++; else failed++; } catch (thumbError) { failed++; } } } return reply({ ok: true, message: "已刷新 " + refreshed + " 个缩略图" + (failed ? "；" + failed + " 个生成失败。" : "。") + (removed ? " 已清理旧缓存 " + removed + " 个。" : "") }); };
  $.global.AEMGR_refreshLayerThumbnail = function (compId, index) { var comp = findComp(compId), layer, removed = 0, path = null; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer) return fail("目标图层已不可用。"); removed = clearThumbnailForLayer(comp, layer); try { path = thumbnailForLayer(comp, layer, true); } catch (thumbError) { return fail("缩略图刷新失败：" + thumbError.toString()); } return reply({ ok: !!path, message: path ? "已刷新 #" + layer.index + " 的缩略图" + (removed ? "，并清理旧缓存 " + removed + " 个。" : "。") : "此图层无法生成缩略图。" }); };
  function controlPatchFromLayer(layer, type) { if (type === "position") return { create: true, enabled: number(layer, "Position Enabled", 0) > 0.5, xAmplitude: number(layer, "Position X Amplitude", 0), yAmplitude: number(layer, "Position Y Amplitude", 0), offsetFrames: number(layer, "Position Offset Frames", 0), motionMode: number(layer, "Position Motion Mode", 0), motionStrength: number(layer, "Position Motion Strength", 50) }; return { create: true, enabled: number(layer, cap(type) + " Enabled", 0) > 0.5, amplitude: number(layer, cap(type) + " Amplitude", 0), offsetFrames: number(layer, cap(type) + " Offset Frames", 0), motionMode: number(layer, cap(type) + " Motion Mode", 0), motionStrength: number(layer, cap(type) + " Motion Strength", 50) }; }
  $.global.AEMGR_copyGlobalLink = function (compId, index, scope) { var comp = findComp(compId), layer, types = ["position", "rotation", "scale"], data = { params: {}, groups: {} }, i, type, exists, group, count = 0; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer || !isSupported(layer)) return fail("图层不支持 2D 控制。"); app.beginUndoGroup("AEMGR 全局关联复制"); try { for (i = 0; i < types.length; i++) { type = types[i]; if (scope !== "all" && scope !== type) continue; exists = !!fx(layer, type === "position" ? "Position Enabled" : cap(type) + " Enabled"); if (!exists) continue; group = globalGroup(layer, type); if (!group) { group = nextGlobalGroup(type); addSlider(layer, globalGroupName(type), group); } data.params[type] = controlPatchFromLayer(layer, type); data.groups[type] = group; count++; } } finally { app.endUndoGroup(); } return count ? reply({ ok: true, message: "已复制全局关联。", data: data }) : fail("这个图层没有可建立全局关联的动画参数。"); };
  $.global.AEMGR_createGlobalLink = function (compId, index, scope) { var comp = findComp(compId), layer, types = ["position", "rotation", "scale"], groups = {}, i, type, exists, count = 0; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer || !isSupported(layer)) return fail("图层不支持 2D 控制。"); app.beginUndoGroup("AEMGR 存为全局关联"); try { for (i = 0; i < types.length; i++) { type = types[i]; if (scope !== "all" && scope !== type) continue; exists = !!fx(layer, type === "position" ? "Position Enabled" : cap(type) + " Enabled"); if (!exists) continue; groups[type] = nextGlobalGroup(type); addSlider(layer, globalGroupName(type), groups[type]); count++; } } finally { app.endUndoGroup(); } return count ? reply({ ok: true, message: "已将当前动画参数存为新的全局关联：" + groupLabel(groups), groups: groups }) : fail("这个图层没有已添加的动画参数可存为全局关联。"); };
  $.global.AEMGR_pasteGlobalLink = function (compId, index, payloadText) { var comp = findComp(compId), layer, payload = parse(payloadText), types = ["position", "rotation", "scale"], i, type, count = 0; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer || !isSupported(layer)) return fail("图层不支持 2D 控制。"); if (!payload || !payload.groups) return fail("还没有复制过全局关联。"); app.beginUndoGroup("AEMGR 全局关联粘贴"); try { addSlider(layer, "Registered", 1); for (i = 0; i < types.length; i++) { type = types[i]; if (!payload.groups[type] || !payload.params[type]) continue; addSlider(layer, globalGroupName(type), payload.groups[type]); applyControlPatch(layer, type, payload.params[type]); syncLinkedControl(comp, layer, type, payload.params[type]); count++; } } finally { app.endUndoGroup(); } return count ? reply({ ok: true, message: "已粘贴全局关联。" }) : fail("剪贴板里没有可粘贴的全局关联。"); };
  $.global.AEMGR_setGlobalLinks = function (compId, index, groupsText) { var comp = findComp(compId), layer, groups = parse(groupsText), types = ["position", "rotation", "scale"], i, type, group, source, count = 0; if (!comp) return fail("目标合成已不可用。"); layer = comp.layer(Number(index)); if (!layer || !isSupported(layer)) return fail("图层不支持 2D 控制。"); app.beginUndoGroup("AEMGR 设置全局关联"); try { addSlider(layer, "Registered", 1); for (i = 0; i < types.length; i++) { type = types[i]; group = groups && groups[type] ? Number(groups[type]) : 0; if (!group) { removeNamed(layer, [globalGroupName(type)]); continue; } source = sourceForGlobalGroup(type, group, layer); if (source) applyControlPatch(layer, type, controlPatchFromLayer(source, type)); addSlider(layer, globalGroupName(type), group); if (source) syncLinkedControl(comp, layer, type, controlPatchFromLayer(source, type)); count++; } } finally { app.endUndoGroup(); } return reply({ ok: true, message: count ? "已设置全局关联：" + groupLabel(groups) : "已清除全局关联。" }); };
  $.global.AEMGR_mapAnimationsByName = function (sourceCompId, targetCompId) { var sourceComp = findComp(sourceCompId), targetComp = findComp(targetCompId), sourceByName = {}, i, j, source, target, types = ["position", "rotation", "scale"], type, group, patch, matched = 0, applied = 0, skipped = 0; if (!sourceComp || !targetComp) return fail("A/B 合成已不可用。"); app.beginUndoGroup("AEMGR 动画映射"); try { for (i = 1; i <= sourceComp.numLayers; i++) { source = sourceComp.layer(i); if (registered(source) && !sourceByName[source.name]) sourceByName[source.name] = source; } for (i = 1; i <= targetComp.numLayers; i++) { target = targetComp.layer(i); source = sourceByName[target.name]; if (!source || !isSupported(target)) { if (source) skipped++; continue; } matched++; addSlider(target, "Registered", 1); for (j = 0; j < types.length; j++) { type = types[j]; if (!fx(source, type === "position" ? "Position Enabled" : cap(type) + " Enabled")) continue; if (type === "rotation") applyAnchorRatio(targetComp, target, anchorRatio(sourceComp, source)); group = globalGroup(source, type); if (!group) { group = nextGlobalGroup(type); addSlider(source, globalGroupName(type), group); } patch = controlPatchFromLayer(source, type); applyControlPatch(target, type, patch); addSlider(target, globalGroupName(type), group); applied++; } } } catch (e) { return fail(e.toString()); } finally { app.endUndoGroup(); } return reply({ ok: true, message: matched ? "动画映射完成：匹配 " + matched + " 个同名图层，写入 " + applied + " 组参数。缩略图可按需手动刷新。" + (skipped ? " 已跳过 " + skipped + " 个不支持图层。" : "") : "没有找到完全同名的可映射图层。" }); };
  $.global.AEMGR_mirrorSelectedLayers = function (compId) { var comp = findComp(compId), originals = [], i, layer, copy, seed; if (!comp) return fail("目标合成已不可用。"); for (i = comp.numLayers; i >= 1; i--) { layer = comp.layer(i); if (layer.selected && isSupported(layer)) originals.push(layer); } if (!originals.length) return reply({ ok: false, message: "请先在插件中选择要镜像的 2D 图层。" }); seed = (new Date()).getTime() % 1000000; app.beginUndoGroup("AEMGR 镜像图层"); try { for (i = 0; i < originals.length; i++) { copy = mirrorLayer(comp, originals[i], seed + originals[i].index * 100 + i); copy.selected = true; } comp.openInViewer(); } catch (e) { return fail(e.toString()); } finally { app.endUndoGroup(); } return reply({ ok: true, message: "已镜像复制 " + originals.length + " 个图层；缩略图可按需手动刷新。" }); };
  function mirrorLayer(comp, layer, group) { var copy = layer.duplicate(), transform = copy.property("ADBE Transform Group"), pos = transform.property("ADBE Position"), scale = transform.property("ADBE Scale"), rot = transform.property("ADBE Rotate Z"); copy.name = "镜像_" + layer.name; addSlider(layer, "Mirror Group", group); addSlider(layer, "Mirror Link", 1); addSlider(layer, "Mirror Role", 1); addSlider(copy, "Mirror Group", group); addSlider(copy, "Mirror Link", 1); addSlider(copy, "Mirror Role", 2); mirrorPosition(comp, pos); mirrorScale(scale); mirrorRotation(rot); if (fx(copy, "Position Enabled")) { addSlider(copy, "Position X Direction", -number(copy, "Position X Direction", 1)); pos.expression = expression("position"); pos.expressionEnabled = true; } if (fx(copy, "Rotation Enabled")) { addSlider(copy, "Rotation Direction", -number(copy, "Rotation Direction", 1)); rot.expression = expression("rotation"); rot.expressionEnabled = true; } return copy; }
  function expressionState(prop) { var state = { enabled: false }; try { state.enabled = prop.expressionEnabled; if (state.enabled) prop.expressionEnabled = false; } catch (ignore) {} return state; }
  function restoreExpressionState(prop, state) { try { prop.expressionEnabled = state.enabled; } catch (ignore) {} }
  function mirrorPosition(comp, prop) { var i, v, inTangent, outTangent, state; if (prop.numKeys) { for (i = 1; i <= prop.numKeys; i++) { v = prop.keyValue(i); prop.setValueAtKey(i, [comp.width - v[0], v[1]]); try { inTangent = prop.keyInSpatialTangent(i); outTangent = prop.keyOutSpatialTangent(i); prop.setSpatialTangentsAtKey(i, [-inTangent[0], inTangent[1]], [-outTangent[0], outTangent[1]]); } catch (ignore) {} } } else { state = expressionState(prop); try { v = prop.value; prop.setValue([comp.width - v[0], v[1]]); } finally { restoreExpressionState(prop, state); } } }
  function mirrorScale(prop) { var i, v, state; if (prop.numKeys) { for (i = 1; i <= prop.numKeys; i++) { v = prop.keyValue(i); prop.setValueAtKey(i, [-v[0], v[1]]); } } else { state = expressionState(prop); try { v = prop.value; prop.setValue([-v[0], v[1]]); } finally { restoreExpressionState(prop, state); } } }
  function mirrorRotation(prop) { var i, v, state; if (prop.numKeys) { for (i = 1; i <= prop.numKeys; i++) { v = prop.keyValue(i); prop.setValueAtKey(i, -v); } } else { state = expressionState(prop); try { v = prop.value; prop.setValue(-v); } finally { restoreExpressionState(prop, state); } } }
}());
