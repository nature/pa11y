'use strict';

const runAction = require('./action');
const option = require('./option');
const fs = require('fs');
const pkg = require('../package.json');
const promiseTimeout = require('p-timeout');
const puppeteer = require('puppeteer');
const semver = require('semver');

const runnersJavascript = {};

module.exports = pa11y;

/**
 * Run accessibility tests on a web page.
 * @public
 * @param {String} url - The URL to run tests against.
 * @param {Object} [options={}] - Options to change the way tests run.
 * @param {Function} [callback] - An optional callback to use instead of promises.
 * @returns {Promise} Returns a promise which resolves with a results object.
 */
async function pa11y(url, options = {}, callback) {
	const state = {};
	let pa11yError;
	let pa11yResults;
	[url, options, callback] = option.parseArguments(url, options, pa11y.defaults, callback);

	try {
		// Verify that the given options are valid
		option.verifyOptions(options, pa11y.allowedStandards);

		// Call the actual Pa11y test runner with
		// a timeout if it takes too long
		pa11yResults = await promiseTimeout(
			runPa11yTest(url, options, state),
			options.timeout,
			`Pa11y timed out (${options.timeout}ms)`
		);
	} catch (error) {
		// Capture error if a callback is provided, otherwise reject with error
		if (callback) {
			pa11yError = error;
		} else {
			throw error;
		}
	} finally {
		await stateCleanup(state);
	}
	// Run callback if present, and resolve with pa11yResults
	return callback ? callback(pa11yError, pa11yResults) : pa11yResults;
}

/**
 * Internal Pa11y test runner.
 * @private
 * @param {String} url - The URL to run tests against.
 * @param {Object} options - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} Returns a promise which resolves with a results object.
 */
async function runPa11yTest(url, options, state) {

	options.log.info(`Running Pa11y on URL ${url}`);

	await setBrowser(options, state);

	await setPage(options, state);

	await interceptRequests(options, state);

	await gotoUrl(url, options, state);

	await runActionsList(options, state);

	await injectRunners(options, state);

	// Launch the test runner!
	options.log.debug('Running Pa11y on the page');

	/* istanbul ignore next */
	if (options.wait > 0) {
		options.log.debug(`Waiting for ${options.wait}ms`);
	}

	const results = await runPa11yWithOptions(options, state);

	options.log.debug(`Document title: "${results.documentTitle}"`);

	await saveScreenCapture(options, state);

	return results;
}

/**
 * Ensures that puppeteer resources are freed and listeners removed.
 * @private
 * @param {Object} state - The last-known state of the test-run.
 * @returns {Promise} A promise which resolves when resources are released
 */
async function stateCleanup(state) {
	if (state.browser && state.autoClose) {
		await state.browser.close();
	} else if (state.page) {
		state.page.removeListener('request', state.requestInterceptCallback);
		state.page.removeListener('console', state.consoleCallback);
		if (state.autoClosePage) {
			await state.page.close();
		}
	}
}

/**
 * Sets or initialises the browser.
 * @private
 * @param {Object} options - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves when resources are released
 */
async function setBrowser(options, state) {
	if (options.browser) {
		options.log.debug(
			'Using a pre-configured Headless Chrome instance, ' +
					'the `chromeLaunchConfig` option will be ignored'
		);
		state.browser = options.browser;
		state.autoClose = false;
	} else {
		// Launch a Headless Chrome browser. We use a
		// state object which is accessible from the
		// wrapping function
		options.log.debug('Launching Headless Chrome');
		state.browser = await puppeteer.launch(
			options.chromeLaunchConfig
		);
		state.autoClose = true;
	}
}

/**
 * Configures the browser page to be used for the test.
 * @private
 * @param {Object} [options] - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves when the page has been configured.
 */
async function setPage(options, state) {
	if (options.browser && options.page) {
		state.page = options.page;
		state.autoClosePage = false;
	} else {
		state.page = await state.browser.newPage();
		state.autoClosePage = true;
	}
	// Listen for console logs on the page so that we can
	// output them for debugging purposes
	state.consoleCallback = message => {
		// eslint-disable-next-line no-underscore-dangle
		options.log.debug(`Browser Console: ${message.text()}`);
		// eslint-disable-next-line no-underscore-dangle
		options.log.debug(`Browser Console: args: ${JSON.stringify(message._args)}`);
		// eslint-disable-next-line no-underscore-dangle
		options.log.debug(`Browser Console: location: ${JSON.stringify(message._location)}`);

	};
	state.page.on('console', state.consoleCallback);
	options.log.debug('Opening URL in Headless Chrome');
	if (options.userAgent) {
		await state.page.setUserAgent(options.userAgent);
	}
	await state.page.setViewport(options.viewport);
}

/**
 * Configures the browser page to intercept requests if necessary
 * @private
 * @param {Object} [options] - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves immediately if no listeners are necessary
 *   or after listener functions have been attached.
 */
async function interceptRequests(options, state) {
	// Avoid to use `page.setRequestInterception` when not necessary
	// because it occasionally stops page load:
	// https://github.com/GoogleChrome/puppeteer/issues/3111
	// https://github.com/GoogleChrome/puppeteer/issues/3121
	const shouldInterceptRequests =
		(options.headers && Object.keys(options.headers).length) ||
		(options.method && options.method.toLowerCase() !== 'get') ||
		options.postData;

	if (!shouldInterceptRequests) {
		return;
	}
	// Intercept page requests, we need to do this in order
	// to set the HTTP method or post data
	await state.page.setRequestInterception(true);

	// Intercept requests so we can set the HTTP method
	// and post data. We only want to make changes to the
	// first request that's handled, which is the request
	// for the page we're testing
	let interceptionHandled = false;
	state.requestInterceptCallback = interceptedRequest => {
		const overrides = {};
		if (!interceptionHandled) {
			// Override the request method
			options.log.debug(`Setting request method: ${options.method} `);
			overrides.method = options.method;

			// Override the request headers (and include the user-agent)
			overrides.headers = {};
			for (const [key, value] of Object.entries(options.headers)) {
				overrides.headers[key.toLowerCase()] = value;
			}
			// eslint-disable-next-line max-len
			options.log.debug(`Setting request headers:${JSON.stringify(overrides.headers, null, 4)}`);


			// Override the request POST data if present
			if (options.postData) {
				overrides.postData = options.postData;
				options.log.debug(`Setting request POST data: ${overrides.postData}`);

			}

			interceptionHandled = true;
		}
		interceptedRequest.continue(overrides);
	};
	state.page.on('request', state.requestInterceptCallback);
}

/**
 * Instructs the page to go to the provided url unless options.ignoreUrl is true
 * @private
 * @param {String} [url] - The URL of the page to be tested.
 * @param {Object} [options] - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves when the page URL has been set
 */
async function gotoUrl(url, options, state) {
	// Navigate to the URL we're going to test
	if (!options.ignoreUrl) {
		await state.page.goto(url, {
			waitUntil: 'networkidle2',
			timeout: options.timeout
		});
	}
}

/**
 * Carries out a synchronous list of actions in the page
 * @private
 * @param {Object} options - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves when all actions have completed
 */
async function runActionsList(options, state) {
	if (options.actions.length) {
		options.log.info('Running actions');
		for (const action of options.actions) {
			await runAction(state.browser, state.page, options, action);
		}
		options.log.info('Finished running actions');
	}
}

/**
 * Loads the test runners and Pa11y client-side scripts if required
 * @private
 * @param {Object} options - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves when all runners have been injected and evaluated
 */
async function injectRunners(options, state) {
	// We only load these files once on the first run of Pa11y as they don't
	// change between runs
	if (!runnersJavascript.pa11y) {
		runnersJavascript.pa11y = fs.readFileSync(`${__dirname}/runner.js`, 'utf-8');
	}

	for (const runner of options.runners) {
		if (!runnersJavascript[runner]) {
			options.log.debug(`Loading runner: ${runner}`);

			runnersJavascript[runner] = loadRunnerScript(runner);
		}
	}

	// Inject the test runners
	options.log.debug('Injecting Pa11y');
	await state.page.evaluate(runnersJavascript.pa11y);
	for (const runner of options.runners) {
		options.log.debug(`Injecting runner: ${runner}`);

		await state.page.evaluate(runnersJavascript[runner]);
	}
}

/**
 * Sends a request to the page to instruct the injected pa11y script to run with the
 *   provided options
 * @private
 * @param {Object} options - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves with the results of the pa11y evaluation
 */
function runPa11yWithOptions(options, state) {
	/* eslint-disable no-underscore-dangle */
	return state.page.evaluate(runOptions => {
		return window.__pa11y.run(runOptions);
	}, {
		hideElements: options.hideElements,
		ignore: options.ignore,
		pa11yVersion: pkg.version,
		rootElement: options.rootElement,
		rules: options.rules,
		runners: options.runners,
		standard: options.standard,
		wait: options.wait
	});
	/* eslint-enable no-underscore-dangle */
}

/**
 * Generates a screen capture if required by the provided options
 * @private
 * @param {Object} options - Options to change the way tests run.
 * @param {Object} state - The current pa11y internal state, fields will be mutated by
 *   this function.
 * @returns {Promise} A promise which resolves when the screenshot is complete
 */
async function saveScreenCapture(options, state) {
	// Generate a screen capture
	if (options.screenCapture) {
		options.log.info(
			`Capturing screen, saving to "${options.screenCapture}"`
		);
		try {
			await state.page.screenshot({
				path: options.screenCapture,
				fullPage: true
			});
		} catch (error) {
			options.log.error(`Error capturing screen: ${error.message}`);
		}
	}
}

/**
 * Load a Pa11y runner module.
 * @param {String} runner - The name of the runner.
 * @return {Object} Returns the required module.
 */
function loadRunnerFile(runner) {
	switch (runner) {
		// Load internal runners directly
		case 'axe':
			return require(`${__dirname}/runners/axe`);
		case 'htmlcs':
			return require(`${__dirname}/runners/htmlcs`);
		default:
			return require(runner);
	}
}

/**
 * Assert that a Pa11y runner is compatible with a version of Pa11y.
 * @param {String} runnerName - The name of the runner.
 * @param {String} runnerSupportString - The runner support string (a semver range).
 * @param {String} pa11yVersion - The version of Pa11y to test support for.
 * @throws {Error} Throws an error if the reporter does not support the given version of Pa11y
 * @returns {void}
 */
function assertReporterCompatibility(runnerName, runnerSupportString, pa11yVersion) {
	if (!runnerSupportString || !semver.satisfies(pa11yVersion, runnerSupportString)) {
		throw new Error([
			`The installed "${runnerName}" runner does not support Pa11y ${pa11yVersion}`,
			'Please update your version of Pa11y or the runner',
			`Reporter Support: ${runnerSupportString}`,
			`Pa11y Version:    ${pa11yVersion}`
		].join('\n'));
	}
}

/**
 * Loads a runner script
 * @param {String} runner - The name of the runner.
 * @throws {Error} Throws an error if the reporter does not support the given version of Pa11y
 * @returns {String} Javascript source of the runner
 */
function loadRunnerScript(runner) {
	const runnerModule = loadRunnerFile(runner);
	let runnerBundle = '';

	assertReporterCompatibility(runner, runnerModule.supports, pkg.version);

	for (const runnerScript of runnerModule.scripts) {
		runnerBundle += '\n\n';
		runnerBundle += fs.readFileSync(runnerScript, 'utf-8');
	}

	return `
				;${runnerBundle};
				;window.__pa11y.runners['${runner}'] = ${runnerModule.run.toString()};
			`;
}

/* istanbul ignore next */
const noop = () => { /* No-op */ };

/**
 * Default options (excluding 'level', 'reporter', and 'threshold' which are only
 * relevant when calling bin/pa11y from the CLI)
 * @public
 */
pa11y.defaults = {
	actions: [],
	browser: null,
	chromeLaunchConfig: {
		ignoreHTTPSErrors: true
	},
	headers: {},
	hideElements: null,
	ignore: [],
	ignoreUrl: false,
	includeNotices: false,
	includeWarnings: false,
	log: {
		debug: noop,
		error: noop,
		info: noop
	},
	method: 'GET',
	postData: null,
	rootElement: null,
	rules: [],
	runners: [
		'htmlcs'
	],
	screenCapture: null,
	standard: 'WCAG2AA',
	timeout: 30000,
	userAgent: `pa11y/${pkg.version}`,
	viewport: {
		width: 1280,
		height: 1024
	},
	wait: 0
};

/**
 * Allowed a11y standards.
 * @public
 */
pa11y.allowedStandards = [
	'WCAG2A',
	'WCAG2AA',
	'WCAG2AAA'
];

/**
 * Alias the `isValidAction` method
 */
pa11y.isValidAction = runAction.isValidAction;
