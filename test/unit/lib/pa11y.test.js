'use strict';

const assert = require('proclaim');
const mockery = require('mockery');
const path = require('path');
const sinon = require('sinon');

describe('lib/pa11y', () => {
	let extend;
	let fs;
	let htmlCodeSnifferRunner;
	let htmlCodeSnifferPath;
	let pa11y;
	let pa11yResults;
	let pa11yRunnerPath;
	let pkg;
	let promiseTimeout;
	let puppeteer;
	let runAction;
	let semver;

	beforeEach(() => {

		pa11yResults = {
			mockResults: true
		};
		/* eslint-disable no-underscore-dangle */
		global.window = {
			__pa11y: {
				run: sinon.stub().returns(pa11yResults)
			}
		};
		/* eslint-enable no-underscore-dangle */

		runAction = require('../mock/action.mock');
		mockery.registerMock('./action', runAction);

		extend = sinon.spy(require('node.extend'));
		mockery.registerMock('node.extend', extend);

		pkg = require('../../../package.json');

		htmlCodeSnifferRunner = {
			supports: 'mock-support-string',
			scripts: [
				'/mock/HTMLCS.js'
			],
			run: () => 'mock-htmlcs-runner'
		};
		mockery.registerMock('pa11y-runner-htmlcs', htmlCodeSnifferRunner);

		htmlCodeSnifferPath = '/mock/HTMLCS.js';
		pa11yRunnerPath = path.resolve(`${__dirname}/../../../lib/runner.js`);

		fs = require('../mock/fs.mock');
		mockery.registerMock('fs', fs);

		fs.readFile.withArgs(htmlCodeSnifferPath).yieldsAsync(undefined, 'mock-html-codesniffer-js');
		fs.readFile.withArgs(pa11yRunnerPath).yieldsAsync(undefined, 'mock-pa11y-runner-js');

		pkg = require('../../../package.json');

		promiseTimeout = sinon.spy(require('p-timeout'));
		mockery.registerMock('p-timeout', promiseTimeout);

		puppeteer = require('../mock/puppeteer.mock');
		mockery.registerMock('puppeteer', puppeteer);

		puppeteer.mockPage.evaluate.resolves(pa11yResults);

		semver = require('../mock/semver.mock');
		mockery.registerMock('semver', semver);
		semver.satisfies.returns(true);

		pa11y = require('../../../lib/pa11y');

	});

	afterEach(() => {
		/* eslint-disable no-underscore-dangle */
		delete global.window;
		/* eslint-enable no-underscore-dangle */
	});

	it('is a function', () => {
		assert.isFunction(pa11y);
	});

	describe('pa11y(url)', () => {
		let resolvedValue;

		beforeEach(async () => {
			resolvedValue = await pa11y('https://mock-url/');
		});

		it('defaults an empty options object with `pa11y.defaults`', () => {
			assert.calledOnce(extend);
			assert.isObject(extend.firstCall.args[0]);
			assert.strictEqual(extend.firstCall.args[1], pa11y.defaults);
			assert.deepEqual(extend.firstCall.args[2], {});
		});

		it('uses a promise timeout function', () => {
			assert.calledOnce(promiseTimeout);
			assert.instanceOf(promiseTimeout.firstCall.args[0], Promise);
			assert.strictEqual(promiseTimeout.firstCall.args[1], pa11y.defaults.timeout);
			assert.strictEqual(promiseTimeout.firstCall.args[2], `Pa11y timed out (${pa11y.defaults.timeout}ms)`);
		});

		it('launches puppeteer with `options.chromeLaunchConfig`', () => {
			assert.calledOnce(puppeteer.launch);
			assert.calledWithExactly(puppeteer.launch, pa11y.defaults.chromeLaunchConfig);
		});

		it('creates a new page', () => {
			assert.calledOnce(puppeteer.mockBrowser.newPage);
			assert.calledWithExactly(puppeteer.mockBrowser.newPage);
		});

		it('set the user agent', () => {
			assert.calledOnce(puppeteer.mockPage.setUserAgent);
			assert.calledWithExactly(puppeteer.mockPage.setUserAgent, pa11y.defaults.userAgent);
		});

		it('adds a console handler to the page', () => {
			assert.called(puppeteer.mockPage.on);
			assert.calledWith(puppeteer.mockPage.on, 'console');
			assert.isFunction(puppeteer.mockPage.on.withArgs('console').firstCall.args[1]);
		});

		it('navigates to `url`', () => {
			assert.calledOnce(puppeteer.mockPage.goto);
			assert.calledWith(puppeteer.mockPage.goto, 'https://mock-url/', {
				waitUntil: 'networkidle2',
				timeout: pa11y.defaults.timeout
			});
		});

		it('sets the viewport', () => {
			assert.calledOnce(puppeteer.mockPage.setViewport);
			assert.calledWith(puppeteer.mockPage.setViewport, pa11y.defaults.viewport);
		});

		it('loads the HTML CodeSniffer JavaScript', () => {
			assert.called(fs.readFile);
			assert.calledWith(fs.readFile, path.resolve(`/mock/HTMLCS.js`), 'utf-8');
		});

		it('loads the Pa11y runner JavaScript', () => {
			assert.called(fs.readFile);
			assert.calledWith(fs.readFile, path.resolve(`${__dirname}/../../../lib/runner.js`), 'utf-8');
		});

		it('verifies that the runner supports the current version of Pa11y', () => {
			assert.calledOnce(semver.satisfies);
			assert.calledWithExactly(semver.satisfies, pkg.version, 'mock-support-string');
		});

		it('evaluates the HTML CodeSniffer vendor and runner JavaScript', () => {
			assert.called(puppeteer.mockPage.evaluate);
			assert.match(puppeteer.mockPage.evaluate.secondCall.args[0], /^\s*;\s*mock-html-codesniffer-js\s*;/);
			assert.match(puppeteer.mockPage.evaluate.secondCall.args[0], /;\s*window\.__pa11y\.runners\['htmlcs'\] = \(\) => 'mock-htmlcs-runner'\s*;\s*$/);
		});

		it('evaluates the the Pa11y runner JavaScript', () => {
			assert.called(puppeteer.mockPage.evaluate);
			assert.calledWith(puppeteer.mockPage.evaluate, 'mock-pa11y-runner-js');
		});

		it('evaluates some JavaScript in the context of the page', () => {
			assert.called(puppeteer.mockPage.evaluate);
			assert.isFunction(puppeteer.mockPage.evaluate.thirdCall.args[0]);
			assert.deepEqual(puppeteer.mockPage.evaluate.thirdCall.args[1], {
				hideElements: pa11y.defaults.hideElements,
				ignore: [
					'notice',
					'warning'
				],
				pa11yVersion: pkg.version,
				rootElement: pa11y.defaults.rootElement,
				rules: pa11y.defaults.rules,
				runners: [
					'htmlcs'
				],
				standard: pa11y.defaults.standard,
				wait: pa11y.defaults.wait
			});
		});

		describe('evaluated JavaScript', () => {
			let options;
			let returnValue;

			beforeEach(() => {
				options = {
					mockOptions: true
				};
				returnValue = puppeteer.mockPage.evaluate.thirdCall.args[0](options);
			});

			it('calls `__pa11y.run` with the passed in options', () => {
				/* eslint-disable no-underscore-dangle */
				assert.calledOnce(global.window.__pa11y.run);
				assert.calledWithExactly(global.window.__pa11y.run, options);
				/* eslint-enable no-underscore-dangle */
			});

			it('returns the return value of `__pa11y.run`', () => {
				assert.strictEqual(returnValue, pa11yResults);
			});

		});

		it('closes the browser', () => {
			assert.calledOnce(puppeteer.mockBrowser.close);
			assert.calledWithExactly(puppeteer.mockBrowser.close);
		});

		it('resolves with the Pa11y results', () => {
			assert.strictEqual(resolvedValue, pa11yResults);
		});

		describe('when `url` does not have a scheme', () => {

			beforeEach(async () => {
				puppeteer.mockPage.goto.resetHistory();
				resolvedValue = await pa11y('mock-url');
			});

			it('navigates to `url` with an `http` scheme added', () => {
				assert.calledOnce(puppeteer.mockPage.goto);
				assert.calledWith(puppeteer.mockPage.goto, 'http://mock-url');
			});

		});

		describe('when `url` does not have a scheme and starts with a slash', () => {

			beforeEach(async () => {
				puppeteer.mockPage.goto.resetHistory();
				resolvedValue = await pa11y('/mock-path');
			});

			it('navigates to `url` with an `file` scheme added', () => {
				assert.calledOnce(puppeteer.mockPage.goto);
				assert.calledWith(puppeteer.mockPage.goto, 'file:///mock-path');
			});

		});

		describe('when `url` does not have a scheme and starts with a period', () => {

			beforeEach(async () => {
				puppeteer.mockPage.goto.resetHistory();
				resolvedValue = await pa11y('./mock-path');
			});

			it('navigates to `url` with an `file` scheme added and a resolved path', () => {
				const resolvedPath = path.resolve(process.cwd(), './mock-path');
				assert.calledOnce(puppeteer.mockPage.goto);
				assert.calledWith(puppeteer.mockPage.goto, `file://${resolvedPath}`);
			});

		});

		describe('when Headless Chrome errors', () => {
			let headlessChromeError;
			let rejectedError;

			beforeEach(async () => {
				headlessChromeError = new Error('headless chrome error');
				puppeteer.mockBrowser.close.resetHistory();
				puppeteer.mockPage.goto.rejects(headlessChromeError);
				try {
					await pa11y('https://mock-url/');
				} catch (error) {
					rejectedError = error;
				}
			});

			it('closes the browser', () => {
				assert.calledOnce(puppeteer.mockBrowser.close);
				assert.calledWithExactly(puppeteer.mockBrowser.close);
			});

			it('rejects with the error', () => {
				assert.strictEqual(rejectedError, headlessChromeError);
			});

		});

	});

	describe('pa11y(options)', () => {
		let options;

		beforeEach(async () => {
			options = {
				mockOptions: true,
				timeout: 40000,
				url: 'https://mock-url/',
				log: {
					debug: sinon.stub(),
					error: sinon.stub(),
					info: sinon.stub()
				}
			};
			await pa11y(options);
		});

		it('defaults the options object with `pa11y.defaults`', () => {
			assert.calledOnce(extend);
			assert.isObject(extend.firstCall.args[0]);
			assert.strictEqual(extend.firstCall.args[1], pa11y.defaults);
			assert.deepEqual(extend.firstCall.args[2], options);
		});

		it('navigates to `options.url`', () => {
			assert.calledOnce(puppeteer.mockPage.goto);
			assert.calledWith(puppeteer.mockPage.goto, 'https://mock-url/', {
				waitUntil: 'networkidle2',
				timeout: options.timeout
			});
		});

		describe('console handler', () => {
			let mockMessage;

			beforeEach(() => {
				mockMessage = {
					text: sinon.stub().returns('mock-message')
				};
				puppeteer.mockPage.on.withArgs('console').firstCall.args[1](mockMessage);
			});

			it('logs the console message text with `options.log.debug`', () => {
				assert.calledWithExactly(options.log.debug, 'Browser Console: mock-message');
			});

		});

		describe('when `options.standard` is invalid', () => {
			let rejectedError;

			beforeEach(async () => {
				options.standard = 'not-a-standard';
				try {
					await pa11y(options);
				} catch (error) {
					rejectedError = error;
				}
			});

			it('rejects with a descriptive error', () => {
				assert.instanceOf(rejectedError, Error);
				assert.strictEqual(rejectedError.message, 'Standard must be one of Section508, WCAG2A, WCAG2AA, WCAG2AAA');
			});

		});

		describe('when `options.ignore` has items with uppercase letters', () => {

			beforeEach(async () => {
				extend.resetHistory();
				options.ignore = [
					'MOCK-IGNORE'
				];
				await pa11y(options);
			});

			it('lowercases them', () => {
				assert.include(extend.firstCall.args[0].ignore, 'mock-ignore');
			});

		});

		describe('when `options.includeNotices` is `false`', () => {

			beforeEach(async () => {
				puppeteer.mockPage.evaluate.resetHistory();
				options.ignore = [];
				options.includeNotices = false;
				await pa11y(options);
			});

			it('automatically ignores notices', () => {
				assert.deepEqual(puppeteer.mockPage.evaluate.thirdCall.args[1].ignore, [
					'notice',
					'warning'
				]);
			});

		});

		describe('when `options.includeNotices` is `true`', () => {

			beforeEach(async () => {
				puppeteer.mockPage.evaluate.resetHistory();
				options.ignore = [];
				options.includeNotices = true;
				await pa11y(options);
			});

			it('does not automatically ignore notices', () => {
				assert.deepEqual(puppeteer.mockPage.evaluate.thirdCall.args[1].ignore, [
					'warning'
				]);
			});

		});

		describe('when `options.includeWarnings` is `false`', () => {

			beforeEach(async () => {
				puppeteer.mockPage.evaluate.resetHistory();
				options.ignore = [];
				options.includeWarnings = false;
				await pa11y(options);
			});

			it('automatically ignores warnings', () => {
				assert.deepEqual(puppeteer.mockPage.evaluate.thirdCall.args[1].ignore, [
					'notice',
					'warning'
				]);
			});

		});

		describe('when `options.includeWarnings` is `true`', () => {

			beforeEach(async () => {
				puppeteer.mockPage.evaluate.resetHistory();
				options.ignore = [];
				options.includeWarnings = true;
				await pa11y(options);
			});

			it('does not automatically ignore warnings', () => {
				assert.deepEqual(puppeteer.mockPage.evaluate.thirdCall.args[1].ignore, [
					'notice'
				]);
			});

		});

		describe('when `options.postData` is set', () => {

			beforeEach(async () => {
				puppeteer.mockPage.on.resetHistory();
				options.method = 'POST';
				options.postData = 'mock-post-data';
				await pa11y(options);
			});

			it('enables request interception', () => {
				assert.calledOnce(puppeteer.mockPage.setRequestInterception);
				assert.calledWithExactly(puppeteer.mockPage.setRequestInterception, true);
			});

			it('adds a request handler to the page', () => {
				assert.called(puppeteer.mockPage.on);
				assert.calledWith(puppeteer.mockPage.on, 'request');
				assert.isFunction(puppeteer.mockPage.on.withArgs('request').firstCall.args[1]);
			});

			describe('request handler', () => {
				let mockInterceptedRequest;

				beforeEach(() => {
					mockInterceptedRequest = {
						continue: sinon.stub()
					};
					puppeteer.mockPage.on.withArgs('request').firstCall.args[1](mockInterceptedRequest);
				});

				it('calls `interceptedRequest.continue` with the postData option', () => {
					assert.calledOnce(mockInterceptedRequest.continue);
					assert.calledWith(mockInterceptedRequest.continue, {
						method: options.method,
						postData: options.postData,
						headers: {}
					});
				});

				describe('when triggered again', () => {
					beforeEach(() => {
						puppeteer.mockPage.on.withArgs('request').firstCall.args[1](mockInterceptedRequest);
					});

					it('calls `interceptedRequest.continue` with an empty object', () => {
						assert.calledTwice(mockInterceptedRequest.continue);
						assert.calledWith(mockInterceptedRequest.continue, {
							method: options.method,
							postData: options.postData,
							headers: {}
						});
						assert.calledWith(mockInterceptedRequest.continue, {});
					});
				});
			});

		});

		describe('when `options.screenCapture` is set', () => {

			beforeEach(async () => {
				extend.resetHistory();
				options.screenCapture = 'mock.png';
				await pa11y(options);
			});

			it('generates a screenshot', () => {
				assert.called(puppeteer.mockPage.screenshot);
				assert.calledWith(puppeteer.mockPage.screenshot, {
					path: options.screenCapture,
					fullPage: true
				});
			});

			describe('when screenshot generation fails', () => {
				let rejectedError;

				beforeEach(async () => {
					puppeteer.mockPage.screenshot.rejects(new Error('screenshot failed'));
					try {
						await pa11y(options);
					} catch (error) {
						rejectedError = error;
					}
				});

				it('does not reject', () => {
					assert.isUndefined(rejectedError);
				});

			});

		});

		describe('when `options.headers` has properties', () => {

			beforeEach(async () => {
				puppeteer.mockPage.on.resetHistory();
				options.headers = {
					foo: 'bar',
					bar: 'baz',
					'Foo-Bar-Baz': 'qux'
				};
				await pa11y(options);
			});

			describe('request handler', () => {
				let mockInterceptedRequest;

				beforeEach(() => {
					mockInterceptedRequest = {
						continue: sinon.stub()
					};
					puppeteer.mockPage.on.withArgs('request').firstCall.args[1](mockInterceptedRequest);
				});

				it('calls `interceptedRequest.continue` with the headers option all lower-cased', () => {
					assert.calledOnce(mockInterceptedRequest.continue);
					assert.calledWith(mockInterceptedRequest.continue, {
						method: pa11y.defaults.method,
						headers: {
							foo: 'bar',
							bar: 'baz',
							'foo-bar-baz': 'qux'
						}
					});
				});

			});

		});

		describe('when `options.userAgent` is `false`', () => {

			beforeEach(async () => {
				puppeteer.mockPage.setUserAgent.resetHistory();
				options.userAgent = false;
				await pa11y(options);
			});

			it('automatically ignores warnings', () => {
				assert.notCalled(puppeteer.mockPage.setUserAgent);
			});

		});

		describe('when `options.actions` is set', () => {

			beforeEach(async () => {
				extend.resetHistory();
				options.actions = [
					'mock-action-1',
					'mock-action-2'
				];
				await pa11y(options);
			});

			it('calls runAction with each action', () => {
				assert.calledTwice(runAction);
				assert.calledWith(runAction, puppeteer.mockBrowser, puppeteer.mockPage, extend.firstCall.returnValue, 'mock-action-1');
				assert.calledWith(runAction, puppeteer.mockBrowser, puppeteer.mockPage, extend.firstCall.returnValue, 'mock-action-2');
			});

			describe('when an action rejects', () => {
				let actionError;
				let rejectedError;

				beforeEach(async () => {
					actionError = new Error('action error');
					runAction.rejects(actionError);
					try {
						await pa11y(options);
					} catch (error) {
						rejectedError = error;
					}
				});

				it('rejects with the action error', () => {
					assert.strictEqual(rejectedError, actionError);
				});

			});

		});

		describe('when `options.browser` is set', () => {

			beforeEach(async () => {
				extend.resetHistory();
				puppeteer.launch.resetHistory();
				puppeteer.mockBrowser.newPage.resetHistory();
				puppeteer.mockBrowser.close.resetHistory();
				puppeteer.mockPage.close.resetHistory();
				options.browser = {
					close: sinon.stub(),
					newPage: sinon.stub().resolves(puppeteer.mockPage)
				};
				await pa11y(options);
			});

			it('does not launch puppeteer', () => {
				assert.notCalled(puppeteer.launch);
			});

			it('creates a new page using the passed in browser', () => {
				assert.calledOnce(options.browser.newPage);
				assert.calledWithExactly(options.browser.newPage);
			});

			it('does not close the browser', () => {
				assert.notCalled(options.browser.close);
			});

			it('closes the page', () => {
				assert.calledOnce(puppeteer.mockPage.close);
			});

			describe('and an error occurs', () => {
				let headlessChromeError;

				beforeEach(async () => {
					headlessChromeError = new Error('headless chrome error');
					puppeteer.mockPage.goto.rejects(headlessChromeError);
					try {
						await pa11y(options);
					} catch (error) {
					}
				});

				it('does not close the browser', () => {
					assert.notCalled(options.browser.close);
				});

			});

		});

		describe('when `options.browser` and `options.page` is set', () => {

			beforeEach(async () => {
				extend.resetHistory();
				puppeteer.launch.resetHistory();
				puppeteer.mockBrowser.newPage.resetHistory();
				puppeteer.mockBrowser.close.resetHistory();
				puppeteer.mockPage.close.resetHistory();
				options.browser = puppeteer.mockBrowser;
				options.page = puppeteer.mockPage;

				await pa11y(options);
			});

			it('does not launch puppeteer', () => {
				assert.notCalled(puppeteer.launch);
			});

			it('does not open the page', () => {
				assert.notCalled(options.browser.newPage);
			});

			it('does not close the browser', () => {
				assert.notCalled(options.browser.close);
			});

			it('does not close the page', () => {
				assert.notCalled(options.page.close);
			});

			describe('and an error occurs', () => {
				let headlessChromeError;

				beforeEach(async () => {
					headlessChromeError = new Error('headless chrome error');
					puppeteer.mockPage.goto.rejects(headlessChromeError);
					try {
						await pa11y(options);
					} catch (error) {
					}
				});

				it('does not close the browser', () => {
					assert.notCalled(options.browser.close);
				});

				it('does not close the page', () => {
					assert.notCalled(options.page.close);
				});

			});

		});

		describe('when `options.page` and `options.ignoreUrl` are set', () => {

			beforeEach(async () => {
				extend.resetHistory();
				puppeteer.launch.resetHistory();
				puppeteer.mockBrowser.newPage.resetHistory();
				puppeteer.mockBrowser.close.resetHistory();
				puppeteer.mockPage.close.resetHistory();
				puppeteer.mockPage.goto.resetHistory();
				options.browser = puppeteer.mockBrowser;
				options.page = puppeteer.mockPage;
				options.ignoreUrl = true;

				await pa11y(options);
			});

			it('does not call page.goto', () => {
				assert.notCalled(options.page.goto);
			});
		});

		describe('when `options.page` is set without `options.browser`', () => {
			let rejectedError;

			beforeEach(async () => {
				options.page = puppeteer.mockPage;
				try {
					await pa11y(options);
				} catch (error) {
					rejectedError = error;
				}
			});

			it('rejects with a descriptive error', () => {
				assert.instanceOf(rejectedError, Error);
				assert.strictEqual(rejectedError.message, 'The page option must only be set alongside the browser option');
			});

		});

		describe('when `options.ignoreUrl` is set without `options.page`', () => {
			let rejectedError;

			beforeEach(async () => {
				options.page = undefined;
				options.ignoreUrl = true;
				try {
					await pa11y(options);
				} catch (error) {
					rejectedError = error;
				}
			});

			it('rejects with a descriptive error', () => {
				assert.instanceOf(rejectedError, Error);
				assert.strictEqual(rejectedError.message, 'The ignoreUrl option must only be set alongside the page option');
			});

		});

		describe('when `options.runners` is set', () => {
			let mockRunnerNodeModule;
			let mockRunnerPa11yNodeModule;

			beforeEach(async () => {
				puppeteer.mockPage.evaluate.resetHistory();
				fs.readFile.resetHistory();

				mockRunnerPa11yNodeModule = {
					supports: 'mock-support-string',
					scripts: [
						'/mock-runner-pa11y-node-module/vendor.js'
					],
					run: () => 'mock-runner-pa11y-node-module'
				};
				mockery.registerMock('pa11y-runner-pa11y-node-module', mockRunnerPa11yNodeModule);

				mockRunnerNodeModule = {
					supports: 'mock-support-string',
					scripts: [
						'/mock-runner-node-module/vendor.js'
					],
					run: () => 'mock-runner-node-module'
				};
				mockery.registerMock('node-module', mockRunnerNodeModule);

				fs.readFile.withArgs('/mock-runner-pa11y-node-module/vendor.js').yieldsAsync(undefined, 'mock-runner-pa11y-node-module-js');
				fs.readFile.withArgs('/mock-runner-node-module/vendor.js').yieldsAsync(undefined, 'mock-runner-node-module-js');

				options.runners = [
					'pa11y-node-module',
					'node-module'
				];
				await pa11y(options);
			});

			it('evaluates all vendor script and runner JavaScript', () => {
				assert.called(puppeteer.mockPage.evaluate);
				assert.match(puppeteer.mockPage.evaluate.getCall(1).args[0], /^\s*;\s*mock-runner-pa11y-node-module-js\s*;\s*;\s*window\.__pa11y\.runners\['pa11y-node-module'\] = \(\) => 'mock-runner-pa11y-node-module'\s*;\s*$/);
				assert.match(puppeteer.mockPage.evaluate.getCall(2).args[0], /^\s*;\s*mock-runner-node-module-js\s*;\s*;\s*window\.__pa11y\.runners\['node-module'\] = \(\) => 'mock-runner-node-module'\s*;\s*$/);
			});
		});

		describe('when `options.runners` is set and one of the runners does not support the current version of Pa11y', () => {
			let mockRunnerNodeModule;
			let rejectedError;

			beforeEach(async () => {
				puppeteer.mockPage.evaluate.resetHistory();
				fs.readFile.resetHistory();

				mockRunnerNodeModule = {
					supports: 'mock-support-string',
					scripts: [
						'/mock-runner-node-module/vendor.js'
					],
					run: () => 'mock-runner-node-module'
				};
				mockery.registerMock('node-module', mockRunnerNodeModule);

				semver.satisfies.returns(false);

				options.runners = [
					'node-module'
				];

				try {
					await pa11y(options);
				} catch (error) {
					rejectedError = error;
				}
			});

			it('rejects with a descriptive error', () => {
				assert.instanceOf(rejectedError, Error);
				assert.strictEqual(rejectedError.message, [
					`The installed "node-module" runner does not support Pa11y ${pkg.version}`,
					'Please update your version of Pa11y or the runner',
					'Reporter Support: mock-support-string',
					`Pa11y Version:    ${pkg.version}`
				].join('\n'));
			});

		});

	});

	describe('pa11y(url, options)', () => {
		let options;

		beforeEach(async () => {
			options = {
				mockOptions: true
			};
			await pa11y('https://mock-url/', options);
		});

		it('defaults the options object with `pa11y.defaults`', () => {
			assert.calledOnce(extend);
			assert.isObject(extend.firstCall.args[0]);
			assert.strictEqual(extend.firstCall.args[1], pa11y.defaults);
			assert.deepEqual(extend.firstCall.args[2], options);
		});

		it('navigates to `url`', () => {
			assert.calledOnce(puppeteer.mockPage.goto);
			assert.calledWith(puppeteer.mockPage.goto, 'https://mock-url/', {
				waitUntil: 'networkidle2',
				timeout: pa11y.defaults.timeout
			});
		});

		it('produces a helpful message if runner is not found`', async () => {
			options = {
				mockOptions: true,
				runners: ['potato']
			};
			let runnerError;
			try {
				await pa11y('https://mock-url/', options);
			} catch (error) {
				runnerError = error;
			}
			assert.strictEqual(runnerError.message, 'Runner module not found: potato');
		});


	});

	describe('pa11y(url, callback)', () => {
		let callbackError;
		let callbackResults;

		beforeEach(done => {
			pa11y('https://mock-url/', (error, results) => {
				callbackError = error;
				callbackResults = results;
				done();
			});
		});

		it('calls back with the Pa11y results', () => {
			assert.strictEqual(callbackResults, pa11yResults);
		});

		describe('when something errors', () => {
			let headlessChromeError;

			beforeEach(done => {
				headlessChromeError = new Error('headless chrome error');
				puppeteer.mockBrowser.close.resetHistory();
				puppeteer.mockPage.goto.rejects(headlessChromeError);
				pa11y('https://mock-url/', (error, results) => {
					callbackError = error;
					callbackResults = results;
					done();
				});
			});

			it('closes the browser', () => {
				assert.calledOnce(puppeteer.mockBrowser.close);
				assert.calledWithExactly(puppeteer.mockBrowser.close);
			});

			it('calls back with the error', () => {
				assert.strictEqual(callbackError, headlessChromeError);
			});

		});

	});

	it('has an `isValidAction` method which aliases `action.isValidAction`', () => {
		assert.isFunction(pa11y.isValidAction);
		assert.strictEqual(pa11y.isValidAction, runAction.isValidAction);
	});

	it('has a `defaults` property', () => {
		assert.isObject(pa11y.defaults);
	});

	describe('.defaults', () => {

		it('has an `actions` property', () => {
			assert.deepEqual(pa11y.defaults.actions, []);
		});

		it('has a `browser` property', () => {
			assert.isNull(pa11y.defaults.browser);
		});

		it('has a `chromeLaunchConfig` property', () => {
			assert.deepEqual(pa11y.defaults.chromeLaunchConfig, {
				ignoreHTTPSErrors: true
			});
		});

		it('has a `headers` property', () => {
			assert.deepEqual(pa11y.defaults.headers, {});
		});

		it('has a `hideElements` property', () => {
			assert.isNull(pa11y.defaults.hideElements);
		});

		it('has an `ignore` property', () => {
			assert.deepEqual(pa11y.defaults.ignore, []);
		});

		it('has an `ignoreUrl` property', () => {
			assert.isFalse(pa11y.defaults.ignoreUrl);
		});

		it('has an `includeNotices` property', () => {
			assert.isFalse(pa11y.defaults.includeNotices);
		});

		it('has an `includeWarnings` property', () => {
			assert.isFalse(pa11y.defaults.includeWarnings);
		});

		it('has a `log` property', () => {
			assert.isObject(pa11y.defaults.log);
		});

		it('has a `log.debug` method', () => {
			assert.isFunction(pa11y.defaults.log.debug);
		});

		it('has a `log.error` method', () => {
			assert.isFunction(pa11y.defaults.log.error);
		});

		it('has a `log.info` method', () => {
			assert.isFunction(pa11y.defaults.log.info);
		});

		it('has a `method` property', () => {
			assert.deepEqual(pa11y.defaults.method, 'GET');
		});

		it('has a `postData` property', () => {
			assert.isNull(pa11y.defaults.postData);
		});

		it('has a `rootElement` property', () => {
			assert.isNull(pa11y.defaults.rootElement);
		});

		it('has a `rules` property', () => {
			assert.deepEqual(pa11y.defaults.rules, []);
		});

		it('has a `screenCapture` property', () => {
			assert.isNull(pa11y.defaults.screenCapture);
		});

		it('has a `standard` property', () => {
			assert.strictEqual(pa11y.defaults.standard, 'WCAG2AA');
		});

		it('has a `timeout` property', () => {
			assert.strictEqual(pa11y.defaults.timeout, 30000);
		});

		it('has a `userAgent` property', () => {
			assert.strictEqual(pa11y.defaults.userAgent, `pa11y/${pkg.version}`);
		});

		it('has a `viewport` property', () => {
			assert.deepEqual(pa11y.defaults.viewport, {
				width: 1280,
				height: 1024
			});
		});

		it('has a `wait` property', () => {
			assert.strictEqual(pa11y.defaults.wait, 0);
		});

	});

	describe('.requireFirst', () => {
		// Note: 'fs' has been registered with `mockery`
		it('returns the first file when a match is found', () => {
			const result = pa11y.requireFirst(['fs']);
			assert.isDefined(result.readFile);
		});
		it('returns the first file found if beyond the first in the list', () => {
			const result = pa11y.requireFirst(['potato', 'fs']);
			assert.isDefined(result.readFile);
		});
		it('returns the default if entire stack is not found', () => {
			const result = pa11y.requireFirst(['potato'], {defaultValue: true});
			assert(result.defaultValue);
		});
		it('returns the default if the require-stack is empty', () => {
			const result = pa11y.requireFirst([], {defaultValue: true});
			assert(result.defaultValue);
		});
	});

});
