(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const target = $('target');
  const titleBar = $('previewTitleBar');
  const windowBody = $('windowBody');
  const previewImage = $('previewImage');
  const status = $('exportStatus');
  let imageDataUrl = '';
  let syncLock = false;
  const fs = (typeof nw !== 'undefined' && nw.require) ? nw.require('fs') : null;
  const path = (typeof nw !== 'undefined' && nw.require) ? nw.require('path') : null;

  const controlIds = [
    'windowTitle','windowWidth','windowHeight','bodyPadding','windowMargin','bodyColor','frameColor',
    'activeStart','activeEnd','inactiveStart','inactiveEnd','activeText','inactiveText','windowState','windowText',
    'showMin','disableMin','showMax','disableMax','showClose','disableClose',
    'showProgress','disableProgress','progressStyle','progressWidth','progressValue','showProgressValue','progressLabel',
    'showCheckbox','checkboxDisabled','checkboxChecked','checkboxText',
    'showRadio','radioOneChecked','radioOneDisabled','radioTwoDisabled','radioOneText','radioTwoText',
    'showInput','inputDisabled','inputLabel','inputText','inputWidth',
    'showButtons','showOk','disableOk','okDefault','okText','showCancel','disableCancel','cancelText',
    'showStatus','statusOne','statusTwo','statusThree',
    'showImage','imageWidth','exportScale','exportBackground','includeMargin'
  ];

  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const hide = (el, condition) => el.classList.toggle('hidden', condition);

  function readSettings() {
    return {
      title: $('windowTitle').value.trim() || 'Untitled',
      width: clamp($('windowWidth').value, 160, 2000, 760),
      height: clamp($('windowHeight').value, 0, 2000, 0),
      padding: clamp($('bodyPadding').value, 0, 64, 8),
      margin: clamp($('windowMargin').value, 0, 64, 0),
      bodyColor: $('bodyColor').value,
      frameColor: $('frameColor').value,
      activeStart: $('activeStart').value,
      activeEnd: $('activeEnd').value,
      inactiveStart: $('inactiveStart').value,
      inactiveEnd: $('inactiveEnd').value,
      activeText: $('activeText').value,
      inactiveText: $('inactiveText').value,
      inactive: $('windowState').value === 'inactive',
      text: $('windowText').value,
      showMin: $('showMin').checked,
      disableMin: $('disableMin').checked,
      showMax: $('showMax').checked,
      disableMax: $('disableMax').checked,
      showClose: $('showClose').checked,
      disableClose: $('disableClose').checked,
      showProgress: $('showProgress').checked,
      disableProgress: $('disableProgress').checked,
      progressStyle: $('progressStyle').value,
      progressWidth: clamp($('progressWidth').value, 80, 2000, 440),
      progressValue: clamp($('progressValue').value, 0, 100, 60),
      showProgressValue: $('showProgressValue').checked,
      progressLabel: $('progressLabel').value,
      showCheckbox: $('showCheckbox').checked,
      checkboxDisabled: $('checkboxDisabled').checked,
      checkboxChecked: $('checkboxChecked').checked,
      checkboxText: $('checkboxText').value || 'Checkbox',
      showRadio: $('showRadio').checked,
      radioOneChecked: $('radioOneChecked').checked,
      radioOneDisabled: $('radioOneDisabled').checked,
      radioTwoDisabled: $('radioTwoDisabled').checked,
      radioOneText: $('radioOneText').value || 'Normal mode',
      radioTwoText: $('radioTwoText').value || 'Experimental mode',
      showInput: $('showInput').checked,
      inputDisabled: $('inputDisabled').checked,
      inputLabel: $('inputLabel').value || 'Value',
      inputText: $('inputText').value,
      inputWidth: clamp($('inputWidth').value, 100, 2000, 440),
      showButtons: $('showButtons').checked,
      showOk: $('showOk').checked,
      disableOk: $('disableOk').checked,
      okDefault: $('okDefault').checked,
      okText: $('okText').value || 'OK',
      showCancel: $('showCancel').checked,
      disableCancel: $('disableCancel').checked,
      cancelText: $('cancelText').value || 'Cancel',
      showStatus: $('showStatus').checked,
      statusOne: $('statusOne').value,
      statusTwo: $('statusTwo').value,
      statusThree: $('statusThree').value,
      showImage: $('showImage').checked && Boolean(imageDataUrl),
      imageWidth: clamp($('imageWidth').value, 80, 2000, 640),
      exportScale: clamp($('exportScale').value, 1, 4, 2),
      exportBackground: $('exportBackground').value,
      includeMargin: $('includeMargin').checked
    };
  }

  function syncPreview() {
    if (syncLock) return;
    syncLock = true;
    const s = readSettings();

    target.style.width = `${s.width}px`;
    target.style.margin = `${s.margin}px`;
    target.style.backgroundColor = s.frameColor;
    windowBody.style.backgroundColor = s.bodyColor;
    windowBody.style.padding = `${s.padding}px`;
    if (s.height > 0) {
      windowBody.classList.add('fixed-height');
      windowBody.style.setProperty('--body-min-height', `${s.height}px`);
    } else {
      windowBody.classList.remove('fixed-height');
      windowBody.style.removeProperty('--body-min-height');
    }

    $('previewTitle').textContent = s.title;
    $('previewText').textContent = s.text;

    titleBar.classList.toggle('inactive', s.inactive);
    // Set the actual background rather than only custom properties. This makes
    // the user-selected gradient reliable across 98.css versions/builds.
    const barStart = s.inactive ? s.inactiveStart : s.activeStart;
    const barEnd = s.inactive ? s.inactiveEnd : s.activeEnd;
    titleBar.style.backgroundImage = `linear-gradient(90deg, ${barStart}, ${barEnd})`;
    $('previewTitle').style.color = s.inactive ? s.inactiveText : s.activeText;

    const min = $('previewMin');
    const max = $('previewMax');
    const close = $('previewClose');
    hide(min, !s.showMin); hide(max, !s.showMax); hide(close, !s.showClose);
    min.disabled = Boolean(s.disableMin); max.disabled = Boolean(s.disableMax); close.disabled = Boolean(s.disableClose);

    hide($('progressSection'), !s.showProgress);
    $('progressTextPreview').textContent = s.progressLabel;
    hide($('progressValueTextPreview'), !s.showProgressValue);
    $('progressValueTextPreview').textContent = `${Math.round(s.progressValue)}%`;
    $('progressPreview').classList.toggle('segmented', s.progressStyle === 'segmented');
    $('progressPreview').classList.toggle('disabled-look', s.disableProgress);
    $('progressPreview').style.width = `${s.progressWidth}px`;
    $('progressBar').style.width = `${s.progressValue}%`;

    const cb = $('previewCheckbox');
    hide($('checkboxSection'), !s.showCheckbox);
    cb.checked = s.checkboxChecked;
    cb.disabled = s.checkboxDisabled;
    $('previewCheckboxLabel').textContent = s.checkboxText;

    hide($('radioSection'), !s.showRadio);
    const r1 = $('previewRadioOne');
    const r2 = $('previewRadioTwo');
    r1.checked = s.radioOneChecked;
    r2.checked = !s.radioOneChecked;
    r1.disabled = s.radioOneDisabled;
    r2.disabled = s.radioTwoDisabled;
    $('previewRadioOneLabel').textContent = s.radioOneText;
    $('previewRadioTwoLabel').textContent = s.radioTwoText;

    hide($('inputSection'), !s.showInput);
    $('previewInputLabel').textContent = s.inputLabel;
    $('previewInput').value = s.inputText;
    $('previewInput').disabled = s.inputDisabled;
    $('previewInput').style.width = `${s.inputWidth}px`;

    hide($('buttonSection'), !s.showButtons);
    const ok = $('previewOk');
    const cancel = $('previewCancel');
    hide(ok, !s.showOk); hide(cancel, !s.showCancel);
    ok.disabled = s.disableOk;
    cancel.disabled = s.disableCancel;
    ok.classList.toggle('default', s.okDefault && !s.disableOk && s.showOk);
    ok.textContent = s.okText;
    cancel.textContent = s.cancelText;

    hide($('statusSection'), !s.showStatus);
    $('statusOnePreview').textContent = s.statusOne;
    $('statusTwoPreview').textContent = s.statusTwo;
    $('statusThreePreview').textContent = s.statusThree;

    hide(previewImage, !s.showImage);
    if (s.showImage) {
      previewImage.src = imageDataUrl;
      previewImage.style.width = `${s.imageWidth}px`;
    }

    const rect = target.getBoundingClientRect();
    $('sizeLabel').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    syncLock = false;
  }

  function bindControls() {
    for (const id of controlIds) {
      const el = $(id);
      if (!el) continue;
      el.addEventListener('input', syncPreview);
      el.addEventListener('change', syncPreview);
    }

    $('previewCheckbox').addEventListener('change', () => {
      $('checkboxChecked').checked = $('previewCheckbox').checked;
      syncPreview();
    });

    $('previewRadioOne').addEventListener('change', () => {
      if ($('previewRadioOne').checked) $('radioOneChecked').checked = true;
      syncPreview();
    });
    $('previewRadioTwo').addEventListener('change', () => {
      if ($('previewRadioTwo').checked) $('radioOneChecked').checked = false;
      syncPreview();
    });

    $('previewOk').addEventListener('click', () => { status.textContent = 'Preview: OK clicked'; });
    $('previewCancel').addEventListener('click', () => { status.textContent = 'Preview: Cancel clicked'; });
  }

  function bindImage() {
    $('imageFile').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        imageDataUrl = '';
        $('showImage').checked = false;
        syncPreview();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        imageDataUrl = typeof reader.result === 'string' ? reader.result : '';
        $('showImage').checked = Boolean(imageDataUrl);
        syncPreview();
      };
      reader.readAsDataURL(file);
    });
  }

  function isNW() {
    return typeof nw !== 'undefined' && typeof nw.Window?.get === 'function';
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function sanitizeFilename(title) {
    return (title || 'win9x-window')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/[. ]+$/g, '')
      .slice(0, 180) || 'win9x-window';
  }

  function downloadsDir() {
    const os = nw.require('os');
    const pathMod = nw.require('path');
    return pathMod.join(os.homedir(), 'Downloads');
  }

  async function captureTargetWithNW() {
    const s = readSettings();
    const win = nw.Window.get();
    const root = document.documentElement;
    const body = document.body;
    const main = document.querySelector('main');
    const settings = document.querySelector('.settings-window');
    const previewPanel = document.querySelector('.preview-panel');
    const toolbar = document.querySelector('.preview-toolbar');
    const stage = document.querySelector('.stage');
    const capture = document.querySelector('#capture');
    const original = {
      htmlOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyBackground: body.style.background,
      bodyMargin: body.style.margin,
      bodyPadding: body.style.padding,
      mainStyle: main?.getAttribute('style') || '',
      settingsStyle: settings?.getAttribute('style') || '',
      previewStyle: previewPanel?.getAttribute('style') || '',
      toolbarStyle: toolbar?.getAttribute('style') || '',
      stageStyle: stage?.getAttribute('style') || '',
      captureStyle: capture?.getAttribute('style') || '',
      targetStyle: target.getAttribute('style') || '',
      targetClass: target.className,
      bodyClass: body.className
    };

    try {
      // Do NOT resize the NW.js window and do NOT scale #target with CSS.
      // Instead, temporarily turn the editor into a clean export page and
      // use captureScreenshot() with an exact clip rectangle. This prevents
      // the right/bottom edges from being clipped and preserves Chromium's
      // real CSS rendering (98.css shadows, gradients, pseudo-elements, etc.).
      body.classList.add('export-mode');
      root.style.overflow = 'visible';
      body.style.overflow = 'visible';
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.background = s.exportBackground === 'transparent' ? 'transparent' : s.exportBackground;

      if (settings) settings.style.display = 'none';
      if (toolbar) toolbar.style.display = 'none';
      if (main) {
        main.style.display = 'block';
        main.style.width = 'max-content';
        main.style.margin = '0';
        main.style.padding = '0';
      }
      if (previewPanel) {
        previewPanel.style.display = 'block';
        previewPanel.style.width = 'max-content';
        previewPanel.style.margin = '0';
        previewPanel.style.padding = '0';
      }
      if (stage) {
        stage.style.display = 'block';
        stage.style.width = 'max-content';
        stage.style.minWidth = '0';
        stage.style.minHeight = '0';
        stage.style.maxWidth = 'none';
        stage.style.maxHeight = 'none';
        stage.style.overflow = 'visible';
        stage.style.padding = '0';
        stage.style.margin = '0';
        stage.style.background = 'transparent';
      }
      if (capture) {
        capture.style.display = 'block';
        capture.style.width = 'max-content';
        capture.style.margin = '0';
        capture.style.padding = '0';
      }

      target.className = 'window export-target';
      target.style.margin = '0';
      target.style.position = 'relative';
      target.style.left = '0';
      target.style.top = '0';
      target.style.transform = 'none';
      target.style.transformOrigin = 'top left';

      await nextFrame();
      if (document.fonts?.ready) await document.fonts.ready;
      if (s.showImage && previewImage.decode) {
        try { await previewImage.decode(); } catch (_) {}
      }
      await nextFrame();

      const rect = target.getBoundingClientRect();
      const scale = s.exportScale;
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      if (width <= 0 || height <= 0) throw new Error('Export target has no size');

      // clip is expressed in CSS/device-independent pixels. The scale is
      // applied by Chromium when producing the PNG, so we don't need to
      // change the window dimensions or apply a CSS transform.
      const clip = {
        x: Math.max(0, rect.left),
        y: Math.max(0, rect.top),
        width,
        height,
        scale
      };

      const base64 = await new Promise((resolve, reject) => {
        win.captureScreenshot({
          fullSize: true,
          format: 'png',
          clip
        }, (err, data) => {
          if (err) {
            reject(new Error(typeof err === 'string' ? err : (err.message || String(err))));
            return;
          }
          if (!data || typeof data !== 'string') {
            reject(new Error('captureScreenshot returned no image data'));
            return;
          }
          resolve(data);
        });
      });

      const pngBuffer = Buffer.from(base64, 'base64');
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (pngBuffer.length < 8 || !pngBuffer.subarray(0, 8).equals(signature)) {
        throw new Error('captureScreenshot did not return a valid PNG');
      }

      return { buffer: pngBuffer, outputWidth: Math.ceil(width * scale), outputHeight: Math.ceil(height * scale) };
    } finally {
      root.style.overflow = original.htmlOverflow;
      body.style.overflow = original.bodyOverflow;
      body.style.background = original.bodyBackground;
      body.style.margin = original.bodyMargin;
      body.style.padding = original.bodyPadding;
      body.classList.remove('export-mode');
      if (main) main.setAttribute('style', original.mainStyle);
      if (settings) settings.setAttribute('style', original.settingsStyle);
      if (previewPanel) previewPanel.setAttribute('style', original.previewStyle);
      if (toolbar) toolbar.setAttribute('style', original.toolbarStyle);
      if (stage) stage.setAttribute('style', original.stageStyle);
      if (capture) capture.setAttribute('style', original.captureStyle);
      target.setAttribute('style', original.targetStyle);
      target.className = original.targetClass;
      await nextFrame();
      syncPreview();
    }
  }

  function windowsSaveAs(defaultName) {
    return new Promise((resolve, reject) => {
      const cp = nw.require('child_process');
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$d = New-Object System.Windows.Forms.SaveFileDialog',
        `$d.FileName = '${defaultName.replace(/'/g, "''")}'`,
        '$d.Filter = "PNG image (*.png)|*.png|All files (*.*)|*.*"',
        '$d.DefaultExt = "png"',
        '$d.AddExtension = $true',
        '$d.OverwritePrompt = $true',
        'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($d.FileName) }'
      ].join('; ');
      cp.execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true }, (err, stdout) => {
        if (err) reject(err);
        else {
          const chosen = String(stdout || '').trim();
          if (chosen) resolve(chosen); else reject(new Error('SAVE_CANCELLED'));
        }
      });
    });
  }

  async function exportToPath(savePath) {
    const result = await captureTargetWithNW();
    const fsMod = nw.require('fs');
    const pathMod = nw.require('path');
    let finalPath = savePath;
    if (!/\.png$/i.test(finalPath)) finalPath += '.png';
    await fsMod.promises.mkdir(pathMod.dirname(finalPath), { recursive: true });
    await fsMod.promises.writeFile(finalPath, result.buffer);
    return { finalPath, ...result };
  }

  async function exportToDownloads() {
    const title = sanitizeFilename(readSettings().title);
    const dir = downloadsDir();
    const fsMod = nw.require('fs');
    const pathMod = nw.require('path');
    await fsMod.promises.mkdir(dir, { recursive: true });
    let filePath = pathMod.join(dir, `${title}.png`);
    let index = 2;
    while (fsMod.existsSync(filePath)) {
      filePath = pathMod.join(dir, `${title} (${index++}).png`);
    }
    return exportToPath(filePath);
  }

  async function exportWithSaveAs() {
    const title = sanitizeFilename(readSettings().title);
    const path = await windowsSaveAs(`${title}.png`);
    return exportToPath(path);
  }

  async function finishExport(result) {
    status.textContent = `Saved: ${result.finalPath} (${result.outputWidth}×${result.outputHeight})`;
    if (nw.Shell?.showItemInFolder) nw.Shell.showItemInFolder(result.finalPath);
  }

  $('exportPng').addEventListener('click', async () => {
    try {
      if (!isNW()) throw new Error('Please run this generator with NW.js.');
      const result = await exportToDownloads();
      await finishExport(result);
    } catch (error) {
      console.error(error);
      status.textContent = `Export failed: ${error?.message || error}`;
    }
  });

  $('saveAs').addEventListener('click', async () => {
    try {
      if (!isNW()) throw new Error('Please run this generator with NW.js.');
      const result = await exportWithSaveAs();
      await finishExport(result);
    } catch (error) {
      if (error?.message === 'SAVE_CANCELLED') {
        status.textContent = 'Save cancelled.';
      } else {
        console.error(error);
        status.textContent = `Save As failed: ${error?.message || error}`;
      }
    }
  });

  $('reset').addEventListener('click', () => location.reload());
  bindControls();
  bindImage();
  syncPreview();
})();
