const puppeteer = require('puppeteer'),
	  config = require('config'),
	  sleep = require('system-sleep');

const DESTINATION = '/tmp/';  // TESTING
//const DESTINATION = '/var/www/html/pi_kiosk/';

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

const MINUTES_SLEEP = 10;

async function run() {
	let counter = 0;
	for (var screenshot of config.screenshots) {
		await downloadScreenshot(counter, screenshot);
		counter++;
	}
}

async function getBrowser() {
	let browser = false;
	if (config.closeBrowser == true || !config.browser) {
		  browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
						.catch((err) => {
							console.log('launch error: ' + config.url + ' -- ' + err);
						});
	} else {
		  browser = config.browser;
	}

	// insert generic error handlers
	browser.on('error', (err) => {
		console.log('browser error: ' + config.url + ' -- ' + err);
	});

	return browser;
}

async function getPage(browser) {
	const page = await browser.newPage()
	.catch((err) => {
		console.log('newPage error: ' + config.url + ' -- ' + err);
	});

	// insert generic error handlers
	page.on('error', (err) => {
		console.log('page error: ' + config.url + ' -- ' + err);
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
	  }).catch((err) => {
		console.log('setViewport 1: ' + url + ' -- ' + err);
	});
}

async function loadInitialUrl(page, url) {
	await page.goto(url,
		{
			'waitUntil': 'networkidle2'
		}).catch((err) => {
			console.log('page.goto: ' + url + ' -- ' + errr.message);
	});
}

async function insertFormValues(page, formFiller) {
	// logins and whatnot
	for (var elem of formFiller) {
		await page.waitFor(elem.selector)
			.catch((err) => {
				console.log('died waiting for: ' + elem.selector + ' -- ' + err);
			});
		await page.focus(elem.selector, {delay: 200})
			.catch((err) => {
				console.log('unable to focus: ' + elem.selector + ' -- ' + err);
			});

		if (elem.type == "text") {
			await page.type(elem.selector, elem.value, {delay: 200})
				.catch((err) => {
					console.log('unable to type: ' + elem.selector + ' -- ' + err);
				});
		} else if (elem.type == "button") {
			await page.click(elem.selector, {delay: 200})
				.catch((err) => {
					console.log('unable to click: ' + elem.selector + ' -- ' + err);
				});
		} else if (elem.type == "enter") {
			await page.type(elem.selector, String.fromCharCode(13), {delay: 200})
				.catch((err) => {
					console.log('unable to type enter: ' + elem.selector + ' -- ' + err);
				});
		}
	  }
}

async function waitForPageRender(page, awaitConfig) {
	// start with the basics
	await page.waitFor('body')
		.catch((err) => {
			console.log('died waiting for BODY -- ' + err);
		});

	// now the custom blockers
	for (var elem of awaitConfig) {
		await page.waitFor(elem)
			.catch((err) => {
				console.log('died waiting for: ' + elem + ' -- ' + err);
			});
		}
}

async function customSleepDuration(page) {
	if (config.sleep && config.sleep > 0) {
		await page.waitFor(config.sleep)
		.catch((err) => {
			console.log('died sleeping ' + config.sleep + ' -- ' + err);
		});
	}
}

async function runInitJSScripts(page, initEvals) {
	for (var initEval of initEvals) {
		await page.evaluate(initEval)
			.catch((err) => {
				console.log('unable to eval: ' + initEval + ' -- ' + err);
			});
	}
}

async function captureScreenshot(page, fileNumber, url) {
	// filename is a zero-padded, 2 digit integer
	await page.screenshot({ path: DESTINATION + fileNumber.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
		.catch((err) => {
			console.log('screenshot: ' + url + ' -- ' + err);
		});
}

async function closeBrowser(browser, url) {
	await browser.close()
		.catch((err) => {
			console.log('browser.close: ' + url + ' -- ' + err);
		});
}

async function closePage(page, url) {
	await page.close()
		.catch((err) => {
			return console.log('page.close: ' + url + ' -- ' + err);
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

(async () => {
	while (true) {
		console.log('running...');
		await run();
		console.log('sleeping...');
		sleep(MINUTES_SLEEP * (60 * 1000) );
	}
})();
