export function createMarkerStorageController({ $, editor }) {
  let markerFileHandle = null;

  function markerDataJson() {
    return JSON.stringify(editor.markers.map(m => ({ sample: m.sample, sounds: [...m.sounds] })), null, 2);
  }

  async function saveMarkersOverwrite() {
    if (markerFileHandle) {
      try {
        const writable = await markerFileHandle.createWritable();
        await writable.write(markerDataJson());
        await writable.close();
        return;
      } catch (_) {
        markerFileHandle = null;
      }
    }
    editor.saveMarkers('sandman_markers.json');
  }

  async function loadWithPicker() {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    const file = await handle.getFile();
    await editor.loadMarkers(file);
    markerFileHandle = handle;
  }

  async function onLoadClick() {
    if (!window.showOpenFilePicker) {
      $('in-json').click();
      return;
    }
    try {
      await loadWithPicker();
    } catch (e) {
      if (e?.name !== 'AbortError') throw e;
    }
  }

  async function onInputJsonChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    await editor.loadMarkers(file);
    markerFileHandle = null;
    e.target.value = '';
  }

  return { saveMarkersOverwrite, onLoadClick, onInputJsonChange };
}