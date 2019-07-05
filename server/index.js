const puppeteer = require('puppeteer'),
	  	config = require('config'); 

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

//const MINUTES_SLEEP = 1;

var minutes_sleep = 1;
var destination = '/tmp/';
//var destination = '/var/www/html/pi_kiosk/';

var browser = false;
var pages = {};

async function run(config_data) {
	let counter = 0;
	for (var screenshot of config_data.screenshots) {
		await downloadScreenshot(counter, screenshot);
		counter++;
	}
}

async function initBrowser() {
	browser = await puppeteer.launch({'args': ['--no-sandbox'], 'ignoreHTTPSErrors': true})
				.catch((err) => {
					console.log('launch error: ' + err);
					browser = false;
				});

	// insert generic error handlers
	browser.on('error', (err) => {
		console.log('browser error: ' + err);
	});
}

async function createPage() {
	const page = await browser.newPage()
		.catch((err) => {
			console.log('newPage error: ' + err);
		});

	// insert generic error handlers
	page.on('error', (err) => {
		console.log('page error: ' + err);
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
		console.log('setViewport 1: ' + err);
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
	
	// newly loaded page or session ended.  
	// the assumption is that the login will be forwarded to a different URL
	if (config['_loaded'] != true && page.url() != config.url) {
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
	let awaitElems = awaitConfig;
	// always check for the body first
	awaitElems.splice(0, 0, 'body');
	for (var elem of awaitElems) {
		await page.waitFor(elem)
			.catch((err) => {
				console.log('died waiting for: ' + elem + ' -- ' + err);
			});
		}
}

async function isPageLoaded(page, awaitConfig) {
	let pageIsLoaded = true;
	let awaitElems = awaitConfig;
	
	// always check for the body first
	awaitElems.splice(0, 0, 'body');
	for (var elem of awaitElems) {
		if (pageIsLoaded == false) {
			break;
		}
		await page.$(elem)
			.catch((err) => {
				console.log('failed looking for: ' + elem + ' -- ' + err);
			})
			.then((elem) => {
				if (elem == null) {
					pageIsLoaded = false;
				}
			});
		}	

	return pageIsLoaded;
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
	await page.screenshot({ path: destination + '/' + fileNumber.toLocaleString('en', {minimumIntegerDigits: 2}) + '.png' })
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

async function refreshPageIfRequired(page, config) {
	if (config.refresh && Number.isInteger(config.refresh)) {
		let secondsSinceLastRefresh = Math.floor((new Date() - config.lastRefresh) / 1000);
		if (secondsSinceLastRefresh > config.refresh) {
			await page.reload();
		}
	}
}

async function downloadScreenshot(index, config) {
	let page = await getPage(index);

	await refreshPageIfRequired(page, config);

	let pageIsLoaded = await isPageLoaded(page, config.await);

	if (pageIsLoaded == false) {
		await renderPage(page, config);
		await runInitJSScripts(page, config.initEval);
	}

	await captureScreenshot(page, index, config.url);

	if (!config.lastRefresh) {
		config.lastRefresh = new Date();
	}

	if (config.closePage == true) {
		await closePage(index, config.url);
	}
}

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

(async () => {
	if (process.argv.length > 2) {
		destination = process.argv[2];
	}
	if (process.argv.length > 3 && Number.isInteger(process.argv[3])) {
		minutes_sleep = process.argv[3];
	}

	while (true) {
		console.log('running...');
		await run(config);
		console.log('sleeping...');
		await sleep(minutes_sleep * 60);
	}
})();
