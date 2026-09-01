/* global require */
(function () {
  'use strict';
  var node;
  try { node = { fs: require('fs'), path: require('path'), os: require('os'), https: require('https'), crypto: require('crypto'), child: require('child_process') }; } catch (_) { return; }
  var root = decodeURIComponent(location.pathname).replace(/^\/+/, '').replace(/\/client\/index\.html$/i, '').split('/').join(node.path.sep);
  var configPath = node.path.join(root, 'updater-config.json');
  function respond(done, value) { window.setTimeout(function () { done(value); }, 0); }
  function versionParts(value) { return String(value || '0').replace(/^v/, '').split('.').map(function (part) { return parseInt(part, 10) || 0; }); }
  function isNewer(remote, current) { var a = versionParts(remote), b = versionParts(current), i; for (i = 0; i < Math.max(a.length, b.length); i += 1) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return false; }
  function get(url, redirects, done) {
    node.https.get(url, { headers: { 'User-Agent': 'AEAnimationManagerBasicUpdater', 'Cache-Control': 'no-cache' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) { get(res.headers.location, redirects + 1, done); return; }
      if (res.statusCode !== 200) { done(new Error('HTTP ' + res.statusCode)); return; }
      var chunks = []; res.on('data', function (chunk) { chunks.push(chunk); }); res.on('end', function () { done(null, Buffer.concat(chunks)); });
    }).on('error', done);
  }
  function readConfig(done) { node.fs.readFile(configPath, 'utf8', function (error, value) { if (error) { done(error); return; } try { done(null, JSON.parse(value)); } catch (parseError) { done(parseError); } }); }
  function cacheBust(url) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now(); }
  function check(currentVersion, done) {
    readConfig(function (configError, config) {
      if (configError) { respond(done, { ok: false, message: '缺少更新配置：' + configError.message }); return; }
      get(cacheBust(config.manifestUrl), 0, function (downloadError, data) {
        if (downloadError) { respond(done, { ok: false, message: downloadError.message }); return; }
        var manifest; try { manifest = JSON.parse(data.toString('utf8')); } catch (parseError) { respond(done, { ok: false, message: '更新清单格式错误' }); return; }
        if (!manifest.version || !manifest.package || !manifest.package.url || !manifest.package.sha256) { respond(done, { ok: false, message: '更新清单不完整' }); return; }
        respond(done, { ok: true, update: isNewer(manifest.version, currentVersion) ? manifest : null });
      });
    });
  }
  function quote(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }
  function prepare(update, done) {
    get(update.package.url, 0, function (downloadError, data) {
      if (downloadError) { respond(done, { ok: false, message: '下载失败：' + downloadError.message }); return; }
      var actual = node.crypto.createHash('sha256').update(data).digest('hex').toLowerCase();
      if (actual !== String(update.package.sha256).toLowerCase()) { respond(done, { ok: false, message: '校验失败，已拒绝安装' }); return; }
      var tempRoot = node.fs.mkdtempSync(node.path.join(node.os.tmpdir(), 'AEAMBasicUpdate-'));
      var zipPath = node.path.join(tempRoot, update.package.fileName || 'update.zip');
      var extractPath = node.path.join(tempRoot, 'extracted');
      var scriptPath = node.path.join(tempRoot, 'apply-after-ae-close.ps1');
      try {
        node.fs.writeFileSync(zipPath, data);
        node.fs.mkdirSync(extractPath);
        var ps = '$ErrorActionPreference="Stop"\n' +
          '$zip=' + quote(zipPath) + '\n$extract=' + quote(extractPath) + '\n' +
          'Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force\n' +
          '$payload=Get-ChildItem -LiteralPath $extract -Directory | Where-Object { Test-Path (Join-Path $_.FullName "CSXS\\manifest.xml") } | Select-Object -First 1\n' +
          'if(-not $payload){$payload=$extract}\n' +
          'while(Get-Process -Name AfterFX -ErrorAction SilentlyContinue){Start-Sleep -Seconds 2}\n' +
          '$target=Join-Path $env:APPDATA "Adobe\\CEP\\extensions\\AEExpressionAnimationManagerBasic"\n' +
          '$backup=$target+".backup-"+(Get-Date -Format "yyyyMMdd-HHmmss")\n' +
          'if(Test-Path -LiteralPath $target){Move-Item -LiteralPath $target -Destination $backup -Force}\n' +
          'New-Item -ItemType Directory -Path $target -Force | Out-Null\n' +
          'Copy-Item -LiteralPath (Join-Path $payload "CSXS") -Destination $target -Recurse -Force\n' +
          'Copy-Item -LiteralPath (Join-Path $payload "client") -Destination $target -Recurse -Force\n' +
          'Copy-Item -LiteralPath (Join-Path $payload "host") -Destination $target -Recurse -Force\n' +
          'Get-ChildItem -LiteralPath $payload -File | Where-Object { $_.Name -in @("package.json","updater-config.json","README.md") } | Copy-Item -Destination $target -Force\n' +
          'Remove-Item -LiteralPath ' + quote(tempRoot) + ' -Recurse -Force\n';
        node.fs.writeFileSync(scriptPath, ps, 'utf8');
        node.child.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath], { detached: true, stdio: 'ignore' }).unref();
      } catch (writeError) { respond(done, { ok: false, message: writeError.message }); return; }
      respond(done, { ok: true });
    });
  }
  window.AEAMUpdater = { check: check, prepare: prepare };
}());
