'use strict';

const assert = require('proclaim');
const runPa11yCli = require('../helper/pa11y-cli');

describe('CLI reporter JSON', () => {
	let pa11yResponse;

	describe('when the `--reporter` flag is set to "json"', () => {

		before(async () => {
			pa11yResponse = await runPa11yCli(`${global.mockWebsiteAddress}/errors`, {
				arguments: [
					'--reporter', 'json'
				]
			});
		});

		it('outputs issues in JSON format', () => {
			const json = JSON.parse(pa11yResponse.output);
			assert.isArray(json);
			assert.lengthEquals(json, 1);
		});

	});

	describe('when the `reporter` config is set to "json"', () => {

		before(async () => {
			pa11yResponse = await runPa11yCli(`${global.mockWebsiteAddress}/errors`, {
				arguments: [
					'--config', './mock/config/reporter-json.json'
				]
			});
		});

		it('outputs issues in JSON format', () => {
			const json = JSON.parse(pa11yResponse.output);
			assert.isArray(json);
			assert.lengthEquals(json, 1);
		});

	});

});
