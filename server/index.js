const puppeteer = require('puppeteer'),
	  config = require('config');

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

const MINUTES_SLEEP = 1;

var destination = '/tmp/';
//var destination = '/var/www/html/pi_kiosk/';

var browser = false;
var pages = {};

async function run() {
	let counter = 0;
	for (var screenshot of config.screenshots) {
		await downloadScreenshot(counter, screenshot);
		counter++;
	}
}

async function initBrowser() {
	browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
				.catch((err) => {
					console.log('launch error: ' + config.url + ' -- ' + err);
					browser = false;
				});

	// insert generic error handlers
	browser.on('error', (err) => {
		console.log('browser error: ' + config.url + ' -- ' + err);
	});
}

async function createPage() {
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

async function getPage(pageNumber) {
	if (browser == false) {
		await initBrowser();
	}

	if (pages[pageNumber]) {
		return pages[pageNumber];
	}

	let page = await createPage();
	pages[pageNumber] = page;

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
	let success = true;
	await page.goto(url,
		{
			'waitUntil': 'networkidle2'
		}).catch((err) => {
			success = false;
			console.log('page.goto: ' + url + ' -- ' + err.message);
	});

	return success;
}

async function renderPage(page, config) {
	await setPageViewportSize(page, config.viewport);

	let pageLoaded = false;

	if (page.url != 'about:blank') {
		pageLoaded = await loadInitialUrl(page, config.url);
	}
	
	// newly loaded page or session ended
	if (config['_loaded'] != true || page.url() != config.url) {
		await insertFormValues(page, config.formfiller);
	}

	await waitForPageRender(page, config.await);

	config._loaded = pageLoaded;
}

async function insertFormValues(page, formFiller) {
	let success = true;

	// logins and whatnot
	for (var elem of formFiller) {
		await page.waitFor(elem.selector)
			.catch((err) => {
				success = false;
				console.log('died waiting for: ' + elem.selector + ' -- ' + err);
			});
		await page.focus(elem.selector, {delay: 200})
			.catch((err) => {
				success = false;
				console.log('unable to focus: ' + elem.selector + ' -- ' + err);
			});

		if (elem.type == "text") {
			await page.type(elem.selector, elem.value, {delay: 200})
				.catch((err) => {
					success = false;
					console.log('unable to type: ' + elem.selector + ' -- ' + err);
				});
		} else if (elem.type == "button") {
			await page.click(elem.selector, {delay: 200})
				.catch((err) => {
					success = false;
					console.log('unable to click: ' + elem.selector + ' -- ' + err);
				});
		} else if (elem.type == "enter") {
			await page.type(elem.selector, String.fromCharCode(13), {delay: 200})
				.catch((err) => {
					success = false;
					console.log('unable to type enter: ' + elem.selector + ' -- ' + err);
				});
		}

		if (success == false) {
			break;
		}
	  }

	  return success;
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
	await page.screenshot({ path: destination + fileNumber.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
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

async function closePage(pageNumber, url) {
	let page = pages[pageNumber];
	await page.close()
		.catch((err) => {
			return console.log('page.close: ' + url + ' -- ' + err);
		});

	pages[pageNumber] = false;
}

async function downloadScreenshot(index, config) {
	let page = await getPage(index);

	await renderPage(page, config);

	await runInitJSScripts(page, config.initEval);

	await captureScreenshot(page, index, config.url);

	if (config.closePage == true) {
		await closePage(index, config.url);
	}
}

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

(async () => {
	if (process.argv.length > 1) {
		destination = process.argv[1];
	}

	while (true) {
		console.log('running...');
		await run();
		console.log('sleeping...');
		await sleep(MINUTES_SLEEP * 60);
	}
})();
