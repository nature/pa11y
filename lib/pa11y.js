// This file is part of pa11y.
//
// pa11y is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// pa11y is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with pa11y.  If not, see <http://www.gnu.org/licenses/>.

'use strict';

var once = require('once');
var async = require('async');
var extend = require('node.extend');
var lowercase = require('lower-case');
var pkg = require('../package.json');
var truffler = require('truffler');
var trufflerPkg = require('truffler/package.json');

module.exports = pa11y;
module.exports.defaults = {
	htmlcs: __dirname + '/vendor/HTMLCS.js',
	ignore: [],
	log: {
		begin: /* istanbul ignore next */ function() {},
		debug: /* istanbul ignore next */ function() {},
		error: /* istanbul ignore next */ function() {},
		info: /* istanbul ignore next */ function() {},
		results: /* istanbul ignore next */ function() {}
	},
	page: {
		settings: {
			userAgent: 'pa11y/' + pkg.version + ' (truffler/' + trufflerPkg.version + ')'
		}
	},
	phantom: {
		onStdout: /* istanbul ignore next */ function() {},
		parameters: {
			'ignore-ssl-errors': 'true',
			'ssl-protocol': 'tlsv1'
		}
	},
	standard: 'WCAG2AA',
	wait: 0,
	injectJs: null
};

function pa11y(options) {
	options = defaultOptions(options);
	if (['Section508', 'WCAG2A', 'WCAG2AA', 'WCAG2AAA'].indexOf(options.standard) === -1) {
		throw new Error('Standard must be one of Section508, WCAG2A, WCAG2AA, WCAG2AAA');
	}

	return truffler(options, testPage.bind(null, options));
}

function defaultOptions(options) {
	options = extend(true, {}, module.exports.defaults, options);
	options.ignore = options.ignore.map(lowercase);
	return options;
}

function testPage(options, browser, page, done) {

	page.onCallback = once(function(result) {
		if (result instanceof Error) {
			return done(result);
		}
		if (result.error) {
			return done(new Error(result.error));
		}

		done(null, result.messages);
	});

	async.waterfall([
		function(next) {
			if (options.injectJs) {
				options.log.debug('Injecting supplied JavaScript');
				page.injectJs(options.injectJs, function(error, injected) {
					if (error) {
						return next(error);
					}
					if (!injected) {
						return next(new Error('Pa11y was unable to inject supplied scripts into the page'));
					}

				});

				page.onConsoleMessage = function(msg) {
					msg = msg.toLowerCase().replace(/ /g, '');
					if (msg === 'pa11y:scriptcomplete') {
						options.log.debug('Supplied JavaScript finished running');
						next();
					}
				};
			} else {
				next();
			}
		},
		// Inject HTML CodeSniffer
		function(next) {
			options.log.debug('Injecting HTML CodeSniffer');
			if (/^(https?|file):\/\//.test(options.htmlcs)) {
				// Include remote URL
				page.includeJs(options.htmlcs, function(error, included) {
					if (error) {
						return next(error);
					}
					if (!included) {
						return next(new Error('Pa11y was unable to include scripts in the page'));
					}
					next();
				});
			} else {
				// Inject local file
				page.injectJs(options.htmlcs, function(error, injected) {
					if (error) {
						return next(error);
					}
					if (!injected) {
						return next(new Error('Pa11y was unable to inject scripts into the page'));
					}
					next();
				});
			}
		},

		// Inject Pa11y
		function(next) {
			options.log.debug('Injecting Pa11y');
			page.injectJs(__dirname + '/inject.js', function(error, injected) {
				if (error) {
					return next(error);
				}
				if (!injected) {
					return next(new Error('Pa11y was unable to inject scripts into the page'));
				}
				next();
			});
		},

		// Run Pa11y on the page
		function(next) {
			options.log.debug('Running Pa11y on the page');
			if (options.wait > 0) {
				options.log.debug('Waiting for ' + options.wait + 'ms');
			}
			page.evaluate(function(options) {
				/* global injectPa11y: true, window: true */
				if (typeof window.callPhantom !== 'function') {
					return {
						error: 'Pa11y could not report back to PhantomJS'
					};
				}
				injectPa11y(window, options, window.callPhantom);
			}, {
				ignore: options.ignore,
				standard: options.standard,
				wait: options.wait
			}, next);
		}

	], function(error, result) {
		// catch any errors which occur in the injection process
		if (error) {
			page.onCallback(error);
		}
		if (result && result.error) {
			page.onCallback(result);
		}
	});
}
