const puppeteer = require('puppeteer'),
	config = require('config'),
	sleep = require('system-sleep');

async function run() {
  config.get('screenshots').forEach((screenshot, x) => {
		downloadScreenshot(x, screenshot);
  });
}

async function downloadScreenshot(index, config) {
  var browser = false;
  if (config.closeBrowser == true || !config.browser) {
		browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
											.catch(function() {
												console.log('launch error: ' + config.url);
												return false;
											});
  } else {
		browser = config.browser;
  }

  if (browser) {
 	 const page = await browser.newPage()
								.catch(function() {
									console.log('newPage error: ' + config.url);
									return false;
								});

	if (config.viewport) {
		await page.setViewport({
	     width: config.viewport.width,
	     height: config.viewport.height
	  }).catch(function() {
			console.log('setViewport: ' + config.url);
			return false;
		});
	} else {
		await page.setViewport({
	     width: 1920,
	     height: 1080
	  }).catch(function() {
			console.log('setViewport: ' + config.url);
			return false;
		});
	}

  	await page.goto(config.url,
						{
							'waitUntil': 'networkidle',
							'networkIdleTimeout': 3000
						}).catch(function() {
							console.log('page.goto: ' + config.url);
							return false;
						});

	for (var elem of config.formfiller) {
		await page.waitFor(elem.selector)
			.catch(function() {
				console.log('died waiting for: ' + elem);
				return false;
			});
		await page.focus(elem.selector, {delay: 200})
			.catch(function() {
				console.log('unable to focus: ' + elem.selector);
				return false;
			});

		if (elem.type == "text") {
			await page.type(elem.selector, elem.value, {delay: 200})
				.catch(function() {
					console.log('unable to text: ' + elem.selector);
					return false;
				});
		} else if (elem.type == "button") {
			await page.click(elem.selector, {delay: 200})
				.catch(function() {
					console.log('unable to click: ' + elem.selector);
					return false;
				});
		}
	  }

	// I dislike this...
	await page.waitFor(3 * 1000)
						.catch(function() {
							console.log('waitFor: ' + config.url);
							return false;
						});

	for (var elem of config.await) {
			await page.waitFor(elem)
				.catch(function() {
					console.log('died waiting for: ' + elem);
					return false;
				});
	}

	for (var initEval of config.initEval) {
		await page.evaluate(initEval)
			.catch(function() {
				console.log('unable to eval: ' + initEval);
				return false;
			});
	}

	await page.screenshot({ path: '/var/www/html/pi_kiosk/' + index.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
								.catch(function() {
									console.log('screenshot: ' + config.url);
									return false;
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
