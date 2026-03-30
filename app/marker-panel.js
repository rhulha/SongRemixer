export function createMarkerPanelController({ $, editor, sounds, colors }) {
  let currentSel = null;

  function isMoveAllEnabled() {
    return !!$('move-all').checked;
  }

  function buildCheckboxes(sel) {
    const checks = $('sound-checks');
    checks.innerHTML = '';
    for (const snd of sounds) {
      const lbl = document.createElement('label');
      lbl.className = 'sc';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = sel ? sel.sounds.has(snd) : false;
      cb.disabled = editor.selectedSet.size > 1;
      if (!sel) {
        cb.onchange = () => {
          if (!editor.loaded || editor.cursor === null) { cb.checked = false; return; }
          editor.addMarkerAtCursor();
          currentSel.sounds.add(snd);
          editor.redraw();
          buildCheckboxes(currentSel);
        };
      } else {
        cb.onchange = () => { sel.sounds[cb.checked ? 'add' : 'delete'](snd); editor.redraw(); };
      }
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.style.background = colors[snd];
      lbl.append(cb, dot, document.createTextNode(snd));
      checks.append(lbl);
    }
  }

  function refreshMarkerList() {
    const list = $('marker-list');
    list.innerHTML = '';
    for (const m of editor.markers) {
      const item = document.createElement('div');
      item.className = 'mli' + (editor.selectedSet.has(m) ? ' sel' : '');
      item.dataset.marker = true;
      const t = (m.sample / editor.sampleRate).toFixed(3);
      const snds = [...m.sounds].join(' ');
      item.textContent = `${t}s` + (snds ? `  ${snds}` : '');
      item.addEventListener('click', e => {
        if (e.ctrlKey || e.metaKey) {
          if (editor.selectedSet.has(m)) {
            editor.selectedSet.delete(m);
            if (editor.selected === m) currentSel = editor.selectedSet.size > 0 ? [...editor.selectedSet][0] : null;
          } else {
            editor.selectedSet.add(m);
            currentSel = m;
          }
        } else {
          editor.selectedSet.clear();
          editor.selectedSet.add(m);
          currentSel = m;
          editor.jumpToMarker(m);
        }
        if (editor.onSelect) editor.onSelect(currentSel);
        editor.redraw();
      });
      list.append(item);
    }
  }

  function applyMarkerSampleEdit() {
    if (!currentSel) return;
    const v = parseInt($('sample-edit').value);
    if (isNaN(v) || v < 0) { $('sample-edit').value = currentSel.sample; return; }
    const delta = v - currentSel.sample;
    currentSel.sample = v;

    if ($('move-all').checked) {
      const idx = editor.markers.indexOf(currentSel);
      for (let i = idx + 1; i < editor.markers.length; i++) {
        editor.markers[i].sample += delta;
      }
    }

    editor.markers.sort((a, b) => a.sample - b.sample);
    editor.redraw();
    refreshMarkerList();
    $('panel-time').textContent = `(${(v / editor.sampleRate).toFixed(3)}s)`;
  }

  function onSampleEditInput() {
    const v = parseInt($('sample-edit').value);
    if (!isNaN(v) && v >= 0) {
      $('panel-time').textContent = `(${(v / editor.sampleRate).toFixed(3)}s)`;
      if (currentSel) {
        const delta = v - currentSel.sample;
        currentSel.sample = v;
        if ($('move-all').checked) {
          const idx = editor.markers.indexOf(currentSel);
          for (let i = idx + 1; i < editor.markers.length; i++) {
            editor.markers[i].sample += delta;
          }
        }
        const list = $('marker-list');
        const items = list.querySelectorAll('.mli');
        for (let i = 0; i < items.length && i < editor.markers.length; i++) {
          const m = editor.markers[i];
          const t = (m.sample / editor.sampleRate).toFixed(3);
          const snds = [...m.sounds].join(' ');
          items[i].textContent = `${t}s` + (snds ? `  ${snds}` : '');
        }
      }
    }
  }

  function onSelect(sel) {
    currentSel = sel;
    $('btn-del').style.display = (sel || editor.selectedSet.size > 0) ? 'inline-block' : 'none';
    $('move-all-wrap').style.display = sel ? 'flex' : 'none';
    if (!sel) {
      $('panel-pos').style.display = '';
      $('panel-sample-wrap').style.display = 'none';
      if (editor.cursor !== null) {
        $('panel-pos').textContent = `cursor  sample ${editor.cursor}  (${(editor.cursor / editor.sampleRate).toFixed(3)}s)`;
      } else {
        $('panel-pos').textContent = editor.loaded ? 'click waveform to set cursor' : 'load a wav to begin';
      }
    } else {
      $('panel-pos').style.display = 'none';
      $('panel-sample-wrap').style.display = 'flex';
      $('sample-edit').value = sel.sample;
      $('panel-time').textContent = `(${(sel.sample / editor.sampleRate).toFixed(3)}s)`;
    }
    buildCheckboxes(sel);
    refreshMarkerList();
    if (sel) {
      const items = $('marker-list').querySelectorAll('.mli');
      const idx = editor.markers.indexOf(sel);
      if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function onMarkerMoved(marker) {
    if (currentSel === marker) {
      $('sample-edit').value = marker.sample;
      $('panel-time').textContent = `(${(marker.sample / editor.sampleRate).toFixed(3)}s)`;
    }
    refreshMarkerList();
  }

  return {
    buildCheckboxes,
    refreshMarkerList,
    applyMarkerSampleEdit,
    onSampleEditInput,
    onSelect,
    isMoveAllEnabled,
    onMarkerMoved
  };
}