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

// jshint maxstatements: false
// jscs:disable maximumLineLength
'use strict';

var assert = require('proclaim');
var describeCliCall = require('./helper/describe-cli-call');

describe('Pa11y CLI Reporter (Markdown)', function () {

	describeCliCall('/notices', ['--reporter', 'markdown'], {}, function () {

		it('should respond with an exit code of `0`', function () {
			assert.strictEqual(this.lastExitCode, 0);
		});

		it('should respond with the expected output', function () {
			assert.include(this.lastStdout, '# Welcome to Pa11y\n\n## Results for localhost:3131/notices:\n* __Notice:__ Check that the title element describes the document.\n * WCAG2AA.Principle2.Guideline2_4.2_4_2.H25.2\n * html > head > title\n * `<title>Page Title</title>`\n\n\n## Summary:\n* 0 Errors\n* 0 Warnings\n* 1 Notices\n');
		});

	});

});
