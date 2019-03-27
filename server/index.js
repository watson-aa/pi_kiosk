const puppeteer = require('puppeteer'),
	  config = require('config'),
	  sleep = require('system-sleep');

const DESTINATION = '/tmp/';  // TESTING
//const DESTINATION = '/var/www/html/pi_kiosk/';

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

const MINUTES_SLEEP = 10;

async function run() {
  config.get('screenshots').forEach((screenshot, x) => {
		downloadScreenshot(x, screenshot);
		// a bad compromise
		sleep(5 * 1000);
  });
}

function errorHandle(msg, browser) {
	console.log('*ERR - ' + msg);
	if (browser) {
		browser.close();
	}
	return false;
}

async function getBrowser() {
	let browser = false;
	if (config.closeBrowser == true || !config.browser) {
		  browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
											  .catch(function() {
												  return errorHandle('launch error: ' + config.url, browser);
											  });
	} else {
		  browser = config.browser;
	}

	// insert generic error handlers
	browser.on('error', (err) => {
		return errorHandle('browser error: ' + config.url,  browser);
	});

	return browser;
}

async function getPage(browser) {
	const page = await browser.newPage()
	.catch(function() {
		return errorHandle('newPage error: ' + config.url, browser);
	});

	// insert generic error handlers
	page.on('error', (err) => {
		return errorHandle('page error: ' + config.url,  browser);
	});

	return page;
}

async function setPageViewportSize(page, viewportConfig) {
	let width = VIEWPORT_WIDTH;
	let height = VIEWPORT_HEIGHT;
	if (viewportConfig) {
		width = viewportConfig.width
		height = viewportConfig.height;
	}

	await page.setViewport({
		width: width,
		height: height
	  }).catch(function() {
		return errorHandle('setViewport 1: ' + url, page);
	});
}

async function loadInitialUrl(page, url) {
	await page.goto(url,
		{
			'waitUntil': 'networkidle2'
		}).catch(function(e) {
			return errorHandle('page.goto: ' + url + " -- " + e.message, page);
	});
}

async function insertFormValues(page, formFiller) {
	// logins and whatnot
	for (var elem of formFiller) {
		await page.waitFor(elem.selector)
			.catch(function() {
				return errorHandle('died waiting for: ' + elem.selector, page);
			});
		await page.focus(elem.selector, {delay: 200})
			.catch(function() {
				return errorHandle('unable to focus: ' + elem.selector, page);
			});

		if (elem.type == "text") {
			await page.type(elem.selector, elem.value, {delay: 200})
				.catch(function() {
					return errorHandle('unable to type: ' + elem.selector, page);
				});
		} else if (elem.type == "button") {
			await page.click(elem.selector, {delay: 200})
				.catch(function() {
					return errorHandle('unable to click: ' + elem.selector, page);
				});
		} else if (elem.type == "enter") {
			await page.type(elem.selector, String.fromCharCode(13), {delay: 200})
				.catch(function() {
					return errorHandle('unable to type enter: ' + elem.selector, page);
				});
		}
	  }
}

async function waitForPageRender(page, awaitConfig) {
	// start with the basics
	await page.waitFor('body')
		.catch(function() {
			return errorHandle('died waiting for BODY', page);
		});

	// now the custom blockers
	for (var elem of awaitConfig) {
		await page.waitFor(elem)
			.catch(function() {
				return errorHandle('died waiting for: ' + elem, page);
			});
	}
}

async function customSleepDuration(page) {
	if (config.sleep && config.sleep > 0) {
		await page.waitFor(config.sleep)
		.catch(function() {
			return errorHandle('died sleeping ' + config.sleep, browser);
		});
	}
}

async function runInitJSScripts(page, initEvals) {
	for (var initEval of initEvals) {
		await page.evaluate(initEval)
			.catch(function() {
				return errorHandle('unable to eval: ' + initEval, page);
			});
	}
}

async function captureScreenshot(page, fileNumber, url) {
	// filename is a zero-padded, 2 digit integer
	await page.screenshot({ path: DESTINATION + fileNumber.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
		.catch(function() {
			return errorHandle('screenshot: ' + url, page);
		});
}

async function closeBrowser(browser, url) {
	await browser.close()
		.catch(function() {
			return errorHandle('browser.close: ' + url, browser);
		});
}

async function closePage(page, url) {
	await page.close()
		.catch(function() {
			return errorHandle('page.close: ' + url, page);
		});
}

async function downloadScreenshot(index, config) {
	let browser = await getBrowser();
	if (browser == false) {
		return false;
	}

	let page = await getPage(browser);

	await setPageViewportSize(page, config.viewport);

	await loadInitialUrl(page, config.url);

	await insertFormValues(page, config.formfiller);

	await waitForPageRender(page, config.await);

	await customSleepDuration(page);

	await runInitJSScripts(page, config.initEval);

	await captureScreenshot(page, index, config.url);

	await closeBrowser(browser);

	return browser;
}

while (true) {
	console.log('running...');
	run();
	sleep(MINUTES_SLEEP * (60 * 1000) );
}
