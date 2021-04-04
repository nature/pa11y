#!/usr/bin/env node
'use strict';

const buildReporter = require('../lib/reporter');
const extend = require('node.extend');
const envinfo = require('envinfo');
const path = require('path');
const pkg = require('../package.json');
const program = require('commander');
const pa11y = require('../lib/pa11y');
const semver = require('semver');

configureProgram();
if (program.environment) {
	outputEnvironmentInfo();
} else {
	runProgram();
}

/**
 * Parse the flags and arguments passed to the CLI
 * @returns {void}
 */
function configureProgram() {
	program.version(pkg.version)
		.usage('[options] <url>')
		.option(
			'-n, --environment',
			'output details about the environment Pa11y will run in'
		)
		.option(
			'-s, --standard <name>',
			'the accessibility standard to use: Section508, WCAG2A, WCAG2AA (default), ' +
			'WCAG2AAA – only used by htmlcs runner'
		)
		.option(
			'-r, --reporter <reporter>',
			'the reporter to use: cli (default), csv, json'
		)
		.option(
			'-e, --runner <runner>',
			'the test runners to use: htmlcs (default), axe',
			collectOptions,
			[]
		)
		.option(
			'-l, --level <level>',
			'the level of issue to fail on (exit with code 2): error, warning, notice'
		)
		.option(
			'-T, --threshold <number>',
			'permit this number of errors, warnings, or notices, otherwise fail with exit code 2'
		)
		.option(
			'-i, --ignore <ignore>',
			'types and codes of issues to ignore, a repeatable value or separated by semi-colons',
			collectOptions,
			[]
		)
		.option(
			'--include-notices',
			'Include notices in the report'
		)
		.option(
			'--include-warnings',
			'Include warnings in the report'
		)
		.option(
			'-R, --root-element <selector>',
			'a CSS selector used to limit which part of a page is tested'
		)
		.option(
			'-E, --hide-elements <hide>',
			'a CSS selector to hide elements from testing, selectors can be comma separated'
		)
		.option(
			'-c, --config <path>',
			'a JSON or JavaScript config file',
			'./pa11y.json'
		)
		.option(
			'-t, --timeout <ms>',
			'the timeout in milliseconds',
			Number
		)
		.option(
			'-w, --wait <ms>',
			'the time to wait before running tests in milliseconds'
		)
		.option(
			'-d, --debug',
			'output debug messages'
		)
		.option(
			'-S, --screen-capture <path>',
			'a path to save a screen capture of the page to'
		)
		.option(
			'-A, --add-rule <rule>',
			'WCAG 2.0 rules to include, a repeatable value or separated by semi-colons ' +
			'– only used by htmlcs runner',
			collectOptions,
			[]
		)
		.parse(process.argv);
	program.url = program.args[0];
}

/**
 * Handle help
 * @returns {void}
 */
function handleHelp() {
	if (!program.url || program.args[1]) {
		program.help();
	}
}

/**
 * Test the page and generate the results
 * @returns {void}
 */
async function runProgram() {
	handleHelp();
	const options = processOptions();
	const report = loadReporter(options.reporter);
	options.log = report.log;
	if (!program.debug) {
		options.log.debug = () => { /* NoOp */ };
	}
	await report.begin(program.url);
	try {
		const results = await pa11y(program.url, options);
		if (reportShouldFail(options.level, results.issues, options.threshold)) {
			process.once('exit', () => {
				process.exit(2);
			});
		}
		await report.results(results);
	} catch (error) {
		await options.log.error(error.stack);
		process.exit(1);
	}
}

/**
 * Process options based on precedence rules.
 * CLI options take precedence over config options (which take precedence over defaults)
 * @returns {Object} An object containing all the options that have been specified
 */
function processOptions() {
	// The 'level', 'reporter', and 'threshold' defaults are given here
	//  as they are not relevant when using lib/pa11y via JavaScript
	const options = extend({
		level: 'error',
		reporter: 'cli',
		threshold: 0
	}, loadConfig(program.config), {
		hideElements: program.hideElements,
		ignore: (program.ignore.length ? program.ignore : undefined),
		includeNotices: program.includeNotices,
		includeWarnings: program.includeWarnings,
		level: program.level,
		reporter: program.reporter,
		runners: (program.runner.length ? program.runner : undefined),
		rootElement: program.rootElement,
		rules: (program.addRule.length ? program.addRule : undefined),
		screenCapture: program.screenCapture,
		standard: program.standard,
		threshold: program.threshold,
		timeout: program.timeout,
		wait: program.wait
	});
	return options;
}

/**
 * Tries to loads a JSON config file from disk from a list of potential locations
 * @param {String} filePath - Path for the config file passed to the CLI
 * @returns {Object} A config object
 */
function loadConfig(filePath) {
	return pa11y.requireFirst([
		filePath,
		filePath.replace(/^\.\//, `${process.cwd()}/`),
		`${process.cwd()}/${filePath}`
	], {});
}

/**
 * Attempts to load a reporter from disk
 * @param {String} name - The name of the reporter, e.g. `pa11y-reporter-html`
 * @returns {void}
 */
function loadReporter(name) {
	let reporterMethods;

	try {
		reporterMethods = pa11y.requireFirst([
			`pa11y-reporter-${name}`,
			path.join(process.cwd(), name)
		], null);
	} catch (error) {
		console.error(
			`An error occurred when loading the "${name}" reporter. ` +
			'This is not an error'
		);
		console.error('with Pa11y itself, please contact the creator of this reporter\n');
		console.error(error.stack);
		process.exit(1);
	}

	if (!reporterMethods) {
		console.error(`Reporter "${name}" could not be found`);
		process.exit(1);
	}
	checkReporterCompatibility(name, reporterMethods.supports, pkg.version);
	return buildReporter(reporterMethods);
}

/**
 * Check if the reporter supports this version of pa11y
 * @param {String} reporterName - Name of the reporter
 * @param {String} reporterSupportString - List of supported versions, e.g. '^5.0.0'
 * @param {String} pa11yVersion - This version of pa11y
 * @returns {void}
 */
function checkReporterCompatibility(reporterName, reporterSupportString, pa11yVersion) {
	if (!reporterSupportString || !semver.satisfies(pa11yVersion, reporterSupportString)) {
		console.error(
			`Error: The installed "${reporterName}" reporter does not support ` +
			`Pa11y ${pa11yVersion}`
		);
		console.error('Please update your version of Pa11y or the reporter');
		console.error(`Reporter Support: ${reporterSupportString}`);
		console.error(`Pa11y Version:    ${pa11yVersion}`);
		process.exit(1);
	}
}

/**
 * Calculates if there are any errors to be reported (i.e. above the threshold)
 * This is used for example to return the correct status code on the CLI
 * @param {String} level - The level of reporting required (warning, notice, etc.)
 * @param {Object} results - The results found by the test
 * @param {Number} threshold - The threshold specified as acceptable
 * @returns {Number|false} The number of issues to report (truthy), or false if there are none
 */
function reportShouldFail(level, results, threshold) {
	if (level === 'none') {
		return false;
	}
	if (level === 'notice') {
		return (results.length > threshold);
	}
	if (level === 'warning') {
		return (results.filter(isWarningOrError).length > threshold);
	}
	return (results.filter(isError).length > threshold);
}

function isError(result) {
	return (result.type === 'error');
}

function isWarningOrError(result) {
	return (result.type === 'warning' || result.type === 'error');
}

/**
 * Create an array from a semicolon-separated string of options
 * @param {String} val - The string of user-specified values
 * @param {Array} array - The previous value(s), if any
 * @returns {Array} Array with the parameters passed
 */
function collectOptions(val, array) {
	return array.concat(val.split(';'));
}

/**
 * Output environment info for debugging purposes
 * @returns {Promise} - resolves a string with environment information from envinfo
 */
async function outputEnvironmentInfo() {
	const envData = await envinfo.run({
		System: ['OS', 'CPU', 'Memory', 'Shell'],
		Binaries: ['Node', 'Yarn', 'npm'],
		npmPackages: ['pa11y']
	});

	console.log(envData);
	process.exit(0);
}

