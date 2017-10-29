const puppeteer = require('puppeteer'),
	config = require('config'),
	sleep = require('system-sleep');

async function run() {
  config.get('screenshots').forEach((screenshot, x) => {
		downloadScreenshot(x, screenshot);
  });
}

async function downloadScreenshot(index, config) {
  //const browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true});
  var browser = false;
  if (config.closeBrowser == true || !config.browser) {
		browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
											.catch(function() {
												console.log('launch error: ' + config.url);
											});
  } else {
		browser = config.browser;
  }
  const page = await browser.newPage()
								.catch(function() {
									console.log('newPage error: ' + config.url);
								});

	if (config.viewport) {
		await page.setViewport({
	     width: config.viewport.width,
	     height: config.viewport.height
	  }).catch(function() {
			console.log('setViewport: ' + config.url);
		});
	} else {
		await page.setViewport({
	     width: 1920,
	     height: 1080
	  }).catch(function() {
			console.log('setViewport: ' + config.url);
		});
	}

  await page.goto(config.url,
									{
										'waitUntil': 'networkidle',
										'networkIdleTimeout': 3000
									}).catch(function() {
										console.log('page.goto: ' + config.url);
									});

  for (var elem of config.formfiller) {
	await page.focus(elem.selector, {delay: 200})
		.catch(function() {
			console.log('unable to focus: ' + elem.selector);
		});

	if (elem.type == "text") {
		await page.type(elem.selector, elem.value, {delay: 200})
			.catch(function() {
				console.log('unable to text: ' + elem.selector);
			});
	} else if (elem.type == "button") {
		await page.click(elem.selector, {delay: 200})
			.catch(function() {
				console.log('unable to click: ' + elem.selector);
			});
  	}
  }

  // I dislike this...
  await page.waitFor(3 * 1000)
					.catch(function() {
						console.log('waitFor: ' + config.url);
					});

  for (var elem of config.await) {
	await page.waitFor(elem)
		.catch(function() {
			console.log('died waiting for: ' + elem);
		});
  }

  for (var initEval of config.initEval) {
  	await page.evaluate(initEval)
		.catch(function() {
			console.log('unable to eval: ' + initEval);
		});
  }

  await page.screenshot({ path: '/var/www/html/pi_kiosk/' + index.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
							.catch(function() {
								console.log('screenshot: ' + config.url);
							}).

  //if (config.closeBrowser == true) {
	await browser.close().catch(function() {
		console.log('close: ' + config.url);
	});
  //}

  return browser;
}

while (true) {
	console.log('running...');
	run();
	sleep(10 * 60 * 1000);
}
