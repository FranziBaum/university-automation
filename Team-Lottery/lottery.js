import {hex} from './helpers.js';
import Group from './model/Group.js';
import Item from './model/Item.js';
import {ANIMATION_DURATION, closeGap, moveCandidateToGroup, rejectionWiggle} from './animations.js';

const $ = document.querySelector.bind(document);
let autorun = false;
const candidates = [];
let candidatePointer = 0;
let stepSize = 1;
const groups = [];
let groupPointer = 0;

$('#groupNumber').addEventListener('change', groupChange);
$('#groupNumber').addEventListener('pointerup', groupChange);
$('#groupNumber').addEventListener('keyup', groupChange);
$('#names').addEventListener('change', candidateChange);
$('#names').addEventListener('keyup', candidateChange);
$('#d1').addEventListener('change', candidateChange);
$('#d2').addEventListener('change', (e) => {
	stepSize = parseInt(e.currentTarget.value, 10);
});
$('#run').addEventListener('click', () => {
	autorun = true;
	draw();
});
$('#step').addEventListener('click', () => {
	autorun = false;
	draw();
});
$('#pause').addEventListener('click', () => {
	autorun = false;
});
$('#showHashes').addEventListener('change', (e) => {
	document.body.classList.toggle('hashes', e.currentTarget.checked);
});
$('#showNames').addEventListener('change', (e) => {
	document.body.classList.toggle('names', e.currentTarget.checked);
});
groupChange();
candidateChange();

function groupChange() {
	const groupNumber = parseInt($('#groupNumber').value, 10);
	const playground = $('#playground');
	while (playground.children.length > 0) {
		playground.removeChild(playground.children[0]);
	}
	groups.splice(0,groups.length); // empty the array as well.

	for (let i = 0; i < groupNumber; i++) {
		const g = new Group(i);
		playground.appendChild(g.domElement);
		groups.push(g);
	}

	stepSize = parseInt($('#d2').value, 10);
	groupPointer = 0;
}

function candidateChange() {
	const names = $('#names').value
		.split('\n')
		.map((c) => c.trim())
		.filter((c) => c);

	const d1 = parseInt($('#d1').value, 10);
	const encoder = new TextEncoder('utf-8');
	candidates.splice(0, candidates.length);

	Promise.all(names.map((name) => {
		var buffer = encoder.encode(name + d1);
		return crypto.subtle.digest('SHA-256', buffer).then((hash) => [name, hash]);
	})).then((hashes) => {
		hashes.forEach((h) => {
			h[1] = hex(h[1]).substr(0,6);
		});
		hashes = hashes.sort((a, b) => {
			return a[1].localeCompare(b[1]);
		});
		const candidateList = $('#candidates');
		while (candidateList.children.length > 0) {
			candidateList.removeChild(candidateList.children[0]);
		}
		for (let i = 0; i < hashes.length; i++) {
			const item = new Item(i, hashes[i][0], hashes[i][1]);
			candidateList.appendChild(item.domElement);
			candidates.push(item);
		}
	});
	groupChange();
}

function updatePointerHighlight() {
	document.querySelectorAll('.candidate').forEach((c) => {
		c.classList.remove('active');
	});
	if (candidates.length === 0) {
		return;
	}

	if (candidatePointer >= candidates.length) {
		candidatePointer = candidatePointer % candidates.length;
	}
	candidates[candidatePointer].domElement.classList.add('active');
}

function draw() {
	if (candidates.length == 0) {
		updatePointerHighlight();
		return;
	}

	const g = groups[groupPointer];
	if (candidatePointer >= candidates.length) {
		candidatePointer = candidatePointer % candidates.length;
	}
	updatePointerHighlight();
	const active = candidates[candidatePointer];

	var reasons = rejectMemberReason(active, g);
	if (reasons.length > 0) {
		candidatePointer += stepSize;
		if ($('#animations').checked) {
			rejectionWiggle(active, reasons);
		}
	} else {
		const follower = active.domElement.nextSibling;
		const before = active.domElement.getBoundingClientRect();
		g.add(active);
		const after = active.domElement.getBoundingClientRect();
		moveCandidateToGroup(active, before, after);
		if (follower) {
			closeGap(follower, before.height);
		}

		candidates.splice(candidatePointer, 1);

		groupPointer = ++groupPointer % groups.length;
		candidatePointer += (stepSize - 1); // -1 because we just removed one person from the list anyway.
	}

	if (autorun) {
		setTimeout(draw, $('#animations').checked ? ANIMATION_DURATION + 50 : 5);
	}
}

function rejectMemberReason(candidate, group) {
	const reasons = [];
	// conflicts with another team member
	for (let m in group.members) {
		const existingMember = group.members[m];
		for (let t in candidate.tags) {
			const candidateTag = candidate.tags[t];
			if (existingMember.tags.includes(candidateTag)) {
				reasons.push(existingMember.domElement.querySelectorAll('span.tag')[t]);
			}
		}
	}

	// conflicts with gender diversity
	const genders = group.members.map((m) => m.gender);
	const sameGender = genders.reduce((n, value) => {
		return n + (value === candidate.gender);
	}, 0);
	if (sameGender / group.members.length > 0.5) {
		// more than two thirds already have the same gender, this is not a good idea.
		reasons.push(group.domElement.querySelector('h2'));
		reasons.push(...group.members.filter((m) => m.gender === candidate.gender).map((m) => m.domElement));
	}

	return reasons;
}
