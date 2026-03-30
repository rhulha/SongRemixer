export const SOUNDS = ['bass', 'hit', 'snare', 'hat'];
export const COLORS = { bass: '#e05555', hit: '#4fc3f7', snare: '#f0a030', hat: '#50c878' };
export const SOUND_FILES = { bass: 'data/bass.wav', hit: 'data/hit.wav', snare: 'data/snear.wav', hat: 'data/hat.wav' };

export const $ = id => document.getElementById(id);
export const ga = (el, n, cb) => $(el).addEventListener(n, cb);