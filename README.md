pa11y
=====

pa11y is your automated accessibility testing pal.  
It runs [HTML CodeSniffer][sniff] from the command line for programmatic accessibility reporting.

**Current Version:** *1.1.0*  
**Node Version Support:** *0.10*


Installing
----------

pa11y requires [Node.js][node] 0.10+ and [PhantomJS][phantom].

On a Mac, you can install these with [Homebrew][brew]:

```sh
$ brew install node
$ brew install phantomjs
```

If you're on Linux, you'll probably be able to work it out.

Windows users approach with caution – we've been able to get pa11y running (Windows 7, Node 0.10) but only after installing Visual Studio and the Windows SDK (as well as Git, Python and PhantomJS).

Once you've got these dependencies, you can install pa11y globally with:

```sh
$ npm install -g pa11y
```


Usage
-----

Once installed, the `pa11y` command should be available to you.

```

  Usage: pa11y [options] <url>

  Options:

    -h, --help             output usage information
    -V, --version          output the version number
    -r, --reporter <name>  specify a reporter to use, one of: console (default), csv, json
    -s, --standard <name>  specify a standard to use, one of: Section508, WCAG2A, WCAG2AA (default), WCAG2AAA
    -c, --htmlcs <url>     specify a URL to source HTML_CodeSniffer from. Default: squizlabs.github.io
    -C, --config <file>    specify a JSON config file for ignoring rules
    -t, --timeout <ms>     specify the number of milliseconds before a timeout error occurs. Default: 30000
    -d, --debug            output debug messages

```

Example:

```sh
# Run pa11y with console reporting
$ pa11y nature.com

# Run pa11y with CSV reporting and save to file
$ pa11y -r csv nature.com > report.csv

# Run pa11y with the WCAG2AAA ruleset
$ pa11y -s WCAG2AAA nature.com
```

Configuration
-------------

pa11y can be configured via a JSON file, which allows you to specify rules that should be ignored in the report. To specify a JSON configuration file, use the `--config` command line flag:

```sh
$ pa11y --config ./config/pa11y.json nature.com
```

The config file should be formatted like this, where each of the items in the `ignore` array is the identifier of a rule you'd like to ignore:

```json
{
	"ignore": [
		"WCAG2AA.Principle2.Guideline2_4.2_4_2.H25.2",
		"WCAG2AA.Principle3.Guideline3_1.3_1_1.H57.2"
	]
}
```

You can find the codes for each rule in the console output, so you can simply copy/paste these into your config file.


Caveats
-------

pa11y can't catch *all* accessibility errors. It'll catch many of them, but you should do manual checking as well.

Also, due to HTML CodeSniffer being a graphical tool which highlights elements in the DOM, pa11y is most useful to use as a rough benchmark of how many errors/warnings your site has. The messages themselves don't hold much value outside of the browser yet. We're working on this, and if you have any suggestions then we'd be happy to chat!


Custom Reporters
----------------

Writing your own reporter for pa11y is easy, and will allow you to customise the output. This can be useful for integrating with your CI, producing human-readable reports, graphing, etc.

When a reporter is specified, the program will look for node modules with the name `pa11y-reporter-<name>`. So if you use the following option:

```sh
$ pa11y -r rainbows nature.com
```

then pa11y will attempt to load the module [`pa11y-reporter-rainbows`][rainbows].

Reporter modules export the following functions, which will be used by pa11y when that reporter is selected. All functions are optional, but you'll need to implement at least `error` and `handleResult` for the reporter to be functional.

```js
exports.begin()                // Called before processing, used to output welcome messages or similar
exports.log(str)               // Called with logging information
exports.debug(str)             // Called with debug information if pa11y is run with the `-d` debug flag
exports.error(str)             // Called with error information
exports.handleResult(results)  // Called when results are available
exports.end()                  // Called once everything is done, just before the process exits
```

For example reporters, take a look at the [built-in reporters](lib/reporters) or the [rainbows reporter][rainbows].


Development
-----------

To develop pa11y, you'll need to clone the repo and install dependencies with `make deps`. If you're on Windows, you'll also need to install [Make for Windows][make].

Once you're set up, you can run the following commands:

```sh
$ make deps  # Install dependencies
$ make lint  # Run JSHint with the correct config
$ make test  # Run tests
```

When no build target is specified, make will run `deps lint test`. This means you can use the following command for brevity:

```sh
$ make
```

Code with lint errors or failing tests will not be accepted, please use the build tools outlined above.

For users with push-access, don't commit to the master branch. Code should be in `develop` until it's ready to be released.


License
-------

[Copyright 2013 Nature Publishing Group](LICENSE.txt).  
pa11y is licensed under the [GNU General Public License 3.0][gpl].



[brew]: http://mxcl.github.com/homebrew/
[make]: http://gnuwin32.sourceforge.net/packages/make.htm
[gpl]: http://www.gnu.org/licenses/gpl-3.0.html
[node]: http://nodejs.org/
[phantom]: http://phantomjs.org/
[rainbows]: https://github.com/rowanmanning/pa11y-reporter-rainbows
[sniff]: http://squizlabs.github.com/HTML_CodeSniffer/
