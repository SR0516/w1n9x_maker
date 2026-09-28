(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const target = $('target');
  const titleBar = $('previewTitleBar');
  const windowBody = $('windowBody');
  const previewImage = $('previewImage');
  const previewVideo = $('previewVideo');
  const status = $('exportStatus');

  let mediaUrl = '';
  let mediaKind = 'image';
  let mediaMime = '';
  let mediaFileName = '';
  let syncLock = false;

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
    'showImage','imageWidth','exportScale','exportBackground','includeMargin','animationDuration','animationFps'
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
      showImage: $('showImage').checked && Boolean(mediaUrl),
      imageWidth: clamp($('imageWidth').value, 80, 2000, 640),
      exportScale: clamp($('exportScale').value, 1, 4, 2),
      exportBackground: $('exportBackground').value,
      includeMargin: $('includeMargin').checked,
      animationDuration: clamp($('animationDuration').value, 0.5, 10, 3),
      animationFps: clamp($('animationFps').value, 6, 20, 12)
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
    const barStart = s.inactive ? s.inactiveStart : s.activeStart;
    const barEnd = s.inactive ? s.inactiveEnd : s.activeEnd;
    titleBar.style.backgroundImage = `linear-gradient(90deg, ${barStart}, ${barEnd})`;
    $('previewTitle').style.color = s.inactive ? s.inactiveText : s.activeText;

    const min = $('previewMin');
    const max = $('previewMax');
    const close = $('previewClose');
    hide(min, !s.showMin); hide(max, !s.showMax); hide(close, !s.showClose);
    min.disabled = Boolean(s.disableMin); max.disabled = Boolean(s.disableMax); close.disabled = Boolean(s.disableClose);

    hide($('progressSection'), !s.showProgress);$('progressTextPreview').textContent = s.progressLabel;
    hide($('progressValueTextPreview'), !s.showProgressValue);$('progressValueTextPreview').textContent = `${Math.round(s.progressValue)}%`;
    $('progressPreview').classList.toggle('segmented', s.progressStyle === 'segmented');
    $('progressPreview').classList.toggle('disabled-look', s.disableProgress);$('progressPreview').style.width = `${s.progressWidth}px`;
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

    hide($('inputSection'), !s.showInput);$('previewInputLabel').textContent = s.inputLabel;
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
    cancel.classList.toggle('default', false);
    ok.textContent = s.okText;
    cancel.textContent = s.cancelText;

    hide($('statusSection'), !s.showStatus);$('statusOnePreview').textContent = s.statusOne;
    $('statusTwoPreview').textContent = s.statusTwo;
    $('statusThreePreview').textContent = s.statusThree;

    hide(previewImage, !s.showImage || mediaKind === 'video');
    hide(previewVideo, !s.showImage || mediaKind !== 'video');
    if (s.showImage) {
      if (mediaKind === 'video') {
        previewVideo.style.width = `${s.imageWidth}px`;
        if (previewVideo.dataset.mediaUrl !== mediaUrl) {
          previewVideo.src = mediaUrl;
          previewVideo.dataset.mediaUrl = mediaUrl;
        }
        previewVideo.muted = true;
        previewVideo.loop = true;
        previewVideo.autoplay = true;
        previewVideo.playsInline = true;
        previewVideo.play().catch(() => {});
      } else {
        previewImage.style.width = `${s.imageWidth}px`;
        if (previewImage.dataset.mediaUrl !== mediaUrl) {
          previewImage.src = mediaUrl;
          previewImage.dataset.mediaUrl = mediaUrl;
        }
      }
    } else {
      previewVideo.pause();
    }

    const rect = target.getBoundingClientRect();
    $('sizeLabel').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    $('exportGif').disabled = false;
    $('saveGifAs').disabled = false;
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
      $('checkboxChecked').checked =$('previewCheckbox').checked;
      syncPreview();
    });

    $('previewRadioOne').addEventListener('change', () => {
      if ($('previewRadioOne').checked)$('radioOneChecked').checked = true;
      syncPreview();
    });
    $('previewRadioTwo').addEventListener('change', () => {
      if ($('previewRadioTwo').checked)$('radioOneChecked').checked = false;
      syncPreview();
    });

    $('previewOk').addEventListener('click', () => { status.textContent = 'Preview: OK clicked'; });$('previewCancel').addEventListener('click', () => { status.textContent = 'Preview: Cancel clicked'; });
  }

  function bindImage() {
    $('imageFile').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (mediaUrl && mediaUrl.startsWith('blob:')) URL.revokeObjectURL(mediaUrl);
      mediaUrl = '';
      mediaMime = '';
      mediaFileName = '';
      mediaKind = 'image';
      previewVideo.removeAttribute('src');
      previewVideo.load();
      previewImage.removeAttribute('src');

      if (!file) {
        $('showImage').checked = false;
        syncPreview();
        return;
      }

      mediaUrl = URL.createObjectURL(file);
      mediaMime = file.type || '';
      mediaFileName = file.name || '';
      mediaKind = mediaMime.startsWith('video/') ? 'video' : 'image';
      $('showImage').checked = true;
      syncPreview();
    });
  }

  function isNW() {
    return typeof nw !== 'undefined' && typeof nw.Window?.get === 'function';
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
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

  function captureScreenshotBase64(win, clip, scale) {
    return new Promise((resolve, reject) => {
      win.captureScreenshot({
        fullSize: true,
        format: 'png',
        clip: { ...clip, scale }
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
  }

  function base64ToBlob(base64, mime = 'image/png') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return new Blob([out], { type: mime });
  }

  async function screenshotToRGBA(base64, width, height, canvas, ctx, bgColor) {
    const bitmap = await createImageBitmap(base64ToBlob(base64));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    bitmap.close?.();
    return new Uint8ClampedArray(imageData.data);
  }

  async function prepareExportScene() {
    const s = readSettings();
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
      bodyClass: body.className,
      videoPaused: previewVideo.paused,
      videoTime: Number.isFinite(previewVideo.currentTime) ? previewVideo.currentTime : 0
    };

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
    if (s.showImage) {
      if (mediaKind === 'video') {
        try {
          previewVideo.currentTime = 0;
          await previewVideo.play();
        } catch (_) {}
      } else if (previewImage.decode) {
        try { await previewImage.decode(); } catch (_) {}
        if (mediaMime === 'image/gif') {
          previewImage.removeAttribute('src');
          await waitMs(10);
          previewImage.src = mediaUrl;
          await waitMs(80);
        }
      }
    }
    await nextFrame();

    const rect = target.getBoundingClientRect();
    const clip = {
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height)
    };
    if (clip.width <= 0 || clip.height <= 0) throw new Error('Export target has no size');

    const restore = async () => {
      root.style.overflow = original.htmlOverflow;
      body.style.overflow = original.bodyOverflow;
      body.style.background = original.bodyBackground;
      body.style.margin = original.bodyMargin;
      body.style.padding = original.bodyPadding;
      body.className = original.bodyClass;
      if (main) main.setAttribute('style', original.mainStyle);
      if (settings) settings.setAttribute('style', original.settingsStyle);
      if (previewPanel) previewPanel.setAttribute('style', original.previewStyle);
      if (toolbar) toolbar.setAttribute('style', original.toolbarStyle);
      if (stage) stage.setAttribute('style', original.stageStyle);
      if (capture) capture.setAttribute('style', original.captureStyle);
      target.setAttribute('style', original.targetStyle);
      target.className = original.targetClass;
      if (mediaKind === 'video') {
        try {
          previewVideo.currentTime = original.videoTime;
          if (!original.videoPaused) await previewVideo.play();
          else previewVideo.pause();
        } catch (_) {}
      }
      await nextFrame();
      syncPreview();
    };

    return { s, clip, restore };
  }

  async function captureTargetWithNW() {
    const win = nw.Window.get();
    const prepared = await prepareExportScene();
    try {
      const base64 = await captureScreenshotBase64(win, prepared.clip, prepared.s.exportScale);
      const pngBuffer = Buffer.from(base64, 'base64');
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (pngBuffer.length < 8 || !pngBuffer.subarray(0, 8).equals(signature)) {
        throw new Error('captureScreenshot did not return a valid PNG');
      }
      return {
        buffer: pngBuffer,
        outputWidth: Math.ceil(prepared.clip.width * prepared.s.exportScale),
        outputHeight: Math.ceil(prepared.clip.height * prepared.s.exportScale)
      };
    } finally {
      await prepared.restore();
    }
  }

  async function captureAnimatedGif() {
    if (!window.Win9xGif?.encodeGif) throw new Error('GIF encoder failed to load.');
    const s = readSettings();

    const win = nw.Window.get();
    const prepared = await prepareExportScene();
    let fps = Math.max(6, Math.min(20, Math.round(s.animationFps)));
    const durationMs = Math.round(s.animationDuration * 1000);
    fps = Math.min(fps, 80 / (durationMs / 1000));
    fps = Math.max(1, fps);
    const frameCount = Math.max(2, Math.min(80, Math.ceil(durationMs / 1000 * fps)));
    let scale = Math.min(2, s.exportScale);
    if (prepared.clip.width * prepared.clip.height * scale * scale > 1500000) scale = 1;
    const outWidth = Math.max(1, Math.round(prepared.clip.width * scale));
    const outHeight = Math.max(1, Math.round(prepared.clip.height * scale));
    const delays = new Array(frameCount).fill(1000 / fps);
    const frames = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const started = performance.now();

    try {
      if (s.showImage && mediaUrl) {
        if (mediaKind === 'video') {
          try {
            previewVideo.currentTime = 0;
            await previewVideo.play();
          } catch (_) {}
        } else if (mediaMime === 'image/gif') {
          previewImage.removeAttribute('src');
          await waitMs(20);
          previewImage.src = mediaUrl;
          await waitMs(80);
        }
      }

      for (let i = 0; i < frameCount; i++) {
        const deadline = started + (i * 1000 / fps);
        const wait = deadline - performance.now();
        if (wait > 0) await waitMs(wait);

        await nextFrame();
        const base64 = await captureScreenshotBase64(win, prepared.clip, scale);
        const rgba = await screenshotToRGBA(base64, outWidth, outHeight, canvas, ctx, s.exportBackground);
        frames.push(rgba);
        status.textContent = `Rendering GIF… frame ${i + 1}/${frameCount} (${outWidth}×${outHeight}, ${fps.toFixed(1)} fps)`;
      }

      status.textContent = 'Encoding GIF…';
      await nextFrame();
      const bytes = window.Win9xGif.encodeGif(frames, outWidth, outHeight, delays, { repeat: 0 });
      return { buffer: Buffer.from(bytes), outputWidth: outWidth, outputHeight: outHeight, frames: frameCount };
    } finally {
      await prepared.restore();
    }
  }

  function windowsSaveAs(defaultName, kind = 'png') {
    return new Promise((resolve, reject) => {
      const cp = nw.require('child_process');
      const isGif = kind === 'gif';
      const filter = isGif ? 'GIF image (*.gif)|*.gif|All files (*.*)|*.*' : 'PNG image (*.png)|*.png|All files (*.*)|*.*';
      const ext = isGif ? 'gif' : 'png';
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$d = New-Object System.Windows.Forms.SaveFileDialog',
        `$d.FileName = '${defaultName.replace(/'/g, "''")}'`,
        `$d.Filter = '${filter}'`,
        `$d.DefaultExt = '${ext}'`,
        '$d.AddExtension =$true',
        '$d.OverwritePrompt =$true',
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

  async function writeResultToPath(savePath, buffer, ext) {
    const fsMod = nw.require('fs');
    const pathMod = nw.require('path');
    let finalPath = savePath;
    const suffix = `.${ext}`;
    if (!new RegExp(`\\.${ext}$`, 'i').test(finalPath)) finalPath += suffix;
    await fsMod.promises.mkdir(pathMod.dirname(finalPath), { recursive: true });
    await fsMod.promises.writeFile(finalPath, buffer);
    return finalPath;
  }

  async function exportPngToDownloads() {
    const result = await captureTargetWithNW();
    const title = sanitizeFilename(readSettings().title);
    const dir = downloadsDir();
    const fsMod = nw.require('fs');
    const pathMod = nw.require('path');
    await fsMod.promises.mkdir(dir, { recursive: true });
    let filePath = pathMod.join(dir, `${title}.png`);
    let index = 2;
    while (fsMod.existsSync(filePath)) filePath = pathMod.join(dir, `${title} (${index++}).png`);
    const finalPath = await writeResultToPath(filePath, result.buffer, 'png');
    return { ...result, finalPath };
  }

  async function exportGifToDownloads() {
    const result = await captureAnimatedGif();
    const title = sanitizeFilename(readSettings().title);
    const dir = downloadsDir();
    const fsMod = nw.require('fs');
    const pathMod = nw.require('path');
    await fsMod.promises.mkdir(dir, { recursive: true });
    let filePath = pathMod.join(dir, `${title}.gif`);
    let index = 2;
    while (fsMod.existsSync(filePath)) filePath = pathMod.join(dir, `${title} (${index++}).gif`);
    const finalPath = await writeResultToPath(filePath, result.buffer, 'gif');
    return { ...result, finalPath };
  }

  async function finishExport(result, kind = 'PNG') {
    if (kind === 'GIF') {
      status.textContent = `Saved GIF: ${result.finalPath} (${result.outputWidth}×${result.outputHeight}, ${result.frames} frames)`;
    } else {
      status.textContent = `Saved: ${result.finalPath} (${result.outputWidth}×${result.outputHeight})`;
    }
    if (nw.Shell?.showItemInFolder) nw.Shell.showItemInFolder(result.finalPath);
  }

  $('exportPng').addEventListener('click', async () => {
    try {
      if (!isNW()) throw new Error('Please run this generator with NW.js.');
      $('exportPng').disabled = true;
      const result = await exportPngToDownloads();
      await finishExport(result, 'PNG');
    } catch (error) {
      console.error(error);
      status.textContent = `Export failed: ${error?.message || error}`;
    } finally {
      syncPreview();
    }
  });

  $('saveAs').addEventListener('click', async () => {
    try {
      if (!isNW()) throw new Error('Please run this generator with NW.js.');
      $('saveAs').disabled = true;
      const result = await captureTargetWithNW();
      const title = sanitizeFilename(readSettings().title);
      const savePath = await windowsSaveAs(`${title}.png`, 'png');
      const finalPath = await writeResultToPath(savePath, result.buffer, 'png');
      await finishExport({ ...result, finalPath }, 'PNG');
    } catch (error) {
      if (error?.message === 'SAVE_CANCELLED') status.textContent = 'Save cancelled.';
      else {
        console.error(error);
        status.textContent = `Save As failed: ${error?.message || error}`;
      }
    } finally {
      syncPreview();
    }
  });

  $('exportGif').addEventListener('click', async () => {
    try {
      if (!isNW()) throw new Error('Please run this generator with NW.js.');
      $('exportGif').disabled = true;
      $('saveGifAs').disabled = true;
      const result = await exportGifToDownloads();
      await finishExport(result, 'GIF');
    } catch (error) {
      console.error(error);
      status.textContent = `GIF export failed: ${error?.message || error}`;
    } finally {
      syncPreview();
    }
  });

  $('saveGifAs').addEventListener('click', async () => {
    try {
      if (!isNW()) throw new Error('Please run this generator with NW.js.');
      $('exportGif').disabled = true;
      $('saveGifAs').disabled = true;
      const result = await captureAnimatedGif();
      const title = sanitizeFilename(readSettings().title);
      const savePath = await windowsSaveAs(`${title}.gif`, 'gif');
      const finalPath = await writeResultToPath(savePath, result.buffer, 'gif');
      await finishExport({ ...result, finalPath }, 'GIF');
    } catch (error) {
      if (error?.message === 'SAVE_CANCELLED') status.textContent = 'Save cancelled.';
      else {
        console.error(error);
        status.textContent = `GIF Save As failed: ${error?.message || error}`;
      }
    } finally {
      syncPreview();
    }
  });

  $('reset').addEventListener('click', () => location.reload());
  bindControls();
  bindImage();
  syncPreview();
})();
