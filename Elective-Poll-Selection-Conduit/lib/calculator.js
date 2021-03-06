const { Choice } = require('./Choice.js');

const COUNT_FACTOR = {
	'yes': 1,
	'maybe': 0.5,
	'undefined': 0,
	'no': 0
};

module.exports = {
	countOptionPopularity: function (voters) {
		for (const voter of voters) {
			for (const choice of voter.choices) {
				choice.option.popularity = 0;
			}
		}

		for (const voter of voters) {
			for (const choice of voter.choices) {
				choice.option.popularity += COUNT_FACTOR[choice.preference];
			}
		}
	},

	prepareChoicesByPriority: function (voters) {
		for (const voter of voters) {
			voter.choicesByPriority = voter.choices.slice(0); // clones the array
			voter.choicesByPriority.sort(Choice.compare);
		}
	}
};
