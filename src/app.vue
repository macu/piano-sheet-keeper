<template>
<div class="app">

	<div class="menu">

		<select v-model="selectedSongId" @change="loadSong()">
			<option :value="null">Load song...</option>
			<option :value="true">New song...</option>
			<option v-for="o in songOptions" :key="o.id" :value="o.id">{{o.song.name}}</option>
		</select>

		<button v-if="menuExpanded" @click="closeMenu()">&#x25B2;</button>
		<button v-else @click="openMenu()">&#x25BC;</button>

	</div>

	<div v-if="menuExpanded && songFormData" class="expanded-menu">
		<label>
			<div>Song name</div>
			<input type="text" maxlength="50" v-model="songFormData.name"/>
		</label>
		<label>
			<div>First keyboard octave (lowest note)</div>
			<select v-model="songFormData.startOctave">
				<option v-for="i in 4" :key="i" :value="i">{{i}}</option>
			</select>
		</label>
		<label>
			<div>Last keyboard octave (highest note)</div>
			<select v-model="songFormData.endOctave">
				<template v-for="i in 7">
					<option
						v-if="i >= (songFormData.startOctave + (MIN_SONG_OCTAVES - 1))"
						:key="i" :value="i">{{i}}</option>
				</template>
			</select>
		</label>
		<label v-if="activeSong">
			<div>Song length</div>
			{{activeSongLength}} lines
		</label>
		<div class="actions">
			<button @click="saveActiveSongMetadata()" :disabled="disableSaveSongMetadata">
				<template v-if="activeSong">Save</template>
				<template v-else>Create</template>
			</button>
			<button @click="vacuumActiveSong()" :disabled="!activeSong">Vacuum</button>
			<button @click="deleteActiveSong()" :disabled="!activeSong">Delete song</button>
		</div>
	</div>

	<template v-else>

		<div v-if="activeSong" ref="track" class="notes-track" @click.stop="clearSelection()">
			<div
				v-for="(line, i) in activeSong.lines"
				:key="i"
				class="line"
				:class="{'selected': i === selectedLineIndex}"
				@click.stop="selectLine(i)">
				<div
					v-for="(octave, j) in line"
					:key="octave.octave"
					:data-octave="octave.octave"
					:data-first="(octave.octave === startOctave) || null">
					<div
						v-for="n in iterateOctave(octave)"
						:key="n.note"
						:data-note="n.note"
						:data-length="n.len"
						:class="{'selected': (
							i === selectedLineIndex &&
							j === selectedOctaveIndex &&
							n.note === selectedNote
						)}"
						@click.stop="selectNote(i, j, n.note)">
						<div v-if="(
							i === selectedLineIndex &&
							j === selectedOctaveIndex &&
							n.note === selectedNote
						)" class="actions">
							<button class="delete" @click="deleteSelectedNote()">X</button>
							<div class="resize">
								<button v-if="n.len < selectedNoteMaxLength" @click="increaseSelectedNote()">&#8613;</button>
								<button v-if="n.len > 1" @click="decreaseSelectedNote()">&#8615;</button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="actions">
				<button class="add-line" @click="addLine()">Add line</button>
			</div>
		</div>

		<div v-else class="intro">
			<p>Load a song or create a new song through the menu above</p>
		</div>

		<div class="key-track">

			<div v-for="i in octaves" :key="i" :data-octave="i" class="octave">

				<div data-key="C" class="regular" @click="addNote(i, 'C')"></div>
				<div data-key="C#" class="sharp" @click="addNote(i, 'C#')"></div>
				<div data-key="D" class="regular" @click="addNote(i, 'D')"></div>
				<div data-key="D#" class="sharp" @click="addNote(i, 'D#')"></div>
				<div data-key="E" class="regular" @click="addNote(i, 'E')"></div>

				<div data-key="F" class="regular" @click="addNote(i, 'F')"></div>
				<div data-key="F#" class="sharp" @click="addNote(i, 'F#')"></div>
				<div data-key="G" class="regular" @click="addNote(i, 'G')"></div>
				<div data-key="G#" class="sharp" @click="addNote(i, 'G#')"></div>
				<div data-key="A" class="regular" @click="addNote(i, 'A')"></div>
				<div data-key="A#" class="sharp" @click="addNote(i, 'A#')"></div>
				<div data-key="B" class="regular" @click="addNote(i, 'B')"></div>

			</div>

			<!-- Lone C at end -->
			<div class="regular"></div>

		</div>

	</template>

	<dynamic-stylesheet v-if="activeSong" :rules="activeSongStylesheet"/>
	<dynamic-stylesheet :rules="keyboardStylesheet"/>

</div>
</template>

<script>
import $ from 'jquery';
import DynamicStylesheet from '@macu/dynamic-stylesheet-vue/index.js';
import {currentDateStamp} from './utils.js';

const MAX_NOTE_LENGTH = 16;
const MIN_SONG_OCTAVES = 4;
const NOTE_EXTEND_DELAY = 1000;

function newSongId() {
	return Date.now();
}

function newSongName() {
	return 'New song (' + currentDateStamp() + ')';
}

export default {
	components: {
		DynamicStylesheet,
	},
	data() {
		return {
			songsIndex: {},
			selectedSongId: null,
			activeSong: null,

			// Editing
			menuExpanded: false,
			songFormData: null,

			// Selection
			selectedLineIndex: null,
			selectedOctaveIndex: null,
			selectedNote: null,

			// Adding notes
			lastNote: null,
			lastNoteTimeout: null,
		};
	},
	computed: {
		MIN_SONG_OCTAVES() {
			return MIN_SONG_OCTAVES;
		},
		songOptions() {
			let options = [];
			for (let id in this.songsIndex) {
				options.push({id, song: this.songsIndex[id]});
			}
			options.sort(function(a, b) {
				return a.song.name.localeCompare(b.song.name);
			});
			return options;
		},
		activeSongLength() {
			return this.activeSong ? this.activeSong.lines.length : 0;
		},
		startOctave() {
			return this.activeSong ? this.activeSong.startOctave : 2;
		},
		octaves() {
			return this.activeSong ? this.activeSong.octaves : 5;
		},
		noteIsSelected() {
			return this.activeSong &&
				this.selectedLineIndex !== null &&
				this.selectedOctaveIndex !== null &&
				this.selectNote !== null;
		},
		selectedOctave() {
			if (this.noteIsSelected) {
				return this.activeSong.lines[this.selectedLineIndex][this.selectedOctaveIndex].octave;
			}
			return null;
		},
		selectedNoteMaxLength() {
			if (this.noteIsSelected) {
				for (var i = 1; i <= MAX_NOTE_LENGTH; i++) {
					if (this.selectedLineIndex + i >= this.activeSong.lines.length) {
						break;
					}
					let line = this.activeSong.lines[this.selectedLineIndex + i];
					for (var j = 0; j < line.length; j++) {
						if (line[j].octave === this.selectedOctave && line[j][this.selectedNote]) {
							return i;
						}
					}
				}
				return MAX_NOTE_LENGTH;
			}
			return null;
		},
		activeKeySizes() {
			let keyCount = (this.octaves * 7) + 1; // Extra C at end
			let regularWidth = (100 / keyCount);
			let octaveWidth = regularWidth * 7;
			let sharpWidth = regularWidth / 2;
			let sharpOffset = -sharpWidth / 2;
			return {
				keyCount,
				regularWidth,
				octaveWidth,
				sharpWidth,
				sharpOffset,
			};
		},
		activeSongStylesheet() {
			if (!this.activeSong) {
				return null;
			}

			let sizes = this.activeKeySizes;

			let octaves = {};
			for (var i = 0; i < this.octaves; i++) {
				let octave = i + this.startOctave;
				let offset = sizes.octaveWidth * i;
				octaves['&[data-octave="'+octave+'"]'] = {
					width: sizes.octaveWidth + 'vw',
					left: offset + 'vw',
				};
			}

			return {
				'.notes-track': {
					'>.line': {
						'>[data-octave]': octaves,
						// dynamic widths
						'[data-note]:not([data-note$="#"])': { // regular notes
							'width': sizes.regularWidth + 'vw',
						},
						'[data-note$="#"]': { // sharp notes
							'width': sizes.sharpWidth + 'vw',
						},
						// dynamic positioning offsets
						'>[data-octave]>[data-note]:not([data-note$="#"])': { // regular notes
							'&[data-note="C"]': {'left': (sizes.regularWidth * 0) + 'vw'},
							'&[data-note="D"]': {'left': (sizes.regularWidth * 1) + 'vw'},
							'&[data-note="E"]': {'left': (sizes.regularWidth * 2) + 'vw'},
							'&[data-note="F"]': {'left': (sizes.regularWidth * 3) + 'vw'},
							'&[data-note="G"]': {'left': (sizes.regularWidth * 4) + 'vw'},
							'&[data-note="A"]': {'left': (sizes.regularWidth * 5) + 'vw'},
							'&[data-note="B"]': {'left': (sizes.regularWidth * 6) + 'vw'},
						},
						'>[data-octave]>[data-note$="#"]': { // sharp notes
							'&[data-note="C#"]': {'left': ((sizes.regularWidth * 1) + sizes.sharpOffset) + 'vw'},
							'&[data-note="D#"]': {'left': ((sizes.regularWidth * 2) + sizes.sharpOffset) + 'vw'},
							'&[data-note="F#"]': {'left': ((sizes.regularWidth * 4) + sizes.sharpOffset) + 'vw'},
							'&[data-note="G#"]': {'left': ((sizes.regularWidth * 5) + sizes.sharpOffset) + 'vw'},
							'&[data-note="A#"]': {'left': ((sizes.regularWidth * 6) + sizes.sharpOffset) + 'vw'},
						},
						'>[data-note]': { // C at end
							'left': (sizes.octaveWidth * this.octaves) + 'vw',
						},
					},
				},
			};
		},
		keyboardStylesheet() {
			let sizes = this.activeKeySizes;

			return {
				'.key-track': {
					'.regular': {
						'width': sizes.regularWidth + 'vw',
					},
					'.sharp::before': {
						'width': sizes.sharpWidth + 'vw',
						'left': sizes.sharpOffset + 'vw',
					},
				}
			};
		},
		disableSaveSongMetadata() {
			return this.activeSong && this.songFormData && (
				this.activeSong.name === this.songFormData.name &&
				this.activeSong.startOctave === this.songFormData.startOctave &&
				this.activeSong.octaves === (this.songFormData.startOctave + this.songFormData.endOctave - 1)
			);
		},
	},
	watch: {
		'songFormData.startOctave'(startOctave) {
			if (this.songFormData && (this.songFormData.endOctave - startOctave) < (MIN_SONG_OCTAVES - 1)) {
				this.songFormData.endOctave = startOctave + (MIN_SONG_OCTAVES - 1);
			}
		},
	},
	mounted() {
		this.loadSongs();
	},
	methods: {
		loadSongs() {
			let songsIndexJson = window.localStorage.getItem('songsIndex');
			this.songsIndex = songsIndexJson ? JSON.parse(songsIndexJson) : {};
		},
		loadSong() {
			if (this.selectedSongId === null) {
				// Back to intro page
				this.activeSong = null;
			} else if (this.selectedSongId === true) {
				let defaultName = newSongName();
				let name = window.prompt('Enter a name for the new song:', defaultName);
				if (name === null) {
					this.selectedSongId = null;
					return;
				}
				// New song
				this.activeSong = {
					id: newSongId(),
					name: name || defaultName,
					startOctave: 1,
					octaves: 7,
					lines: [
						[ // step
							{octave: 3, 'C': 2, 'C#': 1}, // octave
						],
						[ // step
							{octave: 5, 'C': 4, 'A#': 1}, // octave
						],
						[ // step
							{octave: 4, 'C': 4, 'A#': 1}, // octave
						],
					],
				};
				this.saveSong();
				// Add to index
				let index = this.songsIndex;
				index[this.activeSong.id] = {
					name: this.activeSong.name,
				};
				this.songsIndex = index;
				this.saveIndex();
				// Select in interface
				this.selectedSongId = this.activeSong.id;
			} else {
				// Load song by ID
				let songJson = window.localStorage.getItem('song:' + this.selectedSongId);
				this.activeSong = JSON.parse(songJson);
			}
			this.clearSelection();
		},
		saveIndex() {
			window.localStorage.setItem('songsIndex', JSON.stringify(this.songsIndex));
		},
		saveSong() {
			window.localStorage.setItem('song:' + this.activeSong.id, JSON.stringify(this.activeSong));
		},
		openMenu() {
			this.populateSongFormData();
			this.menuExpanded = true;
		},
		closeMenu() {
			this.menuExpanded = false;
			this.songFormData = null;
		},
		populateSongFormData() {
			if (this.activeSong) {
				this.songFormData = {
					name: this.activeSong.name,
					startOctave: this.activeSong.startOctave,
					endOctave: this.activeSong.startOctave + (this.activeSong.octaves - 1),
				};
			} else {
				this.songFormData = {
					name: newSongName(),
					startOctave: 1,
					endOctave: 7,
				};
			}
		},
		saveActiveSongMetadata() {
			let name = this.songFormData.name;
			let startOctave = this.songFormData.startOctave;
			let octaves = (this.songFormData.endOctave - this.songFormData.startOctave) + 1;
			if (this.activeSong) {
				// Update existing song
				this.activeSong.name = name;
				this.activeSong.startOctave = startOctave;
				this.activeSong.octaves = octaves;
			} else {
				// Create new song
				this.activeSong = {
					id: newSongId(),
					name,
					startOctave,
					octaves,
					lines: [],
				};
			}
			this.saveSong();
			// Update index
			let index = this.songsIndex;
			index[this.activeSong.id] = {
				name: this.activeSong.name,
			};
			this.songsIndex = index;
			this.saveIndex();
			// Select in interface
			this.selectedSongId = this.activeSong.id;
		},
		vacuumActiveSong() {
			if (!this.activeSong) {
				return;
			}
			// Remove empty octaves
			let removedOctaves = 0, removedNotes = 0;
			for (let i = 0; i < this.activeSong.lines.length; i++) {
				let line = this.activeSong.lines[i];
				for (let j = 0; j < line.length; j++) {
					let octave = line[j];
					let noteCount = 0;
					for (let k in octave) {
						if (k === 'octave') {
							continue;
						}
						if (octave[k] > 0) {
							noteCount++;
						} else {
							// Remove empty notes
							removedNotes++;
							delete(octave[k]);
						}
					}
					if (noteCount === 0) {
						removedOctaves++;
						line.splice(j, 1); // remove octave
						j--;
					}
				}
			}
			// Remove trailing lines
			// let lastNoteLineIndex = 0, lastNoteLength = 0;
			// for (let i = this.activeSong.lines.length - 1; i > 0; i--) {
			// 	let line = this.activeSong.lines[i];
			// 	if (line.length) {
			// 		break;
			// 	}
			// 	for (let j = 0; j < line.length; j++) {
			// 		let octave = line[j];
			// 		for (let k in octave) {
			// 			if (k === 'octave') {
			// 				continue;
			// 			}

			// 		}
			// 	}
			// }
			window.alert('Removed ' + removedNotes + ' notes, ' + removedOctaves + ' octaves, and 0 lines.');
			this.activeSong = this.activeSong; // reactive update
		},
		deleteActiveSong() {
			if (this.activeSong && window.confirm('Delete this song?')) {
				let index = this.songsIndex;
				delete(index[this.activeSong.id]);
				this.songsIndex = index;
				this.saveIndex();
				window.localStorage.removeItem('song:' + this.activeSong.id);
				this.activeSong = null;
				this.selectedSongId = null;
			}
		},
		selectLine(index) {
			console.log('selectLine', index);
			this.selectedLineIndex = index;
			this.selectedOctaveIndex = null;
			this.selectedNote = null;
			this.lastNote = null;
		},
		selectNote(lineIndex, octaveIndex, note) {
			console.log('selectNote', lineIndex, octaveIndex, note);
			this.selectedLineIndex = lineIndex;
			this.selectedOctaveIndex = octaveIndex;
			this.selectedNote = note;
			this.lastNote = null;
		},
		clearSelection() {
			this.selectedLineIndex = null;
			this.selectedOctaveIndex = null;
			this.selectedNote = null;
			this.lastNote = null;
		},
		addLine() {
			this.activeSong.lines.push([]);
			this.selectLine(this.activeSong.lines.length - 1);
			this.saveSong();
		},
		addNote(octaveIndex, note) {
			if (this.activeSong === null || this.selectedLineIndex === null) {
				return;
			}
			let octave = this.startOctave + (octaveIndex - 1);
			for (var i = 1; i < MAX_NOTE_LENGTH && (this.selectedLineIndex - i) >= 0; i++) {
				let line = this.activeSong.lines[this.selectedLineIndex - i];
				for (var j = 0; j < line.length; j++) {
					if (line[j].octave === octave && line[j][note] > i) {
						// Note already present on this line
						return;
					}
				}
			}
			const setLastNote = () => {
				// Extend if click again within timeout
				this.lastNote = note;
				if (this.lastNoteTimeout) {
					clearTimeout(this.lastNoteTimeout);
				}
				this.lastNoteTimeout = setTimeout(() => {
					this.lastNote = null;
				}, NOTE_EXTEND_DELAY);
			}
			let extend = this.lastNote === note;
			let line = this.activeSong.lines[this.selectedLineIndex];
			for (var i = 0; i < line.length; i++) {
				if (line[i].octave === octave) {
					// Octave found
					if (extend && line[i][note] && line[i][note] < MAX_NOTE_LENGTH) {
						// Increment length
						line[i][note] += 1;
						if (line[i][note] + this.selectedLineIndex > this.activeSongLength) {
							// Add line to accomodate note length
							this.activeSong.lines.push([]);
						}
					} else {
						// Set length to 1
						line[i][note] = 1;
					}
					this.activeSong.lines.splice(this.selectedLineIndex, 1, line); // trigger reactive update
					this.saveSong();
					this.selectNote(this.selectedLineIndex, i, note);
					this.ensureFocusSelectedNote();
					setLastNote();
					return;
				}
			}
			// Add octave
			line.push({octave, [note]: 1});
			this.saveSong();
			this.selectNote(this.selectedLineIndex, line.length - 1, note);
			this.ensureFocusSelectedNote();
			setLastNote();
		},
		ensureFocusSelectedNote() {
			// Focus note
			// const ADJUST = 30;
			// this.$nextTick(() => {
			// 	if (this.noteIsSelected) {
			// 		let $track = $(this.$refs.track);
			// 		let $n = $track.find('line.selected>[data-octave="'+this.selectedOctave+'"]>[data-note="'+this.selectedNote+'"]');
			// 		if (($n.offset().top - ADJUST) < $track.offset().top) {
			// 			$track.scrollTop(($track.scrollTop() - ($track.offset().top - $n.offset().top)) - ADJUST);
			// 		}
			// 	}
			// });
		},
		increaseSelectedNote() {
			if (this.noteIsSelected) {
				let line = this.activeSong.lines[this.selectedLineIndex];
				line[this.selectedOctaveIndex][this.selectedNote]++;
				// Increase song length if required
				if (
					line[this.selectedOctaveIndex][this.selectedNote] +
					this.selectedLineIndex > this.activeSongLength
				) {
					// Add line to accomodate note length
					this.activeSong.lines.push([]);
				}
				this.saveSong();
			}
		},
		decreaseSelectedNote() {
			if (this.noteIsSelected) {
				let line = this.activeSong.lines[this.selectedLineIndex];
				let octave = line[this.selectedOctaveIndex];
				if (octave[this.selectedNote] > 0) {
					octave[this.selectedNote]--;
				}
				this.saveSong();
			}
		},
		deleteSelectedNote() {
			if (this.noteIsSelected) {
				let line = this.activeSong.lines[this.selectedLineIndex];
				delete(line[this.selectedOctaveIndex][this.selectedNote]);
				this.activeSong.lines.splice(this.selectedLineIndex, 1, line); // reactive update
				this.saveSong();
				this.selectedLine = null;
				this.selectedOctaveIndex = null;
			}
		},
		iterateOctave(octave) {
			// used in template
			let notes = [];
			for (let note in octave) {
				if (note === 'octave') {
					continue;
				}
				const len = octave[note];
				if (len) {
					notes.push({note, len});
				}
			}
			return notes;
		},
	},
};
</script>

<style lang="scss">
@use 'sass:math';

$row-height: 10vh;

.app {
	width: 100%;
	height: 100%;

	display: flex;
	flex-direction: column;

	.menu {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;

		background-color: grey;
		padding: 5px;

		>select {
			flex: 1;
		}
		>*+* {
			margin-left: 5px;
		}
	}

	.expanded-menu {
		flex: 1;
		overflow-y: auto;
		padding: 2em;

		>label {
			display: block;
			margin-bottom: 1em;
			>div {
				font-weight: bold;
			}
			>input {
				width: 400px;
				max-width: 100%;
			}
			>select {
				width: 200px;
			}
		}

		>.actions {
			>button {
				margin-right: 10px;
				margin-bottom: 10px;
			}
		}
	}

	.notes-track {
		position: relative;

		flex: 1;
		overflow-y: auto;

		display: flex;
		flex-direction: column-reverse; // bottom-up placement

		>.line {
			min-height: $row-height; // min-height instead of height enables overflow-y
			border-top: thin dotted red;
			position: relative;

			&.selected {
				background-color: lighten(yellow, 30%);
			}

			>[data-octave] {
				position: absolute;
				height: $row-height;
				// The rest of the styles come from dynamic-stylesheet
			}

			// Note may be in octave or standalone C at end
			[data-note] {
				position: absolute;
				bottom: 0;

				// General note sizing
				&[data-length="1"] { height: $row-height * 1; }
				&[data-length="2"] { height: $row-height * 2; }
				&[data-length="3"] { height: $row-height * 3; }
				&[data-length="4"] { height: $row-height * 4; }
				&[data-length="5"] { height: $row-height * 5; }
				&[data-length="6"] { height: $row-height * 6; }
				&[data-length="7"] { height: $row-height * 7; }
				&[data-length="8"] { height: $row-height * 8; }
				&[data-length="9"] { height: $row-height * 9; }
				&[data-length="10"] { height: $row-height * 10; }
				&[data-length="11"] { height: $row-height * 11; }
				&[data-length="12"] { height: $row-height * 12; }
				&[data-length="13"] { height: $row-height * 13; }
				&[data-length="14"] { height: $row-height * 14; }
				&[data-length="15"] { height: $row-height * 15; }
				&[data-length="16"] { height: $row-height * 16; }

				&.selected {
					z-index: 5 !important;
				}

				>.actions {
					width: 100%;
					position: relative;
					button {
						font-size: 20px;
						line-height: 30px;
						padding: 0 10px;
						z-index: 10;
					}
					>button.delete {
						position: absolute;
						top: -45px;
						right: 0;
					}
					>div.resize {
						position: absolute;
						top: 0;
						left: -45px;
						>button {
							display: block;
							margin-bottom: 5px;
						}
					}
				}
			}

			>[data-octave][data-first]>[data-note] {
				>.actions {
					// different actions positioning for first octave
					>button.delete {
						right: unset;
						left: 0;
					}
					>div.resize {
						left: unset;
						right: -45px;
					}
				}
			}

			[data-note]:not([data-note$="#"]) {
				// Regular notes
				background-color: orange;
				border: medium solid white;
				border-radius: 8px;
				z-index: 2;
				&.selected {
					animation-name: regular-key-selected;
					animation-duration: 1s;
					animation-iteration-count: infinite;
				}
				// The rest of the styles come from dynamic-stylesheet
			}

			[data-note$="#"] {
				// Sharp notes
				background-color: purple;
				border: medium solid white;
				border-radius: 8px;
				z-index: 3;
				&.selected {
					animation-name: sharp-key-selected;
					animation-duration: 1s;
					animation-iteration-count: infinite;
				}
				// The rest of the styles come from dynamic-stylesheet
			}
		}
		>.actions {
			min-height: $row-height;
			text-align: right;
			>button {
				font-size: large;
				position: relative;
				top: 5px;
				margin-left: 20px;
			}
		}
	}

	.intro {
		flex: 1;
		overflow-y: auto;
		padding: 2em;
	}

	.key-track {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;

		.octave {
			flex: 1;
			height: 20vh;

			display: flex;
			flex-direction: row;
			flex-wrap: nowrap;
		}

		.regular {
			height: 20vh;
			background-color: white;
			border: medium solid black;
			border-radius: 4px;
			// Remaining styles come from dynamic-stylesheet
		}
		.sharp {
			position: relative;
			&::before {
				position: absolute;
				content: "";
				display: block;
				height: 15vh;
				background-color: black;
				border-radius: 4px;
				// Remaining styles come from dynamic-stylesheet
			}
		}
	}
}

@keyframes regular-key-selected {
	0% {
		background-color: orange;
	}
	50% {
		background-color: lighten(orange, 30%);
	}
	100% {
		background-color: orange;
	}
}

@keyframes sharp-key-selected {
	0% {
		background-color: purple;
	}
	50% {
		background-color: lighten(purple, 30%);
	}
	100% {
		background-color: purple;
	}
}
</style>
