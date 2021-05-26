
Pa11y
=====

Pa11y is your automated accessibility testing pal. It runs accessibility tests on your pages via the command line or Node.js, so you can automate your testing process.

[![NPM version][shield-npm]][info-npm]
[![Node.js version support][shield-node]][info-node]
[![Build status][shield-build]][info-build]
[![LGPL-3.0-only licensed][shield-license]][info-license]

On the command line:

```sh
pa11y http://example.com/
```

In JavaScript:

```js
const pa11y = require('pa11y');

pa11y('http://example.com/').then((results) => {
    // Do something with the results
});
```

If you need a GUI, you can try [Koa11y](https://open-indy.github.io/Koa11y/). It's a desktop application for Windows, OSX and Linux that uses Pa11y to run accessibility tests.

Table Of Contents
-----------------

- [Requirements](#requirements)
- [Command-Line Interface](#command-line-interface)
- [JavaScript Interface](#javascript-interface)
- [Configuration](#configuration)
- [Actions](#actions)
- [Runners](#runners)
- [Examples](#examples)
- [Common Questions and Troubleshooting](#common-questions-and-troubleshooting)
- [Tutorials and articles](#tutorials-and-articles)
- [Contributing](#contributing)
- [Support and Migration](#support-and-migration)
- [License](#license)


Requirements
------------

Pa11y requires [Node.js][node] 8+ to run. If you need support for older versions of Node.js, then please use [Pa11y 4.x][4.x].

### OS X

To install [Node.js][node] you can use [nvm][nvm]:
```sh
$ nvm install node
```

Alternatively on a Mac, you can install the required dependency with [Homebrew][brew]:

```sh
$ brew install node
```

You can also download pre-built packages from the [Node.js][node] website.

### Linux

Depending on your flavour of Linux, you should be able to use a package manager to install the required dependency. Alternatively download pre-built packages from the [Node.js][node] website.

### Windows

On Windows 10, download a pre-built package from the [Node.js][node] website. Pa11y will be usable via the bundled Node.js application as well as the Windows command prompt.

Windows 7 and below users approach with caution – we've been able to get Pa11y running but only after installing Visual Studio and the Windows SDK (as well as Git, and Python). The [Windows installation instructions for node-gyp][windows-install] are a good place to start. If you have had a better experience than this then please do share!


Command-Line Interface
----------------------

Install Pa11y globally with [npm][npm]:

```
npm install -g pa11y
```

This installs the `pa11y` command-line tool:

```
Usage: pa11y [options] <url>

  Options:

    -V, --version                  output the version number
    -n, --environment              output details about the environment Pa11y will run in
    -s, --standard <name>          the accessibility standard to use: WCAG2A, WCAG2AA (default), WCAG2AAA – only used by htmlcs runner
    -r, --reporter <reporter>      the reporter to use: cli (default), csv, json
    -e, --runner <runner>          the test runners to use: htmlcs (default), axe
    -l, --level <level>            the level of issue to fail on (exit with code 2): error, warning, notice
    -T, --threshold <number>       permit this number of errors, warnings, or notices, otherwise fail with exit code 2
    -i, --ignore <ignore>          types and codes of issues to ignore, a repeatable value or separated by semi-colons
    --include-notices              Include notices in the report
    --include-warnings             Include warnings in the report
    -R, --root-element <selector>  a CSS selector used to limit which part of a page is tested
    -E, --hide-elements <hide>     a CSS selector to hide elements from testing, selectors can be comma separated
    -c, --config <path>            a JSON or JavaScript config file
    -t, --timeout <ms>             the timeout in milliseconds
    -w, --wait <ms>                the time to wait before running tests in milliseconds
    -d, --debug                    output debug messages
    -S, --screen-capture <path>    a path to save a screen capture of the page to
    -A, --add-rule <rule>          WCAG 2.0 rules to include, a repeatable value or separated by semi-colons – only used by htmlcs runner
    -h, --help                     output usage information
```

### Running Tests

Run an accessibility test against a URL:

```
pa11y http://example.com
```

Run an accessibility test against a file (absolute paths only, not relative):

```
pa11y ./path/to/your/file.html
```

Run a test with CSV reporting and save to a file:

```
pa11y --reporter csv http://example.com > report.csv
```

Run Pa11y using [aXe] as a [test runner](#runners):

```
pa11y --runner axe http://example.com
```

Run Pa11y using [aXe] _and_ [HTML CodeSniffer][htmlcs] as [test runners](#runners):

```
pa11y --runner axe --runner htmlcs http://example.com
```

### Exit Codes

The command-line tool uses the following exit codes:

  - `0`: Pa11y ran successfully, and there are no errors
  - `1`: Pa11y failed run due to a technical fault
  - `2`: Pa11y ran successfully but there are errors in the page

By default, only accessibility issues with a type of `error` will exit with a code of `2`. This is configurable with the `--level` flag which can be set to one of the following:

  - `error`: exit with a code of `2` on errors only, exit with a code of `0` on warnings and notices
  - `warning`: exit with a code of `2` on errors and warnings, exit with a code of `0` on notices
  - `notice`: exit with a code of `2` on errors, warnings, and notices
  - `none`: always exit with a code of `0`

### Command-Line Configuration

The command-line tool can be configured with a JSON file as well as arguments. By default it will look for a `pa11y.json` file in the current directory, but you can change this with the `--config` flag:

```
pa11y --config ./path/to/config.json http://example.com
```

If any configuration is set both in a configuration file and also as a command-line option, the value set in the latter will take priority.

For more information on configuring Pa11y, see the [configuration documentation](#configuration).

### Ignoring

The ignore flag can be used in several different ways. Separated by semi-colons:

```
pa11y --ignore "issue-code-1;issue-code-2" http://example.com
```

or by using the flag multiple times:

```
pa11y --ignore issue-code-1 --ignore issue-code-2 http://example.com
```

Pa11y can also ignore notices, warnings, and errors up to a threshold number. This might be useful if you're using CI and don't want to break your build. The following example will return exit code 0 on a page with 9 errors, and return exit code 2 on a page with 10 or more errors.

```
pa11y --threshold 10 http://example.com
```

### Reporters

The command-line tool can report test results in a few different ways using the `--reporter` flag. The built-in reporters are:

  - `cli`: output test results in a human-readable format
  - `csv`: output test results as comma-separated values
  - `json`: output test results as a JSON array

The Pa11y team maintain some additional reporters which can be installed separately via `npm`:

  - [`html`](https://github.com/pa11y/pa11y-reporter-html): output test results in a self-contained HTML format (`npm install pa11y-reporter-html`)
  - [`tsv`](https://github.com/pa11y/pa11y-reporter-tsv): output test results as tab-separated values (`npm install pa11y-reporter-tsv`)

You can also write and publish your own reporters. Pa11y looks for reporters in your `node_modules` folder (with a naming pattern), and the current working directory. The first reporter found will be loaded. So with this command:

```sh
pa11y --reporter rainbows http://example.com
```

The following locations will be checked:

```
<cwd>/node_modules/pa11y-reporter-rainbows
<cwd>/rainbows
```

A Pa11y reporter _must_ export a property named `supports`. This is a [semver range] (as a string) which indicates which versions of Pa11y the reporter supports:

```js
exports.supports = '^5.0.0';
```

A reporter should export the following methods, which should all return strings. If your reporter needs to perform asynchronous operations, then it may return a promise which resolves to a string:

```js
begin(); // Called when pa11y starts
error(message); // Called when a technical error is reported
debug(message); // Called when a debug message is reported
info(message); // Called when an information message is reported
results(results); // Called with the results of a test run
```


JavaScript Interface
--------------------

Install Pa11y with [npm][npm] or add to your `package.json`:

```sh
npm install pa11y
```

Require Pa11y:

```js
const pa11y = require('pa11y');
```

Run Pa11y against a URL, the `pa11y` function returns a [Promise]:

```js
pa11y('http://example.com/').then((results) => {
    // Do something with the results
});
```

Pa11y can also be run with [some options](#configuration):

```js
pa11y('http://example.com/', {
    // Options go here
}).then((results) => {
    // Do something with the results
});
```

Pa11y resolves with a `results` object, containing details about the page and accessibility issues from HTML CodeSniffer. It looks like this:

```js
{
    documentTitle: 'The title of the page that was tested',
    pageUrl: 'The URL that Pa11y was run against',
    issues: [
        {
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H30.2',
            context: '<a href="http://example.com/"><img src="example.jpg" alt=""/></a>',
            message: 'Img element is the only content of the link, but is missing alt text. The alt text should describe the purpose of the link.',
            selector: 'html > body > p:nth-child(1) > a',
            type: 'error',
            typeCode: 1
        }
        // more issues appear here
    ]
}
```

### Transforming the Results

If you wish to transform these results with the command-line reporters, then you can do so in your code by requiring them in. The `csv`, `tsv`, `html`, `json`, and `markdown` reporters all expose a `process` method:

```js
// Assuming you've already run tests, and the results
// are available in a `results` variable:
const htmlReporter = require('pa11y/reporter/html');
const html = await htmlReporter.results(results, url);
```

### Async/Await

Because Pa11y is promise based, you can use `async` functions and the `await` keyword:

```js
async function runPa11y() {
    try {
        const results = await pa11y('http://example.com/');
        // Do something with the results
    } catch (error) {
        // Handle the error
    }
}

runPa11y();
```

### Callback Interface

If you would rather use callbacks than promises or `async`/`await`, then Pa11y supports this. This interface should be considered legacy, however, and may not appear in the next major version of Pa11y:

```js
pa11y('http://example.com/', (error, results) => {
    // Do something with the results or handle the error
});
```

### Validating Actions

Pa11y exposes a function which allows you to validate [action](#actions) strings before attempting to use them.

This function accepts an action string and returns a boolean indicating whether it matches one of the actions that Pa11y supports:

```js
pa11y.isValidAction('click element #submit');  // true
pa11y.isValidAction('open the pod bay doors'); // false
```


Configuration
-------------

Pa11y has lots of options you can use to change the way Headless Chrome runs, or the way your page is loaded. Options can be set either as a parameter on the `pa11y` function or in a [JSON configuration file](#command-line-configuration). Some are also available directly as [command-line options](#command-line-interface).

Below is a reference of all the options that are available:

### `actions` (array) **BETA**

Actions to be run before Pa11y tests the page. There are quite a few different actions available in Pa11y, the [Actions documentation](#actions) outlines each of them.

**Note:** actions are currently in a beta state and the API may change while we gather feedback.

```js
pa11y('http://example.com/', {
    actions: [
        'set field #username to exampleUser',
        'set field #password to password1234',
        'click element #submit',
        'wait for path to be /myaccount'
    ]
});
```

Defaults to an empty array.

### `browser` (Browser) and `page` (Page)

A [Puppeteer Browser instance][puppeteer-browser] which will be used in the test run. Optionally you may also supply a [Puppeteer Page instance][puppeteer-page], but this cannot be used between test runs as event listeners would be bound multiple times.

If either of these options are provided then there are several things you need to consider:

  1. Pa11y's `chromeLaunchConfig` option will be ignored, you'll need to pass this configuration in when you create your Browser instance
  2. Pa11y will not automatically close the Browser when the tests have finished running, you will need to do this yourself if you need the Node.js process to exit
  3. It's important that you use a version of Puppeteer that meets the range specified in Pa11y's `package.json`
  4. You _cannot_ reuse page instances between multiple test runs, doing so will result in an error. The page option allows you to do things like take screen-shots on a Pa11y failure or execute your own JavaScript before Pa11y

**Note:** This is an advanced option. If you're using this, please mention in any issues you open on Pa11y and double-check that the Puppeteer version you're using matches Pa11y's.

```js
const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true
});

pa11y('http://example.com/', {
    browser: browser
});

browser.close();
```

A more complete example can be found in the [puppeteer examples](#puppeteer-example).

Defaults to `null`.

### `chromeLaunchConfig` (object)

Launch options for the Headless Chrome instance. [See the Puppeteer documentation for more information][puppeteer-launch].

```js
pa11y('http://example.com/', {
    chromeLaunchConfig: {
        executablePath: '/path/to/Chrome',
        ignoreHTTPSErrors: false
    }
});
```

Defaults to:

```js
{
    ignoreHTTPSErrors: true
}
```

### `headers` (object)

A key-value map of request headers to send when testing a web page.

```js
pa11y('http://example.com/', {
    headers: {
        Cookie: 'foo=bar'
    }
});
```

Defaults to an empty object.

### `hideElements` (string)

A CSS selector to hide elements from testing, selectors can be comma separated. Elements matching this selector will be hidden from testing by styling them with `visibility: hidden`.

```js
pa11y('http://example.com/', {
    hideElements: '.advert, #modal, div[aria-role=presentation]'
});
```

### `ignore` (array)

An array of result codes and types that you'd like to ignore. You can find the codes for each rule in the console output and the types are `error`, `warning`, and `notice`. Note: `warning` and `notice` messages are ignored by default.

```js
pa11y('http://example.com/', {
    ignore: [
        'WCAG2AA.Principle3.Guideline3_1.3_1_1.H57.2'
    ]
});
```

Defaults to an empty array.

### `ignoreUrl` (boolean)

Whether to use the provided [Puppeteer Page instance][puppeteer-page] as is or use the provided url. Both the [Puppeteer Page instance][puppeteer-page] and the [Puppeteer Browser instance][puppeteer-browser] are required alongside `ignoreUrl`.

```js
const browser = await puppeteer.launch();
const page = await browser.newPage();

pa11y('http://example.com/', {
    ignoreUrl: true,
    page: page,
    browser: browser
});
```

Defaults to `false`.

### `includeNotices` (boolean)

Whether to include results with a type of `notice` in the Pa11y report. Issues with a type of `notice` are not directly actionable and so they are excluded by default. You can include them by using this option:

```js
pa11y('http://example.com/', {
    includeNotices: true
});
```

Defaults to `false`.

### `includeWarnings` (boolean)

Whether to include results with a type of `warning` in the Pa11y report. Issues with a type of `warning` are not directly actionable and so they are excluded by default. You can include them by using this option:

```js
pa11y('http://example.com/', {
    includeWarnings: true
});
```

Defaults to `false`.

### `level` (string)

The level of issue which can fail the test (and cause it to exit with code 2) when running via the CLI. This should be one of `error` (the default), `warning`, or `notice`.

```json
{
    "level": "warning"
}
```

Defaults to `error`. Note this configuration is only available when using Pa11y on the command line, not via the JavaScript Interface.

### `log` (object)

An object which implements the methods `debug`, `error`, and `info` which will be used to report errors and test information.

```js
pa11y('http://example.com/', {
    log: {
        debug: console.log,
        error: console.error,
        info: console.info
    }
});
```

Each of these defaults to an empty function.

### `method` (string)

The HTTP method to use when running Pa11y.

```js
pa11y('http://example.com/', {
    method: 'POST'
});
```

Defaults to `GET`.

### `postData` (string)

The HTTP POST data to send when running Pa11y. This should be combined with a `Content-Type` header. E.g to send form data:

```js
pa11y('http://example.com/', {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'POST',
    postData: 'foo=bar&bar=baz'
});
```

Or to send JSON data:

```js
pa11y('http://example.com/', {
    headers: {
        'Content-Type': 'application/json'
    },
    method: 'POST',
    postData: '{"foo": "bar", "bar": "baz"}'
});
```

Defaults to `null`.

### `reporter` (string)

The reporter to use while running the test via the CLI. [More about reporters](#reporters).

```json
{
    "reporter": "json"
}
```

Defaults to `cli`. Note this configuration is only available when using Pa11y on the command line, not via the JavaScript Interface.

### `rootElement` (element)

The root element for testing a subset of the page opposed to the full document.

```js
pa11y('http://example.com/', {
    rootElement: '#main'
});
```
Defaults to `null`, meaning the full document will be tested. If the specified root element isn't found, the full document will be tested.

### `runners` (array)

An array of runner names which correspond to existing and installed [Pa11y runners](#runners). If a runner is not found then Pa11y will error.

```js
pa11y('http://example.com/', {
    runners: [
        'axe',
        'htmlcs'
    ]
});
```

Defaults to:

```js
[
    'htmlcs'
]
```

### `rules` (array)

An array of WCAG 2.0 guidelines that you'd like to include to the current standard. You can find the codes for each guideline in the [HTML Code Sniffer WCAG2AAA ruleset][htmlcs-wcag2aaa-ruleset]. **Note:** only used by htmlcs runner.

```js
pa11y('http://example.com/', {
    rules: [
        'Principle1.Guideline1_3.1_3_1_AAA'
    ]
});
```

### `screenCapture` (string)

A file path to save a screen capture of the tested page to. The screen will be captured immediately after the Pa11y tests have run so that you can verify that the expected page was tested.

```js
pa11y('http://example.com/', {
    screenCapture: `${__dirname}/my-screen-capture.png`
});
```

Defaults to `null`, meaning the screen will not be captured. Note the directory part of this path must be an existing directory in the file system – Pa11y will not create this for you.

### `standard` (string)

The accessibility standard to use when testing pages. This should be one of `WCAG2A`, `WCAG2AA`, or `WCAG2AAA`. **Note:** only used by htmlcs runner.

```js
pa11y('http://example.com/', {
    standard: 'WCAG2A'
});
```

Defaults to `WCAG2AA`.

### `threshold` (number)

The number of errors, warnings, or notices to permit before the test is considered to have failed (with exit code 2) when running via the CLI.

```json
{
    "threshold": 9
}
```

Defaults to `0`. Note this configuration is only available when using Pa11y on the command line, not via the JavaScript Interface.

### `timeout` (number)

The time in milliseconds that a test should be allowed to run before calling back with a timeout error.

Please note that this is the timeout for the _entire_ test run (including time to initialise Chrome, load the page, and run the tests).

```js
pa11y('http://example.com/', {
    timeout: 500
});
```

Defaults to `30000`.

### `userAgent` (string)

The `User-Agent` header to send with Pa11y requests. This is helpful to identify Pa11y in your logs.

```js
pa11y('http://example.com/', {
    userAgent: 'A11Y TESTS'
});
```

Defaults to `pa11y/<version>`.

### `viewport` (object)

The viewport configuration. This can have any of the properties supported by the [puppeteer `setViewport` method][puppeteer-viewport].

```js
pa11y('http://example.com/', {
    viewport: {
        width: 320,
        height: 480,
        deviceScaleFactor: 2,
        isMobile: true
    }
});
```

Defaults to:

```js
{
    width: 1280,
    height: 1024
}
```

### `wait` (number)

The time in milliseconds to wait before running HTML CodeSniffer on the page.

```js
pa11y('http://example.com/', {
    wait: 500
});
```

Defaults to `0`.


Actions
-------

Actions are additional interactions that you can make Pa11y perform before the tests are run. They allow you to do things like click on a button, enter a value in a form, wait for a redirect, or wait for the URL fragment to change:

```js
pa11y('http://example.com/', {
    actions: [
        'click element #tab-1',
        'wait for element #tab-1-content to be visible',
        'set field #fullname to John Doe',
        'check field #terms-and-conditions',
        'uncheck field #subscribe-to-marketing',
        'screen capture example.png',
        'wait for fragment to be #page-2',
        'wait for path to not be /login',
        'wait for url to be https://example.com/',
        'wait for #my-image to emit load',
        'navigate to https://another-example.com/'
    ]
});
```

Below is a reference of all the available actions and what they do on the page. Some of these take time to complete so you may need to increase the `timeout` option if you have a large set of actions.

### Click Element

This allows you to click an element by passing in a CSS selector. This action takes the form `click element <selector>`. E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'click element #tab-1'
    ]
});
```
You can use any valid [query selector](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector), including classes and types.

### Set Field Value

This allows you to set the value of a text-based input or select box by passing in a CSS selector and value. This action takes the form `set field <selector> to <value>`. E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'set field #fullname to John Doe'
    ]
});
```

### Check/Uncheck Field

This allows you to check or uncheck checkbox and radio inputs by passing in a CSS selector. This action takes the form `check field <selector>` or `uncheck field <selector>`. E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'check field #terms-and-conditions',
        'uncheck field #subscribe-to-marketing'
    ]
});
```

### Screen Capture

This allows you to capture the screen between other actions, useful to verify that the page looks as you expect before the Pa11y test runs. This action takes the form `screen capture <file-path>`. E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'screen capture example.png'
    ]
});
```

### Wait For Fragment/Path/URL

This allows you to pause the test until a condition is met, and the page has either a given fragment, path, or URL. This will wait until Pa11y times out so it should be used after another action that would trigger the change in state. You can also wait until the page does **not** have a given fragment, path, or URL using the `to not be` syntax. This action takes one of the forms:

  - `wait for fragment to be <fragment>` (including the preceding `#`)
  - `wait for fragment to not be <fragment>` (including the preceding `#`)
  - `wait for path to be <path>` (including the preceding `/`)
  - `wait for path to not be <path>` (including the preceding `/`)
  - `wait for url to be <url>`
  - `wait for url to not be <url>`

E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'click element #login-link',
        'wait for path to be /login'
    ]
});
```

### Wait For Element State

This allows you to pause the test until an element on the page (matching a CSS selector) is either added, removed, visible, or hidden. This will wait until Pa11y times out so it should be used after another action that would trigger the change in state. This action takes one of the forms:

  - `wait for element <selector> to be added`
  - `wait for element <selector> to be removed`
  - `wait for element <selector> to be visible`
  - `wait for element <selector> to be hidden`

E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'click element #tab-2',
        'wait for element #tab-1 to be hidden'
    ]
});
```

### Wait For Element Event

This allows you to pause the test until an element on the page (matching a CSS selector) emits an event. This will wait until Pa11y times out so it should be used after another action that would trigger the event. This action takes the form `wait for element <selector> to emit <event-type>`. E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'click element #tab-2',
        'wait for element #tab-panel-to to emit content-loaded'
    ]
});
```

### Navigate To URL

This action allows you to navigate to a new URL if, for example, the URL is inaccessible using other methods. This action takes the form `navigate to <url>`. E.g.

```js
pa11y('http://example.com/', {
    actions: [
        'navigate to http://another-example.com'
    ]
});
```


Runners
-------

Pa11y supports multiple test runners which return different results. The built-in test runners are:

  - `axe`: run tests using [aXe-core][axe].
  - `htmlcs` (default): run tests using [HTML CodeSniffer][htmlcs]

You can also write and publish your own runners. Pa11y looks for runners in your `node_modules` folder (with a naming pattern), and the current working directory. The first runner found will be loaded. So with this command:

```
pa11y --runner my-testing-tool http://example.com
```

The following locations will be checked:

```
<cwd>/node_modules/pa11y-runner-my-testing-tool
<cwd>/node_modules/my-testing-tool
<cwd>/my-testing-tool
```

A Pa11y runner _must_ export a property named `supports`. This is a [semver range] (as a string) which indicates which versions of Pa11y the runner supports:

```js
exports.supports = '^5.0.0';
```

A Pa11y runner _must_ export a property named `scripts`. This is an array of strings which are paths to scripts which need to load before the tests can be run. This may be empty:

```js
exports.scripts = [
    `${__dirname}/vendor/example.js`
];
```

A runner _must_ export a `run` method, which returns a promise that resolves with test results (it's advisable to use an `async` function). The `run` method is evaluated in a browser context and so has access to a global `window` object.

The `run` method _must not_ use anything that's been imported using `require`, as it's run in a browser context. Doing so will error.

The `run` method is called with two arguments:

  - `options`: Options specified in the test runner
  - `pa11y`: The Pa11y test runner, which includes some helper methods:
    - `pa11y.getElementContext(element)`: Get a short HTML context snippet for an element
    - `pa11y.getElementSelector(element)`: Get a unique selector with which you can select this element in a page

The `run` method _must_ resolve with an array of Pa11y issues. These follow the format:

```js
{
    code: '123', // An ID or code which identifies this error
    element: {}, // The HTML element this issue relates to, or null if no element is found
    message: 'example', // A descriptive message outlining the issue
    type: 'error', // A type of "error", "warning", or "notice"
    runnerExtras: {} // Additional data that your runner can provide, but isn't used by Pa11y
}
```


Examples
--------

### Basic Example

Run Pa11y on a URL and output the results. [See the example](example/basic/index.js).

### Multiple Example

Run Pa11y on multiple URLs at once and output the results. [See the example](example/multiple/index.js).

### Actions Example

Step through some actions before Pa11y runs. This example logs into a fictional site then waits until the account page has loaded before running Pa11y. [See the example](example/actions/index.js).

### Puppeteer Example

Pass in pre-created Puppeteer browser and page instances so that you can reuse them between tests. [See the example](example/puppeteer/index.js).


Common Questions and Troubleshooting
------------------------------------

See our [Troubleshooting guide](TROUBLESHOOTING.md) to get the answers to common questions about Pa11y, along with some ideas to help you troubleshoot any problems.


Tutorials and articles
------------------------------------

Here are some useful articles written by Pa11y users and contributors:

- [Accessibility Testing with Pa11y](https://bitsofco.de/pa11y/)
- [Using actions in Pa11y](http://hollsk.co.uk/posts/view/using-actions-in-pa11y)
- [Introduction to Accessibility Testing With Pa11y](http://cruft.io/posts/accessibility-testing-with-pa11y/)


Contributing
------------

There are many ways to contribute to Pa11y, we cover these in the [contributing guide](CONTRIBUTING.md) for this repo.

If you're ready to contribute some code, clone this repo locally and commit your code on a new branch.

Please write unit tests for your code, and check that everything works by running the following before opening a <abbr title="pull request">PR</abbr>:

```sh
npm run lint
npm test
```

You can also run verifications and tests individually:

```sh
npm run lint                # Verify all of the code (ESLint)
npm test                    # Run all tests
npm run test-unit           # Run the unit tests
npm run coverage            # Run the unit tests with coverage
npm run test-integration    # Run the integration tests
```

To debug a test file you need to ensure that [setup.test.js](test/integration/setup.test.js) is ran before the test file. This adds a `before/each` to start and stop the integration test server.

Support and Migration
---------------------

Pa11y major versions are normally supported for 6 months after their last minor release. This means that patch-level changes will be added and bugs will be fixed. The table below outlines the end-of-support dates for major versions, and the last minor release for that version.

We also maintain a [migration guide](MIGRATION.md) to help you migrate.

| :grey_question: | Major Version | Last Minor Release | Node.js Versions | Support End Date |
| :-------------- | :------------ | :----------------- | :--------------- | :--------------- |
| :heart:         | 5             | N/A                | 8+               | N/A              |
| :skull:         | 4             | 4.13               | 4–8              | 2018-08-15       |
| :skull:         | 3             | 3.8                | 0.12–6           | 2016-12-05       |
| :skull:         | 2             | 2.4                | 0.10–0.12        | 2016-10-16       |
| :skull:         | 1             | 1.7                | 0.10             | 2016-06-08       |

If you're opening issues related to these, please mention the version that the issue relates to.

License
-------

Pa11y is licensed under the [Lesser General Public License (LGPL-3.0-only)][info-license].<br/>
Copyright &copy; 2013–2019, Team Pa11y and contributors

[1.0-json-reporter]: https://github.com/pa11y/reporter-1.0-json
[4.x]: https://github.com/pa11y/pa11y/tree/4.x
[async]: https://github.com/caolan/async
[axe]: https://www.axe-core.org/
[brew]: http://mxcl.github.com/homebrew/
[htmlcs-wcag2aaa-ruleset]: https://github.com/pa11y/pa11y/wiki/HTML-CodeSniffer-Rules
[node]: http://nodejs.org/
[npm]: https://www.npmjs.com/
[nvm]: https://github.com/nvm-sh/nvm
[promise]: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise
[puppeteer-browser]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser
[puppeteer-launch]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
[puppeteer-page]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-page
[puppeteer-viewport]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetviewportviewport
[semver range]: https://github.com/npm/node-semver#ranges
[sidekick-proposal]: https://github.com/pa11y/sidekick/blob/master/PROPOSAL.md
[htmlcs]: https://squizlabs.github.io/HTML_CodeSniffer/
[windows-install]: https://github.com/TooTallNate/node-gyp#installation

[info-license]: LICENSE
[info-node]: package.json
[info-npm]: https://www.npmjs.com/package/pa11y
[info-build]: https://travis-ci.org/pa11y/pa11y
[shield-license]: https://img.shields.io/badge/license-LGPL--3.0--only-blue.svg
[shield-node]: https://img.shields.io/node/v/pa11y.svg
[shield-npm]: https://img.shields.io/npm/v/pa11y.svg
[shield-build]: https://img.shields.io/travis/pa11y/pa11y/master.svg
