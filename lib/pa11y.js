'use strict';

const runAction = require('./action');
const extend = require('node.extend');
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const pkg = require('../package.json');
const promiseTimeout = require('p-timeout');
const puppeteer = require('puppeteer');
const semver = require('semver');

const runnerJavascriptPromises = {};

const readFile = promisify(fs.readFile);

module.exports = pa11y;

/**
 * Run accessibility tests on a web page.
 * @public
 * @param {(String|Object)} url - The URL to run tests against, or options object.
 * @param {Object} [options={}] - Options to change the way tests run.
 * @param {Function} [callback] - An optional callback to use instead of promises.
 * @returns {Promise} Returns a promise which resolves with a results object.
 */
async function pa11y(url, options = {}, callback) {
	const state = {};
	let pa11yError;
	let pa11yResults;
	[url, options, callback] = parseArguments(url, options, callback);

	try {
		// Verify that the given options are valid
		verifyOptions(options);

		if (!url && !options.ignoreUrl) {
			// eslint-disable-next-line max-len
			throw new Error('A url must be defined via the `url` parameter or `options.url`, or `options.ignoreUrl` must be set to true.');
		}

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
 * Parse arguments from the command-line to properly identify the url, options, and callback
 * @private
 * @param {(String|Object)} url - The URL to run tests against, or options object.
 * @param {Object} [options={}] - Options to change the way tests run.
 * @param {Function} [callback] - An optional callback to use instead of promises.
 * @returns {Array} the new values of url, options, and callback
 */
function parseArguments(url, options, callback) {
	if (!callback && typeof options === 'function') {
		callback = options;
		options = {};
	}
	if (url) {
		if (typeof url !== 'string') {
			options = url;
			url = options.url;
		}
		url = sanitizeUrl(url);
	}
	options = defaultOptions(options);

	return [url,
		options,
		callback];
}

/**
 * Default the passed in options using Pa11y's defaults.
 * @private
 * @param {Object} [options] - The options to apply defaults to.
 * @returns {Object} Returns the defaulted options.
 */
function defaultOptions(options) {
	options = extend({}, pa11y.defaults, options);
	options.ignore = options.ignore.map(ignored => ignored.toLowerCase());
	if (!options.includeNotices) {
		options.ignore.push('notice');
	}
	if (!options.includeWarnings) {
		options.ignore.push('warning');
	}
	return options;
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

	if (url) {
		options.log.info(`Running Pa11y on URL ${url}`);
	}

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
		options.log.debug(`Browser Console: ${message.text()}`);
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
			options.log.debug('Setting request method');
			overrides.method = options.method;

			// Override the request headers (and include the user-agent)
			options.log.debug('Setting request headers');
			overrides.headers = {};
			for (const [key, value] of Object.entries(options.headers)) {
				overrides.headers[key.toLowerCase()] = value;
			}

			// Override the request POST data if present
			if (options.postData) {
				options.log.debug('Setting request POST data');
				overrides.postData = options.postData;
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
	if (!runnerJavascriptPromises.pa11y) {
		runnerJavascriptPromises.pa11y = readFile(`${__dirname}/runner.js`, 'utf-8');
	}
	for (const runner of options.runners) {
		if (!runnerJavascriptPromises[runner]) {
			options.log.debug(`Loading runner: ${runner}`);
			runnerJavascriptPromises[runner] = loadRunnerScript(runner);
		}
	}

	// Inject the test runners
	options.log.debug('Injecting Pa11y');
	await state.page.evaluate(await runnerJavascriptPromises.pa11y);
	for (const runner of options.runners) {
		options.log.debug(`Injecting runner: ${runner}`);
		const script = await runnerJavascriptPromises[runner];
		await state.page.evaluate(script);
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
 * Verify that passed in options are valid.
 * @private
 * @param {Object} options - The options to verify.
 * @returns {Undefined} Returns nothing.
 * @throws {Error} Throws if options are not valid.
 */
function verifyOptions(options) {
	if (!pa11y.allowedStandards.includes(options.standard)) {
		throw new Error(`Standard must be one of ${pa11y.allowedStandards.join(', ')}`);
	}
	if (options.page && !options.browser) {
		throw new Error('The page option must only be set alongside the browser option');
	}
	if (options.ignoreUrl && !options.page) {
		throw new Error('The ignoreUrl option must only be set alongside the page option');
	}
}

/**
 * Sanitize a URL, ensuring it has a scheme. If the URL begins with a slash or a period,
 * it will be resolved as a path against the current working directory. If the URL does
 * begin with a scheme, it will be prepended with "http://".
 * @private
 * @param {String} url - The URL to sanitize.
 * @returns {String} Returns the sanitized URL.
 */
function sanitizeUrl(url) {
	if (/^\//i.test(url)) {
		return `file://${url}`;
	}
	if (/^\./i.test(url)) {
		return `file://${path.resolve(process.cwd(), url)}`;
	}
	if (!/^(https?|file):\/\//i.test(url)) {
		return `http://${url}`;
	}
	return url;
}

/**
 * Load a Pa11y runner module.
 * @param {String} runner - The name of the runner.
 * @return {Object} Returns the required module.
 * TODO could this be refactored to use requireFirst (in bin/pa11y.js)
 */
function loadRunnerFile(runner) {
	try {
		return require(`pa11y-runner-${runner}`);
	} catch (error) {}
	return require(runner);
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
 * @returns {Promise<String>} Promise
 */
async function loadRunnerScript(runner) {
	const runnerModule = loadRunnerFile(runner);
	let runnerBundle = '';

	assertReporterCompatibility(runner, runnerModule.supports, pkg.version);

	for (const runnerScript of runnerModule.scripts) {
		runnerBundle += '\n\n';
		runnerBundle += await readFile(runnerScript, 'utf-8');
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
	page: null,
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
	'Section508',
	'WCAG2A',
	'WCAG2AA',
	'WCAG2AAA'
];

/**
 * Alias the `isValidAction` method
 */
pa11y.isValidAction = runAction.isValidAction;
