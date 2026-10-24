// Karma configuration for the helpdesk frontend. Defines a
// ChromeHeadlessNoSandbox launcher so the dev environment
// (root user / macOS sandbox restrictions) can run the tests
// without a GUI browser window.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/frontend'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeHeadlessDesktop'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--headless=new',
          // A desktop-width viewport. ChromeHeadless otherwise
          // starts at ~741px, which is narrow enough to trip the
          // app's own responsive breakpoints — so a layout spec
          // asserting the DESKTOP arrangement would silently be
          // measuring the mobile one. Pinning the window size
          // makes the viewport deterministic across machines.
          '--window-size=1440,900',
        ],
      },
      // The same desktop viewport, but under the conventional name
      // so `--browsers=ChromeHeadless` and `npm test` both get it.
      ChromeHeadlessDesktop: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--headless=new',
          '--window-size=1440,900',
        ],
      },
    },
    singleRun: false,
    restartOnFileChange: true,
  });
};
