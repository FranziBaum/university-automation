const path = require('path');

const csvreader = require('./lib/csvreader');
const BASE_OPTIONS = require('./config/server');

process.on("unhandledRejection", function(reason, promise) {
	console.error("undhandled promise rejection: ", reason, promise);
});

function collectLists(val, collection) {
	collection.push(val);
	return collection;
}

const program = require('commander');
program
	.version(require('./package.json').version)
	.option('-l, --list [filename.csv]', 'list of user names to be parsed', collectLists, [])
	.option('--rules [rules.js]', 'processing instructions for the files, receives parsed lists, must return promise that resolves to users')
	.option('--print-parsed', 'print parsed data', false)
	.option('--overwrite-passwords', 'reset passwords for existing users', false)
	.option('--create-users', 'create new users if neccessary', false)
	.option('--move-directories', 'groups directories in subdirs by prefix', false)
	.option('--send-mails', 'send welcome mails to users', false)
	.option('--trigger-password-reset', 'have nextcloud send out a reset password mail', false)
	.parse(process.argv);

const processingPromise = require(path.resolve(program.rules));

const listPromises = program.list.map((list) => {
	return csvreader(list);
});

let chain = Promise.all(listPromises).then((lists) => processingPromise(lists, BASE_OPTIONS));

if (program.printParsed) {
	chain = chain.then((users) => {
		console.log(users);
		return users;
	})
}

if (program.createUsers) {
	const creator = require('./lib/creator');
	chain = chain.then((users) => {
		creator.init(BASE_OPTIONS);
		creator.options.resetPassword = program.overwritePasswords;
		return creator.createAll(users).then(() => users);
	})
}

if (program.moveDirectories) {
	const mover = require('./lib/mover');
	chain = chain.then((users) => {
		return mover(users, BASE_OPTIONS).then(() => users);
	});
}

if (program.sendMails) {
	const mailer = require('./lib/mailer');
	chain = chain.then((users) => {
		mailer.init(BASE_OPTIONS);
		return mailer.sendToAll(users).then(() => users);
	})
}

if (program.triggerPasswordReset) {
	const passwordResetRequester = require('./lib/passwordResetRequester');
	chain = chain.then((users) => {
		passwordResetRequester.init(BASE_OPTIONS.hostname);
		return passwordResetRequester.requestForAll(users).then(() => users);
	})
}

chain.then();