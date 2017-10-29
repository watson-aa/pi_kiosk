const puppeteer = require('puppeteer'),
	config = require('config'),
	sleep = require('system-sleep');

async function run() {
  config.get('screenshots').forEach((screenshot, x) => {
		downloadScreenshot(x, screenshot);
  });
}

function errorHandle(msg, browser) {
	console.log(msg);
	if (browser) {
		browser.close();
	}
	return false;
}

async function downloadScreenshot(index, config) {
  var browser = false;
  if (config.closeBrowser == true || !config.browser) {
		browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
											.catch(function() {
												return errorHandle('launch error: ' + config.url, browser);
											});
  } else {
		browser = config.browser;
  }

  if (browser) {
 	 const page = await browser.newPage()
								.catch(function() {
									return errorHandle('newPage error: ' + config.url, browser);
								});

	if (config.viewport) {
		await page.setViewport({
	     width: config.viewport.width,
	     height: config.viewport.height
	  }).catch(function() {
			return errorHandle('setViewport 1: ' + config.url, browser);
		});
	} else {
		await page.setViewport({
	     width: 1920,
	     height: 1080
	  }).catch(function() {
			return errorHandle('setViewport 2: ' + config.url, browser);
		});
	}

  	await page.goto(config.url,
						{
							'waitUntil': 'networkidle',
							'networkIdleTimeout': 3000
						}).catch(function() {
							return errorHandle('page.goto: ' + config.url, browser);
						});

	for (var elem of config.formfiller) {
		await page.waitFor(elem.selector)
			.catch(function() {
				return errorHandle('died waiting for: ' + elem.selector, browser);
			});
		await page.focus(elem.selector, {delay: 200})
			.catch(function() {
				return errorHandle('unable to focus: ' + elem.selector, browser);
			});

		if (elem.type == "text") {
			await page.type(elem.selector, elem.value, {delay: 200})
				.catch(function() {
					return errorHandle('unable to type: ' + elem.selector, browser);
				});
		} else if (elem.type == "button") {
			await page.click(elem.selector, {delay: 200})
				.catch(function() {
					return errorHandle('unable to click: ' + elem.selector, browser);
				});
		}
	  }

	// I dislike this...
	await page.waitFor(3 * 1000)
						.catch(function() {
							return errorHandle('waitFor: ' + config.url, browser);
						});

	for (var elem of config.await) {
			await page.waitFor(elem)
				.catch(function() {
					return errorHandle('died waiting for: ' + elem, browser);
				});
	}

	for (var initEval of config.initEval) {
		await page.evaluate(initEval)
			.catch(function() {
				return errorHandle('unable to eval: ' + initEval, browser);
			});
	}

	await page.screenshot({ path: '/var/www/html/pi_kiosk/' + index.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
								.catch(function() {
									return errorHandle('screenshot: ' + config.url, browser);
								});
	browser.close();
	return browser;

  } else {	// no browser
	  return false;
  }
}

while (true) {
	console.log('running...');
	run();
	sleep(10 * 60 * 1000);
}
