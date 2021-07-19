'use strict';

module.exports = runAction;
module.exports.isValidAction = isValidAction;

/**
 * Run an action string as a function.
 * @private
 * @param {Object} browser - A Puppeteer browser object.
 * @param {Object} page - A Puppeteer page object.
 * @param {Object} options - Options to pass into the action.
 * @param {String} actionString - The action string to run.
 * @returns {Promise} Returns a promise which resolves with undefined.
 */
async function runAction(browser, page, options, actionString) {

	// Find the first action that matches the given action string
	const action = module.exports.actions.find(foundAction => {
		return foundAction.match.test(actionString);
	});

	// If no action can be found, error
	if (!action) {
		throw new Error(`Failed action: "${actionString}" cannot be resolved`);
	}

	// Run the action
	options.log.debug(`Running action: ${actionString}`);
	await action.run(browser, page, options, actionString.match(action.match));
	options.log.debug(`  ✔︎ Action complete: ${action.name}`);
}

/**
 * Check whether an action string is valid.
 * @public
 * @param {String} actionString - The action string to validate.
 * @returns {Boolean} Returns whether the action string is valid.
 */
function isValidAction(actionString) {
	return module.exports.actions.some(foundAction => {
		return foundAction.match.test(actionString);
	});
}

/**
 * Available actions.
 * @private
 */
module.exports.actions = [

	// Action to navigate to a url
	// E.g. "navigate to http://pa11y.org"
	{
		name: 'navigate-url',
		match: /^navigate to( url)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			const navigateTo = matches[2];
			try {
				await page.goto(navigateTo);
			} catch (error) {
				throw new Error(`Failed action: Could not navigate to "${navigateTo}"`);
			}
		}
	},

	// Action to click an element
	// E.g. "click .sign-in-button"
	{
		name: 'click-element',
		match: /^click( element)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			const selector = matches[2];
			try {
				await page.click(selector);
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	},

	// Action to set an input field value
	// E.g. "set field #username to example"
	{
		name: 'set-field-value',
		match: /^set( field)? (.+?) to (.+)$/i,
		run: async (browser, page, options, matches) => {
			const selector = matches[2];
			const value = matches[3];
			try {
				await page.evaluate((targetSelector, desiredValue) => {
					const target = document.querySelector(targetSelector);
					if (!target) {
						return Promise.reject(new Error('No element found'));
					}
					const prototype = Object.getPrototypeOf(target);
					const {set: prototypeValueSetter} =
						Object.getOwnPropertyDescriptor(prototype, 'value') || {};
					if (prototypeValueSetter) {
						prototypeValueSetter.call(target, desiredValue);
					} else {
						target.value = desiredValue;
					}
					target.dispatchEvent(new Event('input', {
						bubbles: true
					}));
					return Promise.resolve();
				}, selector, value);
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	},

	// Action to check or uncheck a checkbox/radio input
	// E.g. "check field #example"
	// E.g. "uncheck field #example"
	{
		name: 'check-field',
		match: /^(check|uncheck)( field)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			const checked = (matches[1] !== 'uncheck');
			const selector = matches[3];
			try {
				await page.evaluate((targetSelector, isChecked) => {
					const target = document.querySelector(targetSelector);
					if (!target) {
						return Promise.reject(new Error('No element found'));
					}
					target.checked = isChecked;
					target.dispatchEvent(new Event('change', {
						bubbles: true
					}));
					return Promise.resolve();
				}, selector, checked);
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	},

	// Action to screen capture the page to a file
	// E.g. "screen-capture example.png"
	// E.g. "capture screen to example.png"
	{
		name: 'screen-capture',
		match: /^(screen[ -]?capture|capture[ -]?screen)( to)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			await page.screenshot({
				path: matches[3],
				fullPage: true
			});
		}
	},

	// Action which waits for the URL, path, or fragment to change to the given value
	// E.g. "wait for fragment to be #example"
	// E.g. "wait for path to be /example"
	// E.g. "wait for url to be https://example.com/"
	{
		name: 'wait-for-url',
		match: /^wait for (fragment|hash|host|path|url)( to (not )?be)? ([^\s]+)$/i,
		run: async (browser, page, options, matches) => {
			const expectedValue = matches[4];
			const negated = (matches[3] !== undefined);
			const subject = matches[1];

			let property;
			switch (subject) {
				case 'fragment':
				case 'hash':
					property = 'hash';
					break;
				case 'host':
					property = 'host';
					break;
				case 'path':
					property = 'pathname';
					break;
				default:
					property = 'href';
					break;
			}


			function locationHasProperty(locationProperty, value, isNegated) {
				return isNegated ?
					window.location[locationProperty] !== value :
					window.location[locationProperty] === value;
			}

			await page.waitForFunction(
				locationHasProperty,
				{},
				property,
				expectedValue,
				negated
			);
		}
	},

	// Action which waits for an element to be added, removed, visible, or hidden
	// E.g. "wait for element .foo to be added"
	// E.g. "wait for .foo .bar to be visible"
	{
		name: 'wait-for-element-state',
		match: /^wait for( element)? (.+)( to be) (added|removed|visible|hidden)$/i,
		run: async (browser, page, options, matches) => {
			const selector = matches[2];
			const state = matches[4];

			await page.waitForFunction((targetSelector, desiredState) => {
				const targetElement = document.querySelector(targetSelector);

				const statusChecks = {
					isAddedOrRemoved: el =>
						Boolean(
							(desiredState === 'added' && el) ||
							(desiredState === 'removed' && !el)
						),
					isHiddenOrVisible: isVisible =>
						Boolean(
							(desiredState === 'visible' && isVisible) ||
							(desiredState === 'hidden' && !isVisible)
						),
					isTargetVisible: el =>
						Boolean(
							el &&
							(el.offsetWidth ||
							el.offsetHeight ||
							el.getClientRects().length)
						)
				};

				// Check for added/removed states
				if (statusChecks.isAddedOrRemoved(targetElement)) {
					return true;
				}

				// Check element visibility
				const isTargetVisible = statusChecks.isTargetVisible(targetElement);

				// Check for visible/hidden states
				const isInDesiredVisibilityState = statusChecks.isHiddenOrVisible(isTargetVisible);

				return isInDesiredVisibilityState;
			}, {
				polling: 200
			}, selector, state);
		}
	},

	// Action which waits for an element to emit an event
	// E.g. "wait for element .foo to emit example-event"
	// E.g. "wait for .tab-panel to emit load"
	{
		name: 'wait-for-element-event',
		match: /^wait for( element)? (.+) to emit (.+)$/i,
		run: async (browser, page, options, matches) => {
			const selector = matches[2];
			const eventType = matches[3];
			try {
				/* eslint-disable no-underscore-dangle */
				await page.evaluate(
					(targetSelector, desiredEvent) => {
						const target = document.querySelector(targetSelector);
						if (!target) {
							return Promise.reject(
								new Error('No element found')
							);
						}
						target.addEventListener(desiredEvent, () => {
							window._pa11yWaitForElementEventFired = true;
						}, {
							once: true
						});
					},
					selector,
					eventType
				);
				await page.waitForFunction(() => {
					if (window._pa11yWaitForElementEventFired) {
						delete window._pa11yWaitForElementEventFired;
						return true;
					}
					return false;
				}, {
					polling: 200
				});
				/* eslint-enable no-underscore-dangle */
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	}
];
