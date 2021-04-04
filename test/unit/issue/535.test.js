'use strict';

const assert = require('proclaim');
const mockery = require('mockery');
const extend = require('node.extend');
const sinon = require('sinon');


/**
 * Note: this test is designed to replicate issue 535
 *
 * When setting a default of `ignoreUrl: true`, the `pa11y()` function shouldn't
 * require a url parameter
 *
 * https://github.com/pa11y/pa11y/issues/535
 */
describe('lib/pa11y', () => {
	let pa11y;
	let pa11yResults;
	let puppeteer;

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

		puppeteer = require('../mock/puppeteer.mock');
		mockery.registerMock('puppeteer', puppeteer);

		puppeteer.mockPage.evaluate.resolves(pa11yResults);

		pa11y = require('../../../lib/pa11y');

	});

	afterEach(() => {
		/* eslint-disable no-underscore-dangle */
		delete global.window;
		/* eslint-enable no-underscore-dangle */
	});

	describe('Issue #535', () => {
		let page;
		let pa11yError;

		beforeEach(async () => {
			puppeteer.launch.resetHistory();
			puppeteer.mockBrowser.newPage.resetHistory();
			puppeteer.mockBrowser.close.resetHistory();
			puppeteer.mockPage.close.resetHistory();
			puppeteer.mockPage.goto.resetHistory();

			page = puppeteer.mockPage;

			pa11y.defaults = extend({}, pa11y.defaults, {
				browser: puppeteer.mockBrowser,
				page,
				ignoreUrl: true
			});

			try {
				await pa11y();
			} catch (error) {
				pa11yError = error;
			}
		});

		it('ignoring url in defaults does not throw error', () => {
			assert.isNotInstanceOf(pa11yError, Error);
			assert.notCalled(page.goto);
		});
	});

});
